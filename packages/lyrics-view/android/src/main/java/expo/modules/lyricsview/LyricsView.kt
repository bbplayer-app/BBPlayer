package expo.modules.lyricsview

import android.content.Context
import android.graphics.Paint
import android.os.Build
import android.view.ViewGroup.LayoutParams
import android.widget.Space
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class LyricsView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    override val shouldUseAndroidLayout = true

    var lines by mutableStateOf<List<LyricLineData>>(emptyList())
    var offsetMs by mutableLongStateOf(0L)
    var paused by mutableStateOf(false)
    var color by mutableStateOf(Color.White)
    var fontSize by mutableFloatStateOf(0f)
    var fadeTop by mutableFloatStateOf(60f)
    var fadeBottom by mutableFloatStateOf(60f)
    var bottomInset by mutableFloatStateOf(0f)

    private val onLinePress by EventDispatcher()
    private val onBackgroundPress by EventDispatcher()

    private var composeView: ComposeView? = null
    private val placeholderView = Space(context).also {
        it.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        addView(it)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        ensureComposeView()
    }

    override fun onDetachedFromWindow() {
        composeView?.let {
            // 默认策略只在 Activity 销毁时释放，视图卸载后 composition 仍会逐帧运行
            it.disposeComposition()
            removeView(it)
            composeView = null
        }
        if (placeholderView.parent == null) {
            addView(placeholderView)
        }
        super.onDetachedFromWindow()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        if (!isAttachedToWindow) {
            setMeasuredDimension(
                getDefaultSize(suggestedMinimumWidth, widthMeasureSpec),
                getDefaultSize(suggestedMinimumHeight, heightMeasureSpec)
            )
            return
        }
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
        val child = composeView ?: placeholderView
        child.measure(
            MeasureSpec.makeMeasureSpec(measuredWidth, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(measuredHeight, MeasureSpec.EXACTLY)
        )
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        if (!isAttachedToWindow) return
        super.onLayout(changed, left, top, right, bottom)
        val child = composeView ?: placeholderView
        child.layout(0, 0, right - left, bottom - top)
    }

    /**
     * 把整个视图以加法混合合成到下层的播放器背景上，对应 Apple Music 的 plus-lighter。
     * 只能在视图层级上做，Compose 内部的图层混合碰不到 RN 绘制的背景。
     */
    fun setBlendPlus(enabled: Boolean) {
        if (enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            setLayerType(LAYER_TYPE_HARDWARE, Paint().apply { blendMode = android.graphics.BlendMode.PLUS })
        } else {
            setLayerType(LAYER_TYPE_NONE, null)
        }
    }

    private fun ensureComposeView() {
        if (composeView != null) return

        removeAllViews()
        composeView = ComposeView(context).also {
            it.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            it.setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            addView(it)
            it.setContent {
                AppleLyrics(
                    lines = lines,
                    offsetMs = offsetMs,
                    paused = paused,
                    style = LyricsStyle(
                        color = color,
                        fontSize = fontSize,
                        fadeTop = fadeTop,
                        fadeBottom = fadeBottom,
                        bottomInset = bottomInset,
                    ),
                    onLinePress = { index -> onLinePress(mapOf("index" to index)) },
                    onBackgroundPress = { onBackgroundPress(emptyMap<String, Any>()) },
                )
            }
        }
    }
}

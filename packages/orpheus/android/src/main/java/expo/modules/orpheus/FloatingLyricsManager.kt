package expo.modules.orpheus

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.ContextThemeWrapper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import androidx.core.graphics.toColorInt
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import expo.modules.orpheus.models.LyricsLine
import expo.modules.orpheus.utils.GeneralStorage
import kotlin.math.abs

class FloatingLyricsManager(context: Context, private val player: ExoPlayer?) {

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var floatingView: FrameLayout? = null
    private var lyricsTextView: TextView? = null
    private var settingsPanel: LinearLayout? = null
    private var playPauseButton: ImageButton? = null
    private var params: WindowManager.LayoutParams? = null

    private val uiContext = ContextThemeWrapper(context, android.R.style.Theme_DeviceDefault)

    private var lyrics: List<LyricsLine> = emptyList()
    private var offset: Double = 0.0
    private var currentLineIndex = -1

    private var textSize = 18f
    private var textColor = "#FFFFFF".toColorInt()
    private var isLocked = false

    private val colors = listOf(
        "#FFFFFF", "#CCCCCC",
        "#FF0000", "#FFC107",
        "#2196F3", "#9C27B0",
        "#000000", "#4CAF50"
    )

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            updatePlayPauseButton(isPlaying)
        }
    }

    init {
        isLocked = GeneralStorage.isDesktopLyricsLocked()
    }

    fun show() {
        if (floatingView != null) return

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            WindowManager.LayoutParams.TYPE_PHONE
        }

        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        )
        params?.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        params?.y = 200

        createView()

        try {
            windowManager.addView(floatingView, params)
            player?.addListener(playerListener)
            updatePlayPauseButton(player?.isPlaying == true)
            GeneralStorage.setDesktopLyricsShown(true)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun hide() {
        floatingView?.let {
            try {
                windowManager.removeView(it)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            player?.removeListener(playerListener)
            floatingView = null
            lyricsTextView = null
            settingsPanel = null
            playPauseButton = null
            GeneralStorage.setDesktopLyricsShown(false)
        }
    }

    fun setLyrics(newLyrics: List<LyricsLine>, newOffset: Double = 0.0) {
        lyrics = newLyrics.sortedBy { it.timestamp }
        offset = newOffset
        currentLineIndex = -1
        updateText(null)
        if (lyrics.isEmpty()) {
            Handler(Looper.getMainLooper()).post {
                settingsPanel?.visibility = View.GONE
            }
        }
    }

    fun updateTime(seconds: Double) {
        if (floatingView == null || lyrics.isEmpty()) return

        val adjustedTime = seconds - offset
        val index = lyrics.indexOfLast { it.timestamp <= adjustedTime }
        if (index != currentLineIndex && index >= 0) {
            currentLineIndex = index
            updateText(lyrics[index])
        }
    }

    fun setLocked(locked: Boolean) {
        isLocked = locked
        GeneralStorage.setDesktopLyricsLocked(locked)
        updateTouchableFlags()
        if (locked) {
            settingsPanel?.visibility = View.GONE
        }
    }

    private fun updateTouchableFlags() {
        val p = params ?: return
        if (isLocked) {
            p.flags = p.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        } else {
            p.flags = p.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv()
        }
        try {
            if (floatingView?.isAttachedToWindow == true) {
                windowManager.updateViewLayout(floatingView, p)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun updateText(line: LyricsLine?) {
        Handler(Looper.getMainLooper()).post {
            if (line == null) {
                lyricsTextView?.text = ""
            } else {
                val text = if (line.translation.isNullOrEmpty()) {
                    line.text
                } else {
                    "${line.text}\n${line.translation}"
                }
                lyricsTextView?.text = text
            }
        }
    }

    private fun updatePlayPauseButton(isPlaying: Boolean) {
        Handler(Looper.getMainLooper()).post {
            if (isPlaying) {
                playPauseButton?.setImageResource(R.drawable.outline_pause_24)
            } else {
                playPauseButton?.setImageResource(R.drawable.outline_play_arrow_24)
            }
        }
    }

    private fun createView() {
        val frame = FrameLayout(uiContext)
        
        val contentContainer = LinearLayout(uiContext).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }

        // Lyrics View
        lyricsTextView = TextView(uiContext).apply {
            text = context.getString(R.string.desktop_lyrics)
            textSize = this@FloatingLyricsManager.textSize
            setTextColor(this@FloatingLyricsManager.textColor)
            setShadowLayer(4f, 0f, 0f, Color.BLACK)
            gravity = Gravity.CENTER
            setPadding(20, 10, 20, 10)
            
            setOnClickListener {
                toggleSettings()
            }
        }

        // Settings Panel
        settingsPanel = createSettingsPanel()
        settingsPanel?.visibility = View.GONE

        contentContainer.addView(lyricsTextView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            bottomMargin = 10
        })

        contentContainer.addView(settingsPanel, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        frame.addView(contentContainer, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER_HORIZONTAL
        ))

        var initialY = 0
        var initialTouchY = 0f
        var isClick = false
        val touchSlop = 10

        lyricsTextView?.setOnTouchListener {
            v, event ->
            if (isLocked) return@setOnTouchListener false

            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialY = params?.y ?: 0
                    initialTouchY = event.rawY
                    isClick = true
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dy = (event.rawY - initialTouchY).toInt()
                    if (abs(dy) > touchSlop) {
                        isClick = false
                        params?.y = initialY + dy
                        try {
                            windowManager.updateViewLayout(floatingView, params)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (isClick) {
                        v.performClick()
                    }
                    true
                }
                else -> false
            }
        }

        floatingView = frame
    }

    private fun createSettingsPanel(): LinearLayout {
        val panel = LinearLayout(uiContext).apply {
            orientation = LinearLayout.VERTICAL
            val gd = GradientDrawable()
            gd.setColor("#DD1A1A1A".toColorInt())
            gd.cornerRadius = 32f
            background = gd
            setPadding(32, 24, 32, 24)
            gravity = Gravity.CENTER_HORIZONTAL
        }

        // Row 1: Playback Controls
        val controlsRow = LinearLayout(uiContext).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 24)
        }

        val prevBtn = createControlButton(R.drawable.outline_skip_previous_24) { player?.seekToPreviousMediaItem() }
        playPauseButton = createControlButton(R.drawable.outline_play_arrow_24) {
            if (player?.isPlaying == true) player.pause() else player?.play()
        }.apply { textSize = 28f }
        val nextBtn = createControlButton(R.drawable.outline_skip_next_24) { player?.seekToNextMediaItem() }

        controlsRow.addView(prevBtn)
        controlsRow.addView(View(uiContext), LinearLayout.LayoutParams(40, 1)) // Spacer
        controlsRow.addView(playPauseButton)
        controlsRow.addView(View(uiContext), LinearLayout.LayoutParams(40, 1)) // Spacer
        controlsRow.addView(nextBtn)

        // Row 2: Size Slider
        val sizeRow = LinearLayout(uiContext).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, 16)
        }
        val sizeLabel = TextView(uiContext).apply {
            text = context.getString(R.string.size)
            setTextColor(Color.LTGRAY)
            textSize = 12f
        }
        val sizeSeekBar = SeekBar(uiContext).apply {
            max = 30
            progress = (textSize - 10).toInt()
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(p0: SeekBar?, p1: Int, p2: Boolean) {
                    textSize = (p1 + 10).toFloat()
                    lyricsTextView?.textSize = textSize
                }
                override fun onStartTrackingTouch(p0: SeekBar?) {}
                override fun onStopTrackingTouch(p0: SeekBar?) {}
            })
        }
        sizeRow.addView(sizeLabel)
        sizeRow.addView(sizeSeekBar, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginStart = 16
        })

        // Row 3: Colors
        val colorsScroll = HorizontalScrollView(uiContext).apply {
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            setPadding(0, 0, 0, 24)
        }
        val colorContainer = LinearLayout(uiContext).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        
        colors.forEach { colorString ->
            val color = colorString.toColorInt()
            val colorView = View(uiContext).apply {
                val size = 60
                layoutParams = LinearLayout.LayoutParams(size, size).apply {
                    marginEnd = 16
                }
                val circle = GradientDrawable()
                circle.shape = GradientDrawable.OVAL
                circle.setColor(color)
                circle.setStroke(2, Color.DKGRAY)
                background = circle
                
                setOnClickListener {
                    textColor = color
                    lyricsTextView?.setTextColor(textColor)
                }
            }
            colorContainer.addView(colorView)
        }
        colorsScroll.addView(colorContainer)

        // Row 4: Actions (Lock & Close)
        val actionsRow = LinearLayout(uiContext).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        
        val lockBtn = createActionButton(R.string.lock, R.drawable.outline_lock_24) { setLocked(true) }
        val closeBtn = createActionButton(R.string.close, R.drawable.outline_close_24) { settingsPanel?.visibility = View.GONE }

        actionsRow.addView(lockBtn)
        actionsRow.addView(View(uiContext), LinearLayout.LayoutParams(32, 1)) // Spacer
        actionsRow.addView(closeBtn)

        panel.addView(controlsRow)
        panel.addView(sizeRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        panel.addView(colorsScroll)
        panel.addView(actionsRow)

        return panel
    }

    private fun createControlButton(resId: Int, onClick: () -> Unit): ImageButton {
        return ImageButton(uiContext).apply {
            setImageResource(resId)
            setBackgroundColor(Color.TRANSPARENT)
            setColorFilter(Color.WHITE)
            scaleType = ImageView.ScaleType.FIT_CENTER
            setPadding(16, 16, 16, 16)
            setOnClickListener { onClick() }
        }
    }

    private fun createActionButton(textId: Int, iconId: Int, onClick: () -> Unit): TextView {
        return TextView(uiContext).apply {
            text = context.getString(textId)
            textSize = 14f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(32, 16, 32, 16)

            setCompoundDrawablesWithIntrinsicBounds(iconId, 0, 0, 0)

            compoundDrawablePadding = 12

            background = GradientDrawable().apply {
                setColor("#33FFFFFF".toColorInt())
                cornerRadius = 50f
            }

            setOnClickListener { onClick() }
        }
    }

    private fun toggleSettings() {
        if (settingsPanel?.visibility == View.VISIBLE) {
            settingsPanel?.visibility = View.GONE
        } else {
            settingsPanel?.visibility = View.VISIBLE
        }
    }
}
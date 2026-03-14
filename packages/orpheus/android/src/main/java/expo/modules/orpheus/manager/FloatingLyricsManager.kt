package expo.modules.orpheus.manager

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
import expo.modules.orpheus.R
import expo.modules.orpheus.model.LyricsLine
import expo.modules.orpheus.util.GeneralStorage
import expo.modules.orpheus.view.LyricView
import kotlin.math.abs

class FloatingLyricsManager(private val context: Context, private val player: ExoPlayer?) {

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var floatingView: FrameLayout? = null
    private var lyricView: LyricView? = null
    private var settingsPanel: LinearLayout? = null
    private var playPauseButton: ImageButton? = null
    private var params: WindowManager.LayoutParams? = null

    private val uiContext = ContextThemeWrapper(context, android.R.style.Theme_DeviceDefault)

    /** Callback invoked when the user clicks "清空歌词" in the settings panel. */
    var onClearLyricsRequested: ((trackId: String) -> Unit)? = null

    private var lyrics: List<LyricsLine> = emptyList()
    private var offset: Double = 0.0
    private var currentLineIndex = -1

    private var textSize = 18f
    private var textColor = "#FFC107".toColorInt()
    private var displayMode = 0 
    private var isLocked = false
    private var cachedStatusBarHeight = 0

    private val colors = listOf("#FFFFFF", "#FFC107", "#FF5722", "#E91E63", "#9C27B0", "#2196F3", "#00BCD4", "#4CAF50")
    private val colorViews = mutableListOf<View>()

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            updatePlayPauseButton(isPlaying)
            Handler(Looper.getMainLooper()).post { lyricView?.setPlaybackState(isPlaying) }
        }
    }

    init {
        isLocked = GeneralStorage.isDesktopLyricsLocked()
        displayMode = GeneralStorage.getDesktopLyricsMode().coerceIn(0, 2)
        textColor = GeneralStorage.getDesktopLyricsHighlightColor()
        textSize = GeneralStorage.getDesktopLyricsTextSize()
        val resourceId = context.resources.getIdentifier("status_bar_height", "dimen", "android")
        if (resourceId > 0) cachedStatusBarHeight = context.resources.getDimensionPixelSize(resourceId)
    }

    fun show() {
        if (floatingView != null) return
        
        // Re-read latest settings from storage before showing
        isLocked = GeneralStorage.isDesktopLyricsLocked()
        displayMode = GeneralStorage.getDesktopLyricsMode().coerceIn(0, 2)
        textColor = GeneralStorage.getDesktopLyricsHighlightColor()
        textSize = GeneralStorage.getDesktopLyricsTextSize()
        
        @Suppress("DEPRECATION")
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE
        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT,
            type, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            y = GeneralStorage.getDesktopLyricsY()
        }
        createView()
        updateTouchableFlags()
        try {
            windowManager.addView(floatingView, params)
            player?.addListener(playerListener)
            val playing = player?.isPlaying == true
            updatePlayPauseButton(playing)
            lyricView?.setPlaybackState(playing)
            GeneralStorage.setDesktopLyricsShown(true)
            syncTrackInfo()
        } catch (e: Exception) { e.printStackTrace() }
    }

    private fun syncTrackInfo() {
        val mediaItem = player?.currentMediaItem
        val title = mediaItem?.mediaMetadata?.title?.toString() ?: ""
        val artist = mediaItem?.mediaMetadata?.artist?.toString() ?: ""
        Handler(Looper.getMainLooper()).post { lyricView?.setTrackInfo(title, artist) }
    }

    /** Whether the floating window is currently attached to the screen. */
    val isShowing: Boolean get() = floatingView != null

    fun hide() {
        floatingView?.let {
            try { windowManager.removeView(it) } catch (e: Exception) { e.printStackTrace() }
            player?.removeListener(playerListener)
            floatingView = null
            lyricView = null
            settingsPanel = null
            playPauseButton = null
            colorViews.clear()
            GeneralStorage.setDesktopLyricsShown(false)
        }
    }

    /**
     * Temporarily hides the floating window WITHOUT persisting the state to GeneralStorage.
     * Used when there are no lyrics for the current track so the panel vanishes,
     * but it will be re-shown automatically when lyrics become available again.
     */
    fun softHide() {
        floatingView?.let {
            try { windowManager.removeView(it) } catch (e: Exception) { e.printStackTrace() }
            player?.removeListener(playerListener)
            floatingView = null
            lyricView = null
            settingsPanel = null
            playPauseButton = null
            colorViews.clear()
            // Note: intentionally NOT calling GeneralStorage.setDesktopLyricsShown(false)
        }
    }

    fun setLyrics(newLyrics: List<LyricsLine>, newOffset: Double = 0.0) {
        lyrics = newLyrics.filter { it.text.isNotBlank() }.sortedBy { it.timestamp }
        offset = newOffset
        currentLineIndex = -1
        syncTrackInfo()
        updateText(null)
    }

    fun updateTime(seconds: Double) {
        if (floatingView == null || lyrics.isEmpty()) return
        val adjustedTime = seconds - offset
        val adjustedTimeMs = (adjustedTime * 1000).toLong()
        val index = lyrics.indexOfLast { it.timestamp <= adjustedTime }
        if (index == -1) {
            if (currentLineIndex != -1) {
                currentLineIndex = -1
                updateText(null)
            }
        } else if (index != currentLineIndex) {
            currentLineIndex = index
            updateText(lyrics[index])
        }
        Handler(Looper.getMainLooper()).post { lyricView?.updateProgress(adjustedTimeMs) }
    }

    fun setLocked(locked: Boolean) {
        isLocked = locked
        GeneralStorage.setDesktopLyricsLocked(locked)
        updateTouchableFlags()
        if (locked) settingsPanel?.visibility = View.GONE
    }

    private fun updateTouchableFlags() {
        val p = params ?: return
        p.flags = if (isLocked) p.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE else p.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv()
        updateLayout()
    }

    private fun updateLayout() {
        try { if (floatingView?.isAttachedToWindow == true) windowManager.updateViewLayout(floatingView, params) } catch (e: Exception) {}
    }

    private fun updateText(line: LyricsLine?) {
        Handler(Looper.getMainLooper()).post { lyricView?.setLine(line) }
    }

    private fun updatePlayPauseButton(isPlaying: Boolean) {
        Handler(Looper.getMainLooper()).post {
            playPauseButton?.setImageResource(if (isPlaying) R.drawable.outline_pause_24 else R.drawable.outline_play_arrow_24)
        }
    }

    private fun createView() {
        val frame = FrameLayout(uiContext)
        val contentContainer = LinearLayout(uiContext).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT)
        }
        lyricView = LyricView(uiContext).apply {
            setStyle(this@FloatingLyricsManager.textSize, this@FloatingLyricsManager.textColor)
            setDisplayMode(this@FloatingLyricsManager.displayMode)
            setPadding(20, 10, 20, 10)
            setOnClickListener { toggleSettings() }
        }
        settingsPanel = createSettingsPanel()
        settingsPanel?.visibility = View.GONE
        contentContainer.addView(lyricView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = 10 })
        contentContainer.addView(settingsPanel, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        frame.addView(contentContainer)
        
        var initialY = 0
        var initialTouchY = 0f
        var isClick = false
        val touchSlop = 10
        lyricView?.setOnTouchListener { v, event ->
            if (isLocked) return@setOnTouchListener false
            when (event.action) {
                MotionEvent.ACTION_DOWN -> { initialY = params?.y ?: 0; initialTouchY = event.rawY; isClick = true; true }
                MotionEvent.ACTION_MOVE -> {
                    val dy = (event.rawY - initialTouchY).toInt()
                    if (abs(dy) > touchSlop) { isClick = false; params?.y = maxOf(cachedStatusBarHeight, initialY + dy); updateLayout() }
                    true
                }
                MotionEvent.ACTION_UP -> { 
                    if (isClick) v.performClick()
                    else params?.y?.let { GeneralStorage.setDesktopLyricsY(it) }
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
            background = GradientDrawable().apply { setColor("#DD1A1A1A".toColorInt()); cornerRadius = 32f }
            setPadding(32, 24, 32, 24)
            gravity = Gravity.CENTER_HORIZONTAL
        }

        // Playback Row
        val controlsRow = LinearLayout(uiContext).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER; setPadding(0, 0, 0, 24) }
        controlsRow.addView(createControlButton(R.drawable.outline_skip_previous_24) { player?.seekToPreviousMediaItem() })
        controlsRow.addView(View(uiContext), LinearLayout.LayoutParams(40, 1))
        playPauseButton = createControlButton(if (player?.isPlaying == true) R.drawable.outline_pause_24 else R.drawable.outline_play_arrow_24) {
            if (player?.isPlaying == true) player.pause() else player?.play()
        }.apply { textSize = 28f }
        controlsRow.addView(playPauseButton)
        controlsRow.addView(View(uiContext), LinearLayout.LayoutParams(40, 1))
        controlsRow.addView(createControlButton(R.drawable.outline_skip_next_24) { player?.seekToNextMediaItem() })

        // Size Slider
        val sizeRow = LinearLayout(uiContext).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, 0, 0, 24) }
        sizeRow.addView(TextView(uiContext).apply { text = this@FloatingLyricsManager.context.getString(R.string.size); setTextColor(Color.LTGRAY); textSize = 12f })
        sizeRow.addView(SeekBar(uiContext).apply {
            max = 30
            progress = (textSize - 10).toInt()
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(p0: SeekBar?, p1: Int, p2: Boolean) {
                    if (!p2) return // Only handle user-initiated changes
                    textSize = (p1 + 10).toFloat()
                    GeneralStorage.setDesktopLyricsTextSize(textSize)
                    lyricView?.setStyle(textSize, textColor)
                }
                override fun onStartTrackingTouch(p0: SeekBar?) {}
                override fun onStopTrackingTouch(p0: SeekBar?) {}
            })
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = 16 })

        // Color Row
        val colorRow = LinearLayout(uiContext).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, 0, 0, 24) }
        colorRow.addView(TextView(uiContext).apply { text = "配色"; setTextColor(Color.LTGRAY); textSize = 12f; layoutParams = LinearLayout.LayoutParams(80, LinearLayout.LayoutParams.WRAP_CONTENT) })
        val scroll = HorizontalScrollView(uiContext).apply { isHorizontalScrollBarEnabled = false; overScrollMode = View.OVER_SCROLL_NEVER }
        val container = LinearLayout(uiContext).apply { orientation = LinearLayout.HORIZONTAL }
        colorViews.clear()
        colors.forEach { colorString ->
            val color = colorString.toColorInt()
            val v = View(uiContext).apply {
                layoutParams = LinearLayout.LayoutParams(55, 55).apply { marginEnd = 16 }
                background = createColorCircleDrawable(color, color == textColor)
                setOnClickListener {
                    textColor = color
                    GeneralStorage.setDesktopLyricsHighlightColor(color)
                    lyricView?.setStyle(textSize, textColor)
                    refreshColorSelection()
                }
            }
            colorViews.add(v)
            container.addView(v)
        }
        scroll.addView(container)
        colorRow.addView(scroll)

        // Action Row
        val actionsRow = LinearLayout(uiContext).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER }
        actionsRow.addView(createActionButton(R.string.lock, R.drawable.outline_lock_24) { setLocked(true) })
        actionsRow.addView(View(uiContext), LinearLayout.LayoutParams(24, 1))
        val modeBtn = createActionButton(getModeTextRes(), R.drawable.outline_translate_24) {
            displayMode = (displayMode + 1) % 3
            GeneralStorage.setDesktopLyricsMode(displayMode)
            lyricView?.setDisplayMode(displayMode)
            (it as TextView).text = this@FloatingLyricsManager.context.getString(getModeTextRes())
            updateLayout()
        }
        actionsRow.addView(modeBtn)
        actionsRow.addView(View(uiContext), LinearLayout.LayoutParams(24, 1))
        actionsRow.addView(createActionButton(R.string.clear_lyrics, R.drawable.outline_lyrics_off_24) {
            settingsPanel?.visibility = View.GONE
            updateLayout()
            val trackId = player?.currentMediaItem?.mediaId ?: return@createActionButton
            // Clear the overlay immediately for instant feedback
            setLyrics(emptyList())
            onClearLyricsRequested?.invoke(trackId)
        })
        actionsRow.addView(View(uiContext), LinearLayout.LayoutParams(24, 1))
        actionsRow.addView(createActionButton(R.string.close, R.drawable.outline_close_24) { settingsPanel?.visibility = View.GONE; updateLayout() })

        panel.addView(controlsRow); panel.addView(sizeRow); panel.addView(colorRow); panel.addView(actionsRow)
        return panel
    }

    private fun createColorCircleDrawable(color: Int, selected: Boolean): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(color)
            setStroke(if (selected) 5 else 1, if (selected) Color.WHITE else Color.DKGRAY)
        }
    }

    private fun refreshColorSelection() {
        colors.forEachIndexed { index, colorString ->
            val color = colorString.toColorInt()
            colorViews.getOrNull(index)?.background = createColorCircleDrawable(color, color == textColor)
        }
    }

    private fun createControlButton(resId: Int, onClick: () -> Unit): ImageButton {
        return ImageButton(uiContext).apply {
            setImageResource(resId)
            setBackgroundColor(Color.TRANSPARENT); setColorFilter(Color.WHITE)
            scaleType = ImageView.ScaleType.FIT_CENTER; setPadding(16, 16, 16, 16)
            setOnClickListener { onClick() }
        }
    }

    private fun createActionButton(textId: Int, iconId: Int, onClick: (View) -> Unit): TextView {
        return TextView(uiContext).apply {
            text = this@FloatingLyricsManager.context.getString(textId)
            textSize = 11f; setTextColor(Color.WHITE); gravity = Gravity.CENTER; setPadding(20, 12, 20, 12)
            setCompoundDrawablesWithIntrinsicBounds(iconId, 0, 0, 0); compoundDrawablePadding = 6
            background = GradientDrawable().apply { setColor("#33FFFFFF".toColorInt()); cornerRadius = 50f }
            setOnClickListener { onClick(it) }
        }
    }

    private fun getModeTextRes(): Int = when (displayMode) { 0 -> R.string.lyric_mode_trans; 1 -> R.string.lyric_mode_roma; else -> R.string.lyric_mode_none }

    private fun toggleSettings() {
        if (settingsPanel?.visibility == View.VISIBLE) {
            settingsPanel?.visibility = View.GONE
        } else {
            settingsPanel?.visibility = View.VISIBLE
            updatePlayPauseButton(player?.isPlaying == true)
        }
        updateLayout()
    }
}

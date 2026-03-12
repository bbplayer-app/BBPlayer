package expo.modules.orpheus.view

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import androidx.core.graphics.ColorUtils
import expo.modules.orpheus.model.LyricsLine

/**
 * LyricView with Smart Global Coloring.
 * Handles both verbatim and standard lines, ensuring chosen color is always visible.
 */
class LyricView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var currentLine: LyricsLine? = null
    private var displayMode: Int = 0 // 0: Trans, 1: Roma, 2: None

    private var lastUpdateMs: Long = 0
    private var lastSystemTime: Long = 0
    private var isPlaying: Boolean = false

    private var trackTitle: String = ""
    private var trackArtist: String = ""

    private val mainPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
    private val highlightPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
    private val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
    private val outlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        style = Paint.Style.STROKE
        color = Color.BLACK
        alpha = 160
    }

    private var mainTextSize: Float = 60f
    private var chosenHighlightColor: Int = Color.parseColor("#FFC107")
    private var baseTextColor: Int = Color.WHITE

    fun setStyle(textSize: Float, chosenColor: Int) {
        this.mainTextSize = textSize * 3
        this.chosenHighlightColor = chosenColor
        
        val hsl = FloatArray(3)
        ColorUtils.colorToHSL(chosenColor, hsl)
        val isWhite = hsl[2] > 0.9f 

        // If user chose White as theme, we make base text grey/transparent white.
        // Otherwise, base is always pure white for high contrast.
        this.baseTextColor = if (isWhite) ColorUtils.setAlphaComponent(Color.WHITE, 140) else Color.WHITE

        mainPaint.textSize = mainTextSize
        highlightPaint.textSize = mainTextSize
        highlightPaint.color = chosenHighlightColor
        
        subPaint.textSize = mainTextSize * 0.85f
        // Sub-text always follows the chosen color with transparency
        subPaint.color = ColorUtils.setAlphaComponent(chosenHighlightColor, 200)
        
        requestLayout()
        invalidate()
    }

    fun setTrackInfo(title: String, artist: String) {
        this.trackTitle = title
        this.trackArtist = artist
        invalidate()
    }

    fun setDisplayMode(mode: Int) {
        this.displayMode = mode
        invalidate()
    }

    fun setPlaybackState(playing: Boolean) {
        this.isPlaying = playing
        if (playing) {
            lastSystemTime = System.currentTimeMillis()
            postInvalidateOnAnimation()
        }
    }

    fun setLine(line: LyricsLine?) {
        this.currentLine = line
        lastSystemTime = System.currentTimeMillis()
        invalidate()
    }

    fun updateProgress(progressMs: Long) {
        this.lastUpdateMs = progressMs
        this.lastSystemTime = System.currentTimeMillis()
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val centerX = width / 2f
        val centerY = height / 2f
        
        val now = System.currentTimeMillis()
        val effectiveProgressMs = if (isPlaying && lastSystemTime > 0) {
            lastUpdateMs + (now - lastSystemTime)
        } else {
            lastUpdateMs
        }

        val line = currentLine
        if (line == null) {
            if (trackTitle.isNotEmpty()) {
                val titleY = centerY + (mainPaint.descent() - mainPaint.ascent()) / 4f
                // Track Title uses the chosen color
                mainPaint.color = chosenHighlightColor
                drawTextWithOutline(canvas, trackTitle, centerX, titleY, mainPaint)
                if (trackArtist.isNotEmpty()) {
                    val subY = titleY + (mainPaint.descent() - mainPaint.ascent()) * 0.35f + subPaint.textSize * 1.05f
                    drawTextWithOutline(canvas, trackArtist, centerX, subY, subPaint)
                }
            }
            return
        }
        
        val subText = when (displayMode) {
            0 -> line.translation
            1 -> line.romaji
            else -> null
        }?.takeIf { it.isNotBlank() }

        val mainLineHeight = mainPaint.descent() - mainPaint.ascent()
        val subLineHeight = subPaint.textSize * 1.05f
        val mainTextY = if (subText != null) centerY - (subLineHeight * 0.25f) else centerY + (mainLineHeight / 4f)

        // 1. Determine base coloring for main text
        val isVerbatim = line.spans != null && line.spans.isNotEmpty()
        mainPaint.color = if (isVerbatim) baseTextColor else chosenHighlightColor

        // 2. Draw Main Text Outline & Fill
        drawTextWithOutline(canvas, line.text, centerX, mainTextY, mainPaint)
        
        // 3. Draw Verbatim Highlight (if applicable)
        if (isVerbatim) {
            drawVerbatimHighlight(canvas, line, centerX, mainTextY, effectiveProgressMs)
        }
        
        // 4. Draw Sub Text
        if (subText != null) {
            val currentSubY = mainTextY + (mainLineHeight * 0.35f) + subLineHeight
            val truncatedSub = truncateText(subText, subPaint, width * 0.95f)
            drawTextWithOutline(canvas, truncatedSub, centerX, currentSubY, subPaint)
        }

        if (isPlaying && isVerbatim) {
            postInvalidateOnAnimation()
        }
    }

    private fun drawTextWithOutline(canvas: Canvas, text: String, x: Float, y: Float, paint: Paint) {
        outlinePaint.textSize = paint.textSize
        outlinePaint.strokeWidth = paint.textSize / 15f
        canvas.drawText(text, x, y, outlinePaint)
        canvas.drawText(text, x, y, paint)
    }

    private fun truncateText(text: String, paint: Paint, maxWidth: Float): String {
        return if (paint.measureText(text) > maxWidth) {
            val end = paint.breakText(text, true, maxWidth - 20f, null)
            text.substring(0, end) + "..."
        } else text
    }

    private fun drawVerbatimHighlight(canvas: Canvas, line: LyricsLine, x: Float, y: Float, progressMs: Long) {
        val spans = line.spans ?: return
        val fullWidth = mainPaint.measureText(line.text)
        val startX = x - fullWidth / 2f
        var accumulatedX = startX
        
        for (span in spans) {
            val spanWidth = mainPaint.measureText(span.text)
            val spanProgress = when {
                progressMs < span.startTime -> 0f
                progressMs > span.endTime -> 1f
                else -> (progressMs - span.startTime).toFloat() / span.duration.toFloat()
            }

            if (spanProgress > 0) {
                canvas.save()
                canvas.clipRect(accumulatedX, y + mainPaint.ascent(), accumulatedX + (spanWidth * spanProgress), y + mainPaint.descent())
                outlinePaint.textSize = mainTextSize
                outlinePaint.strokeWidth = mainTextSize / 15f
                canvas.drawText(span.text, accumulatedX + spanWidth / 2f, y, outlinePaint)
                canvas.drawText(span.text, accumulatedX + spanWidth / 2f, y, highlightPaint)
                canvas.restore()
            }
            accumulatedX += spanWidth
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val mainLineHeight = mainPaint.descent() - mainPaint.ascent()
        val subLineHeight = subPaint.textSize * 1.1f
        setMeasuredDimension(width, (mainLineHeight + subLineHeight + 60f).toInt())
    }
}

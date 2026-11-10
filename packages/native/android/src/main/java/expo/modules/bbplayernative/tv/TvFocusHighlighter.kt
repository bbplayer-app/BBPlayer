package expo.modules.bbplayernative.tv

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.drawable.Drawable
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.animation.DecelerateInterpolator
import java.lang.ref.WeakReference
import java.util.WeakHashMap

/**
 * Draws a ring around the focused view while a window is driven by keys (TV remote D-pad,
 * keyboard). Touch mode hides it, so touch users never see it.
 *
 * The ring is a drawable in the window root's overlay: it sits above all content and needs no
 * change to individual components. It is re-measured before every frame, so it stays on the
 * focused view while lists scroll and moves to the next view with a short slide.
 */
internal class TvFocusHighlighter private constructor(private val root: View) :
  ViewTreeObserver.OnGlobalFocusChangeListener,
  ViewTreeObserver.OnPreDrawListener,
  ViewTreeObserver.OnTouchModeChangeListener,
  ViewTreeObserver.OnWindowFocusChangeListener,
  View.OnAttachStateChangeListener,
  View.OnLayoutChangeListener {

  private val density = root.resources.displayMetrics.density
  private val ring = FocusRingDrawable(density)
  private val padding = RING_PADDING_DP * density
  private val defaultRadius = DEFAULT_CORNER_RADIUS_DP * density

  private var focused: WeakReference<View>? = null
  private var observer: ViewTreeObserver? = null

  private val visibleRect = Rect()
  private val target = RectF()
  private val animationStart = RectF()
  private var animationStartTime = 0L
  private var animating = false
  private var targetRadius = defaultRadius
  private var startRadius = defaultRadius

  private fun attach() {
    root.addOnAttachStateChangeListener(this)
    root.addOnLayoutChangeListener(this)
    ring.color = ringColor
    root.overlay.add(ring)
    if (root.isAttachedToWindow) {
      onViewAttachedToWindow(root)
    }
  }

  private fun detach() {
    removeObservers()
    root.removeOnAttachStateChangeListener(this)
    root.removeOnLayoutChangeListener(this)
    root.overlay.remove(ring)
  }

  override fun onViewAttachedToWindow(v: View) {
    removeObservers()
    val vto = root.viewTreeObserver
    vto.addOnGlobalFocusChangeListener(this)
    vto.addOnPreDrawListener(this)
    vto.addOnTouchModeChangeListener(this)
    vto.addOnWindowFocusChangeListener(this)
    observer = vto
    updateBounds()
    setFocused(root.findFocus(), animate = false)
  }

  override fun onViewDetachedFromWindow(v: View) {
    // The window is gone (a closed dialog, a destroyed activity). Forget it; whoever shows it
    // again installs a new highlighter.
    uninstall(root)
  }

  private fun removeObservers() {
    observer?.takeIf { it.isAlive }?.apply {
      removeOnGlobalFocusChangeListener(this@TvFocusHighlighter)
      removeOnPreDrawListener(this@TvFocusHighlighter)
      removeOnTouchModeChangeListener(this@TvFocusHighlighter)
      removeOnWindowFocusChangeListener(this@TvFocusHighlighter)
    }
    observer = null
  }

  override fun onLayoutChange(
    v: View,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
    oldLeft: Int,
    oldTop: Int,
    oldRight: Int,
    oldBottom: Int,
  ) {
    updateBounds()
  }

  private fun updateBounds() {
    // The ring draws itself at its own rectangle; the drawable spans the root so that every
    // invalidation repaints wherever the ring was and is.
    ring.setBounds(0, 0, root.width, root.height)
  }

  override fun onGlobalFocusChanged(oldFocus: View?, newFocus: View?) {
    setFocused(newFocus, animate = true)
    if (newFocus != null) {
      TvFocusScopeView.onGlobalFocusChanged(root, newFocus)
    }
  }

  override fun onTouchModeChanged(isInTouchMode: Boolean) {
    TvFocusScopeView.onTouchModeChanged(root, isInTouchMode)
    // Leaving touch mode re-shows the ring where focus already is, without sliding in.
    animating = false
    refresh()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    refresh()
  }

  override fun onPreDraw(): Boolean {
    refresh()
    return true
  }

  private fun setFocused(view: View?, animate: Boolean) {
    val wasShown = ring.shown
    focused = view?.let(::WeakReference)
    if (view != null) {
      targetRadius = cornerRadiusOf(view) + padding
    }
    if (animate && wasShown && view != null) {
      animationStart.set(ring.rect)
      startRadius = ring.cornerRadius
      animationStartTime = SystemClock.uptimeMillis()
      animating = true
    } else {
      animating = false
    }
    refresh()
  }

  private fun refresh() {
    val view = focused?.get()
    if (view == null || !shouldShowRing(view) || !measure(view, target)) {
      if (ring.shown) {
        ring.shown = false
        ring.invalidateSelf()
      }
      animating = false
      return
    }

    var radius = targetRadius
    if (animating) {
      val elapsed = SystemClock.uptimeMillis() - animationStartTime
      val fraction = (elapsed.toFloat() / ANIMATION_DURATION_MS).coerceIn(0f, 1f)
      val eased = interpolator.getInterpolation(fraction)
      target.set(
        lerp(animationStart.left, target.left, eased),
        lerp(animationStart.top, target.top, eased),
        lerp(animationStart.right, target.right, eased),
        lerp(animationStart.bottom, target.bottom, eased),
      )
      radius = lerp(startRadius, targetRadius, eased)
      if (fraction >= 1f) {
        animating = false
      } else {
        root.postInvalidateOnAnimation()
      }
    }

    if (!ring.shown || ring.rect != target || ring.cornerRadius != radius || ring.color != ringColor) {
      ring.rect.set(target)
      ring.cornerRadius = radius
      ring.color = ringColor
      ring.shown = true
      ring.invalidateSelf()
    }
  }

  private fun shouldShowRing(view: View): Boolean =
    !root.isInTouchMode &&
      root.hasWindowFocus() &&
      view.isAttachedToWindow &&
      view.rootView === root &&
      view.isShown &&
      view.width > 0 &&
      view.height > 0

  /**
   * Visible part of [view] in root coordinates, grown by the ring padding but kept inside the
   * window, so full-width rows still get all four sides.
   */
  private fun measure(view: View, out: RectF): Boolean {
    if (!view.getGlobalVisibleRect(visibleRect)) {
      return false
    }
    out.set(visibleRect)
    out.inset(-padding, -padding)
    val edge = ring.outerStrokeHalfWidth
    out.left = out.left.coerceAtLeast(edge)
    out.top = out.top.coerceAtLeast(edge)
    out.right = out.right.coerceAtMost(root.width - edge)
    out.bottom = out.bottom.coerceAtMost(root.height - edge)
    return out.width() > 0f && out.height() > 0f
  }

  private fun cornerRadiusOf(view: View): Float {
    val provider = view.outlineProvider ?: return defaultRadius
    val outline = Outline()
    val radius = try {
      provider.getOutline(view, outline)
      outline.radius
    } catch (_: Throwable) {
      -1f
    }
    if (radius <= 0f) {
      return defaultRadius
    }
    // Pills and circles report a radius larger than the shape can show.
    return radius.coerceAtMost(minOf(view.width, view.height) / 2f)
  }

  private class FocusRingDrawable(density: Float) : Drawable() {
    val rect = RectF()
    var cornerRadius = 0f
    var shown = false

    var color: Int = Color.WHITE
      set(value) {
        field = value
        strokePaint.color = value
        fillPaint.color = (value and 0x00FFFFFF) or (FILL_ALPHA shl 24)
      }

    private val strokeWidth = STROKE_WIDTH_DP * density
    private val haloWidth = strokeWidth + 2 * HALO_WIDTH_DP * density

    /** How far the widest stroke reaches outside [rect]. */
    val outerStrokeHalfWidth = haloWidth / 2

    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = this@FocusRingDrawable.strokeWidth
    }
    private val haloPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = haloWidth
      color = HALO_COLOR
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }

    override fun draw(canvas: Canvas) {
      if (!shown || rect.isEmpty) return
      canvas.drawRoundRect(rect, cornerRadius, cornerRadius, fillPaint)
      // A dark halo keeps a light ring readable on light artwork and vice versa.
      canvas.drawRoundRect(rect, cornerRadius, cornerRadius, haloPaint)
      canvas.drawRoundRect(rect, cornerRadius, cornerRadius, strokePaint)
    }

    override fun setAlpha(alpha: Int) = Unit

    override fun setColorFilter(colorFilter: ColorFilter?) = Unit

    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
  }

  companion object {
    private const val STROKE_WIDTH_DP = 3f
    private const val HALO_WIDTH_DP = 1.5f
    private const val RING_PADDING_DP = 3f
    private const val DEFAULT_CORNER_RADIUS_DP = 8f
    private const val ANIMATION_DURATION_MS = 120f
    private const val FILL_ALPHA = 0x2E
    private const val HALO_COLOR = 0x73000000

    private val interpolator = DecelerateInterpolator(1.5f)

    // Weak both ways: a highlighter holds its root, so a strong value here would keep a root that
    // never attached (an activity finished before its window was shown) alive forever. The root
    // keeps its highlighter alive through the listeners the highlighter registers on it.
    private val highlighters = WeakHashMap<View, WeakReference<TvFocusHighlighter>>()

    @Volatile
    private var ringColor: Int = Color.WHITE

    /**
     * Installs a highlighter on the window whose root is [root]. Safe to call repeatedly; it is
     * removed again when that window goes away.
     */
    fun install(root: View) {
      if (highlighters[root]?.get() != null) return
      highlighters[root] = WeakReference(TvFocusHighlighter(root).also { it.attach() })
    }

    fun uninstall(root: View) {
      highlighters.remove(root)?.get()?.detach()
    }

    fun setRingColor(color: Int) {
      ringColor = color
      highlighters.values.mapNotNull { it.get() }.forEach { it.refresh() }
    }

    private fun lerp(from: Float, to: Float, fraction: Float) = from + (to - from) * fraction
  }
}

internal fun ViewGroup.isAncestorOf(view: View): Boolean {
  var parent = view.parent
  while (parent != null) {
    if (parent === this) return true
    parent = parent.parent
  }
  return false
}

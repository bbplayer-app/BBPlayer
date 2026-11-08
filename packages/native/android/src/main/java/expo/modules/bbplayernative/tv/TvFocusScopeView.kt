package expo.modules.bbplayernative.tv

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.FocusFinder
import android.view.View
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.lang.ref.WeakReference

/**
 * A container that keeps key-driven focus (TV remote D-pad, keyboard) inside itself while it is
 * active and on screen, the way a dialog window would:
 *
 * - [autoFocus]: when it appears, focus moves to its first focusable child, so the remote acts on
 *   the dialog instead of the screen behind it.
 * - [trapFocus]: D-pad moves that would leave the container keep the current view focused.
 * - [restoreFocus]: when it goes away, focus returns to the view that had it before.
 *
 * None of this happens in touch mode, so touch users see no difference.
 *
 * Its children are laid out by React Native, like a plain `View`.
 */
class TvFocusScopeView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  var active = true
    set(value) {
      if (field == value) return
      field = value
      isFocusable = value && trapFocus
      if (isAttachedToWindow) {
        if (value) activate() else deactivate()
      }
    }
  var autoFocus = true
  var trapFocus = true
    set(value) {
      field = value
      isFocusable = active && value
    }
  var restoreFocus = true

  private var previousFocus: WeakReference<View>? = null

  // Whether focus has been inside since activation. It is not cleared when focus leaves: closing
  // can remove the focused child before this container, and the window then moves focus outside
  // just before deactivate() runs. With the trap on, only such removals take focus out anyway.
  private var hadFocus = false
  private var autoFocusDeadline = 0L

  init {
    // Loading/progress dialogs may have no focusable children. Keep focus on the scope itself
    // in that case, rather than leaving the remote able to activate the page behind it.
    isFocusable = true
    descendantFocusability = FOCUS_AFTER_DESCENDANTS
    clipChildren = false
    clipToPadding = false
  }

  // React Native positions the children; keep LinearLayout from measuring or moving them.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(
      MeasureSpec.getSize(widthMeasureSpec),
      MeasureSpec.getSize(heightMeasureSpec),
    )
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) = Unit

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    // Also covers React Native modals, which open a window of their own.
    TvFocusHighlighter.install(rootView)
    if (active) activate()
  }

  override fun onDetachedFromWindow() {
    if (active) deactivate()
    super.onDetachedFromWindow()
  }

  private val isOnScreen: Boolean
    get() = isAttachedToWindow && isShown && width > 0 && height > 0

  private fun activate() {
    scopes.remove(this)
    scopes.add(this)
    val current = rootView.findFocus()
    hadFocus = current != null && contains(current)
    previousFocus = current?.takeUnless { hadFocus }?.let(::WeakReference)
    if (autoFocus) {
      autoFocusDeadline = SystemClock.uptimeMillis() + AUTO_FOCUS_TIMEOUT_MS
      removeCallbacks(autoFocusRunnable)
      post(autoFocusRunnable)
    }
  }

  private fun contains(view: View): Boolean = view === this || isAncestorOf(view)

  private fun deactivate() {
    scopes.remove(this)
    removeCallbacks(autoFocusRunnable)
    val previous = previousFocus?.get()
    val restore = restoreFocus && hadFocus
    previousFocus = null
    hadFocus = false
    if (!restore || previous == null) return
    val root = rootView
    // Removing a focused view makes the window focus its first focusable view, usually somewhere
    // on the screen behind. Once that has happened, hand focus back to where it came from.
    mainHandler.post {
      if (!previous.isAttachedToWindow || !previous.isShown || previous.isInTouchMode) {
        return@post
      }
      // Another dialog or sheet that is still open owns focus now, unless the previous view is
      // inside it (a dialog opened from a sheet).
      val owner = scopes.lastOrNull { it.rootView === root && it.isOnScreen }
      if (owner == null || owner.contains(previous)) {
        previous.requestFocus()
      }
    }
  }

  private val autoFocusRunnable = object : Runnable {
    override fun run() {
      if (!active || isInTouchMode || !isAttachedToWindow) return
      if (findFocus() != null) return
      if (isOnScreen && requestFocus(View.FOCUS_DOWN)) return
      // Content can mount or lay out a little later (lazy modals, suspense fallbacks).
      if (SystemClock.uptimeMillis() < autoFocusDeadline) {
        postDelayed(this, AUTO_FOCUS_RETRY_MS)
      }
    }
  }

  override fun focusSearch(focused: View?, direction: Int): View? {
    if (!active || !trapFocus || focused == null || isInTouchMode || !contains(focused)) {
      return super.focusSearch(focused, direction)
    }
    val next = try {
      FocusFinder.getInstance().findNextFocus(this, focused, direction)
    } catch (_: IllegalArgumentException) {
      return super.focusSearch(focused, direction)
    }
    // At an edge of the container focus stays where it is instead of escaping behind it.
    return next ?: focused
  }

  companion object {
    private const val AUTO_FOCUS_TIMEOUT_MS = 1500L
    private const val AUTO_FOCUS_RETRY_MS = 50L

    private val mainHandler = Handler(Looper.getMainLooper())

    /** Active scopes, most recently activated last. Touched on the main thread only. */
    private val scopes = mutableListOf<TvFocusScopeView>()

    internal fun onTouchModeChanged(root: View, isInTouchMode: Boolean) {
      if (isInTouchMode) return
      val scope = scopes.lastOrNull { it.rootView === root && it.isOnScreen } ?: return
      if (!scope.autoFocus || scope.hasFocus()) return
      // A scope opened by touch skipped its initial autofocus. Entering key navigation must
      // hand focus to that scope even when the window's previously focused view did not change.
      scope.autoFocusDeadline = SystemClock.uptimeMillis() + AUTO_FOCUS_TIMEOUT_MS
      scope.removeCallbacks(scope.autoFocusRunnable)
      scope.post(scope.autoFocusRunnable)
    }

    /**
     * Called for every focus change in [root]'s window. Records which scopes have held focus, and
     * pulls focus back into the newest visible scope when something outside it takes focus (for
     * example the window refocusing the screen behind after a view is removed).
     */
    internal fun onGlobalFocusChanged(root: View, newFocus: View) {
      var top: TvFocusScopeView? = null
      for (scope in scopes) {
        if (scope.rootView !== root) continue
        if (scope.contains(newFocus)) scope.hadFocus = true
        if (scope.isOnScreen) top = scope
      }
      val scope = top ?: return
      if (scope.contains(newFocus) || !scope.trapFocus || scope.isInTouchMode) return
      scope.post {
        if (scope.active && scope.isOnScreen && !scope.isInTouchMode && scope.findFocus() == null) {
          scope.requestFocus(View.FOCUS_DOWN)
        }
      }
    }
  }
}

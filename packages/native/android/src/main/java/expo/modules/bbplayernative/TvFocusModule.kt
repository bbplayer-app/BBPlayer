package expo.modules.bbplayernative

import android.os.Handler
import android.os.Looper
import expo.modules.bbplayernative.tv.TvFocusHighlighter
import expo.modules.bbplayernative.tv.TvFocusScopeView
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Remote control (D-pad) support: the focus ring and focus scopes. */
class TvFocusModule : Module() {
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun definition() = ModuleDefinition {
        Name("BBPlayerTvFocus")

        // `color` is an ARGB int from React Native's `processColor`.
        Function("setFocusRingColor") { color: Int ->
            mainHandler.post { TvFocusHighlighter.setRingColor(color) }
        }

        View(TvFocusScopeView::class) {
            Prop("active", true) { view: TvFocusScopeView, value: Boolean ->
                view.active = value
            }
            Prop("autoFocus", true) { view: TvFocusScopeView, value: Boolean ->
                view.autoFocus = value
            }
            Prop("trapFocus", true) { view: TvFocusScopeView, value: Boolean ->
                view.trapFocus = value
            }
            Prop("restoreFocus", true) { view: TvFocusScopeView, value: Boolean ->
                view.restoreFocus = value
            }
        }
    }
}

package expo.modules.wavyslider.state

import expo.modules.bbplayernative.telemetry.NativeLog
import expo.modules.kotlin.jni.worklets.Worklet
import expo.modules.kotlin.sharedobjects.SharedObject

/**
 * A SharedObject that wraps a Worklet function.
 * Passable as a view prop via integer ID — survives React's prop serialization.
 * The view resolves it and executes the worklet on the UI runtime.
 */
class WorkletCallback : SharedObject() {
    // Initialized on construction, then updated and invoked on the UI thread.
    var worklet: Worklet? = null

    fun invoke(vararg arguments: Any?) {
        // A missing callback is an intentional disabled event, not an error.
        val worklet = worklet ?: return
        val runtime = appContext?.uiRuntime ?: run {
            NativeLog.warning("WavySlider", "slider.worklet.runtime_unavailable")
            return
        }
        worklet.execute(runtime, *arguments)
    }
}

package expo.modules.bbplayernative

import android.app.Activity
import android.content.Context
import android.os.Bundle
import expo.modules.bbplayernative.tv.TvFocusHighlighter
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class BBPlayerNativePackage : Package {
    override fun createReactActivityLifecycleListeners(
        activityContext: Context,
    ): List<ReactActivityLifecycleListener> = listOf(TvFocusActivityListener)
}

/** Shows the focus ring in the main activity whenever it is driven by a remote or keyboard. */
private object TvFocusActivityListener : ReactActivityLifecycleListener {
    override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
        TvFocusHighlighter.install(activity.window.decorView)
    }

    // Installing is idempotent; this covers a decor view that was detached and attached again.
    override fun onResume(activity: Activity) {
        TvFocusHighlighter.install(activity.window.decorView)
    }
}

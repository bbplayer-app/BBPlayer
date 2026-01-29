package expo.modules.orpheus

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class OrpheusHeadlessTaskService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras
        return if (extras != null) {
            HeadlessJsTaskConfig(
                "OrpheusHeadlessTask",
                Arguments.fromBundle(extras),
                5000, // timeout for the task
                true // allowed in foreground
            )
        } else {
            null
        }
    }
}

package expo.modules.orpheus.service

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
                30_000, // Lyrics fetching and playback-history reporting may require network I/O.
                true // allowed in foreground
            )
        } else {
            null
        }
    }
}

package expo.modules.orpheus.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class MediaNotificationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val service = OrpheusMusicService.instance ?: return
        val player = service.player ?: return

        when (intent.action) {
            "orpheus.PREV" -> {
                if (player.hasPreviousMediaItem()) {
                    player.seekToPrevious()
                }
            }
            "orpheus.PLAY_PAUSE" -> {
                if (player.isPlaying) {
                    player.pause()
                } else {
                    player.play()
                }
            }
            "orpheus.NEXT" -> {
                if (player.hasNextMediaItem()) {
                    player.seekToNext()
                }
            }
        }
    }
}

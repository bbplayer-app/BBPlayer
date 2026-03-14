package expo.modules.orpheus.service

import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import expo.modules.orpheus.util.GeneralStorage

/**
 * Manages physical-queue shuffle for Orpheus.
 *
 * Instead of using Media3's internal ShuffleOrder traversal, this class physically
 * reorders the ExoPlayer MediaItem list when shuffle is toggled or the full queue
 * has been played through once.
 *
 * Behaviour:
 *  - On enable: current track moves to index 0, remaining tracks shuffled randomly.
 *  - On full loop: automatically re-shuffles (current track stays at index 0).
 *  - On disable: physical order is left as-is; Media3 shuffle flag is turned off.
 */
@OptIn(UnstableApi::class)
class ShuffleManager(private val getPlayer: () -> ExoPlayer?) {

    private var isShuffleEnabled = false
    private val playedIds = mutableSetOf<String>()

    val isEnabled: Boolean get() = isShuffleEnabled

    /**
     * Enable or disable the custom shuffle mode.
     * Call this from the main thread.
     */
    fun setShuffleEnabled(enabled: Boolean) {
        isShuffleEnabled = enabled
        GeneralStorage.saveShuffleMode(enabled)

        if (enabled) {
            playedIds.clear()
            reshuffleQueue()
        } else {
            playedIds.clear()
            // Disable Media3's own shuffle flag too (we never set it true, but be defensive)
            getPlayer()?.shuffleModeEnabled = false
        }
    }

    /**
     * Restores the shuffle-enabled flag on cold-start WITHOUT physically reshuffling the queue.
     * The saved queue is already in the shuffled order that was persisted before the app closed.
     */
    fun restoreShuffleEnabled(enabled: Boolean) {
        isShuffleEnabled = enabled
        // Don't call reshuffleQueue() — trust the restored queue order
        if (!enabled) {
            getPlayer()?.shuffleModeEnabled = false
        }
    }

    /**
     * Call this whenever the currently playing track changes.
     * If shuffle is enabled and all tracks have been played once, the queue re-shuffles.
     */
    fun onTrackChanged(mediaId: String) {
        if (!isShuffleEnabled) return
        playedIds.add(mediaId)
        val player = getPlayer() ?: return
        val total = player.mediaItemCount
        Log.d("ShuffleManager", "onTrackChanged: $mediaId played=${playedIds.size} total=$total")
        if (total > 1 && playedIds.size >= total) {
            Log.d("ShuffleManager", "Full loop detected — re-shuffling queue")
            playedIds.clear()
            reshuffleQueue()
        }
    }

    /**
     * Physically reorders the player's MediaItem list:
     * current track → index 0, rest shuffled randomly.
     */
    private fun reshuffleQueue() {
        val player = getPlayer() ?: return
        val count = player.mediaItemCount
        if (count <= 1) return

        val currentIndex = player.currentMediaItemIndex
        val currentPosition = player.currentPosition

        val items = (0 until count).map { player.getMediaItemAt(it) }.toMutableList()
        val current = items.removeAt(currentIndex)
        items.shuffle()
        val newList = listOf(current) + items

        // Replace the queue atomically; seek to position 0 (current track) preserving playback position
        player.setMediaItems(newList, /* startIndex= */ 0, currentPosition)
        // Ensure Media3's own shuffle traversal is off — we manage order ourselves
        player.shuffleModeEnabled = false

        Log.d("ShuffleManager", "Queue reshuffled: ${newList.map { it.mediaId }}")
    }
}

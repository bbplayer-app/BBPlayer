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
    private var originalOrder: List<String>? = null

    var isReshuffling = false
        private set

    val isEnabled: Boolean get() = isShuffleEnabled

    /**
     * Enable or disable the custom shuffle mode.
     * Call this from the main thread.
     */
    fun setShuffleEnabled(enabled: Boolean) {
        val player = getPlayer() ?: return
        isShuffleEnabled = enabled
        GeneralStorage.saveShuffleMode(enabled)

        if (enabled) {
            playedIds.clear()
            // Store original order before shuffling if not already stored
            if (originalOrder == null) {
                val currentIds = (0 until player.mediaItemCount).map { player.getMediaItemAt(it).mediaId }
                originalOrder = currentIds
                GeneralStorage.saveOriginalOrder(currentIds)
            }
            reshuffleQueue()
        } else {
            playedIds.clear()
            // Restore original order if we have it
            val orderToRestore = originalOrder ?: GeneralStorage.getOriginalOrder()
            orderToRestore?.let { restoreOriginalQueue(it) }
            originalOrder = null
            GeneralStorage.clearOriginalOrder()
            // Disable Media3's own shuffle flag too (we never set it true, but be defensive)
            player.shuffleModeEnabled = false
        }
    }

    /**
     * Restores the shuffle-enabled flag on cold-start WITHOUT physically reshuffling the queue.
     * The saved queue is already in the shuffled order that was persisted before the app closed.
     */
    fun restoreShuffleEnabled(enabled: Boolean) {
        isShuffleEnabled = enabled
        if (enabled) {
            originalOrder = GeneralStorage.getOriginalOrder()
        } else {
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
     * Restores the physical queue to the provided order.
     */
    private fun restoreOriginalQueue(targetIds: List<String>) {
        val player = getPlayer() ?: return
        val count = player.mediaItemCount
        if (count <= 1) return

        isReshuffling = true
        try {
            var nextInsertPos = 0
            for (id in targetIds) {
                for (j in nextInsertPos until count) {
                    if (player.getMediaItemAt(j).mediaId == id) {
                        if (j != nextInsertPos) {
                            player.moveMediaItem(j, nextInsertPos)
                        }
                        nextInsertPos++
                        break
                    }
                }
            }
        } finally {
            isReshuffling = false
        }
        Log.d("ShuffleManager", "Queue restored to original order")
    }

    /**
     * Physically reorders the player's MediaItem list:
     * current track → index 0, rest shuffled randomly.
     * Uses moveMediaItem to ensure seamless playback without resetting the player.
     */
    private fun reshuffleQueue() {
        val player = getPlayer() ?: return
        val count = player.mediaItemCount
        if (count <= 1) return

        val currentIndex = player.currentMediaItemIndex
        val items = (0 until count).map { player.getMediaItemAt(it) }.toMutableList()

        // 1. Prepare the target shuffled list
        val current = items.removeAt(currentIndex)
        items.shuffle()
        val targetList = listOf(current) + items

        isReshuffling = true
        try {
            // 2. Align the physical queue with targetList using moveMediaItem
            // We iterate through targetList and move the corresponding item in the player to position 'i'
            for (i in 0 until count) {
                val targetId = targetList[i].mediaId
                // Find where this item is currently in the player's timeline
                for (j in i until count) {
                    if (player.getMediaItemAt(j).mediaId == targetId) {
                        if (i != j) {
                            player.moveMediaItem(j, i)
                        }
                        break
                    }
                }
            }
        } finally {
            isReshuffling = false
        }

        // Ensure Media3's own shuffle traversal is off — we manage order ourselves
        player.shuffleModeEnabled = false

        Log.d("ShuffleManager", "Queue reshuffled smoothly: ${targetList.map { it.mediaId }}")
    }
}

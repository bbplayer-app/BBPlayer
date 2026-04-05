package expo.modules.orpheus.service

import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.source.ShuffleOrder.DefaultShuffleOrder
import androidx.media3.exoplayer.ExoPlayer
import expo.modules.orpheus.util.GeneralStorage

/**
 * Manages shuffle mode for Orpheus using Media3's built-in shuffle functionality.
 *
 * Instead of physically reordering the MediaItem list (which is O(n²) with moveMediaItem
 * and causes severe performance issues on large queues), this class delegates shuffle
 * traversal to Media3's internal ShuffleOrder via player.shuffleModeEnabled.
 *
 * We also maintain full control over the shuffle traversal order by explicitly calling
 * player.setShuffleOrder(DefaultShuffleOrder(...)) so that:
 *  - getTraversalOrder() can return the exact logical playback sequence to the UI.
 *  - repositionAsNext() can guarantee that a specific track plays immediately after
 *    the current one, regardless of where it sits in the physical queue.
 *
 * Behaviour:
 *  - On enable: generates a random permutation (current item first) and sets it via
 *    setShuffleOrder; then sets shuffleModeEnabled = true.
 *  - On disable: sets shuffleModeEnabled = false. Physical queue order is never touched.
 *  - getTraversalOrder(): reads the live shuffle traversal from the timeline (O(n)).
 *  - repositionAsNext(physicalIdx): moves physicalIdx to the position right after the
 *    current track in the shuffle traversal, then calls setShuffleOrder to persist it.
 */
@OptIn(UnstableApi::class)
class ShuffleManager(private val getPlayer: () -> ExoPlayer?) {

    private var isShuffleEnabled = false

    val isEnabled: Boolean get() = isShuffleEnabled

    /**
     * Enable or disable shuffle mode.
     * Call this from the main thread.
     */
    fun setShuffleEnabled(enabled: Boolean) {
        val player = getPlayer() ?: return
        isShuffleEnabled = enabled
        GeneralStorage.saveShuffleMode(enabled)

        if (enabled) {
            val count = player.mediaItemCount
            val currentPhysical = player.currentMediaItemIndex
            // Build a shuffled order with the current item first so it isn't skipped.
            val others = (0 until count).filter { it != currentPhysical }.shuffled()
            val order = (listOf(currentPhysical) + others).toIntArray()
            player.setShuffleOrder(DefaultShuffleOrder(order, System.currentTimeMillis()))
        }

        player.shuffleModeEnabled = enabled
        Log.d("ShuffleManager", "Shuffle mode set to: $enabled")
    }

    /**
     * Restores the shuffle-enabled flag on cold-start without regenerating the order.
     * Media3 will create a fresh random ShuffleOrder for the restored items.
     */
    fun restoreShuffleEnabled(enabled: Boolean) {
        isShuffleEnabled = enabled
        getPlayer()?.shuffleModeEnabled = enabled
    }

    /**
     * Returns the full shuffle traversal as an array of physical indices.
     * E.g. [3, 1, 0, 2] means: play physical-item-3 first, then 1, then 0, then 2.
     * Returns null when shuffle is disabled or the player is unavailable.
     */
    fun getTraversalOrder(): IntArray? {
        if (!isShuffleEnabled) return null
        val player = getPlayer() ?: return null
        val count = player.mediaItemCount
        if (count == 0) return IntArray(0)

        val timeline = player.currentTimeline
        val result = mutableListOf<Int>()
        var idx = timeline.getFirstWindowIndex(true)
        while (idx != C.INDEX_UNSET) {
            result.add(idx)
            // Use REPEAT_MODE_OFF so we traverse each item exactly once (no infinite loop).
            idx = timeline.getNextWindowIndex(idx, Player.REPEAT_MODE_OFF, true)
        }

        // Safety: if traversal doesn't cover all items, fall back to physical order.
        if (result.size != count) {
            Log.w("ShuffleManager", "Traversal size mismatch: got ${result.size}, expected $count")
            return (0 until count).toList().toIntArray()
        }

        return result.toIntArray()
    }

    /**
     * Moves the item at [insertedPhysicalIndex] to play immediately after the current
     * track in the shuffle traversal, then commits the new order via setShuffleOrder.
     *
     * Call this AFTER the item has been added to (or moved within) the player queue.
     */
    fun repositionAsNext(insertedPhysicalIndex: Int) {
        if (!isShuffleEnabled) return
        val player = getPlayer() ?: return
        val currentPhysical = player.currentMediaItemIndex

        // Read the live traversal (includes the newly inserted item at a random position).
        val order = getTraversalOrder()?.toMutableList() ?: return

        // Remove the item from wherever Media3 placed it.
        order.remove(insertedPhysicalIndex)

        // Insert it right after the current track's traversal position.
        val currentPos = order.indexOf(currentPhysical)
        if (currentPos == -1) {
            // The current item should always appear in the traversal. If it doesn't,
            // the shuffle state is inconsistent — bail out rather than silently appending.
            Log.e("ShuffleManager", "Current physical[$currentPhysical] not found in traversal; skipping repositionAsNext")
            return
        }
        order.add(currentPos + 1, insertedPhysicalIndex)

        player.setShuffleOrder(DefaultShuffleOrder(order.toIntArray(), System.currentTimeMillis()))
        Log.d("ShuffleManager", "Repositioned physical[$insertedPhysicalIndex] as next in shuffle order")
    }
}

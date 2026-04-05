package expo.modules.orpheus.service

import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import expo.modules.orpheus.util.GeneralStorage

/**
 * Manages shuffle mode for Orpheus using Media3's built-in shuffle functionality.
 *
 * Instead of physically reordering the MediaItem list (which is O(n²) with moveMediaItem
 * and causes severe performance issues on large queues), this class delegates shuffle
 * traversal to Media3's internal ShuffleOrder via player.shuffleModeEnabled.
 *
 * Behaviour:
 *  - On enable: sets player.shuffleModeEnabled = true. Media3 handles shuffle traversal.
 *  - On disable: sets player.shuffleModeEnabled = false. Media3 traverses in natural order.
 *  - The physical queue order is never modified, so there are no timeline change events
 *    fired during shuffle toggle.
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
        player.shuffleModeEnabled = enabled
        Log.d("ShuffleManager", "Shuffle mode set to: $enabled")
    }

    /**
     * Restores the shuffle-enabled flag on cold-start.
     */
    fun restoreShuffleEnabled(enabled: Boolean) {
        isShuffleEnabled = enabled
        getPlayer()?.shuffleModeEnabled = enabled
    }
}

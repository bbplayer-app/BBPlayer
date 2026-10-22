package expo.modules.orpheus.util

import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer

/** 轮询负责 B 点，末尾暂停负责防止曲尾抢先切歌。用户的 repeatMode 不受影响。 */
@OptIn(UnstableApi::class)
class AbLoopController(
    private val player: ExoPlayer,
    private val onLoop: (Double, Double) -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())
    private var loop: GeneralStorage.AbLoopRecord? = null
    private var previousPauseAtEnd = false
    private var internalSeekPending = false
    private val checkRunnable = object : Runnable {
        override fun run() {
            enforce()
            if (loop != null && player.isPlaying) handler.postDelayed(this, 100L)
        }
    }

    fun set(trackId: String, startSec: Double, endSec: Double): Boolean {
        if (player.currentMediaItem?.mediaId != trackId ||
            !startSec.isFinite() || !endSec.isFinite() || startSec < 0 || endSec <= startSec ||
            (player.duration != C.TIME_UNSET && player.duration > 0 && endSec > player.duration / 1000.0)
        ) return false
        if (loop == null) previousPauseAtEnd = player.pauseAtEndOfMediaItems
        loop = GeneralStorage.AbLoopRecord(trackId, startSec, endSec)
        player.pauseAtEndOfMediaItems = true
        startRunner()
        return true
    }

    fun get(): GeneralStorage.AbLoopRecord? = loop?.takeIf { it.trackId == player.currentMediaItem?.mediaId }

    fun clear() {
        if (loop != null) player.pauseAtEndOfMediaItems = previousPauseAtEnd
        loop = null
        internalSeekPending = false
        stopRunner()
    }

    fun syncTrack(trackId: String?): Boolean {
        if (loop?.trackId != trackId) clear()
        return get() != null
    }

    fun consumeInternalSeek(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int): Boolean {
        val pending = internalSeekPending
        internalSeekPending = false
        val current = get() ?: return false
        return pending && reason == Player.DISCONTINUITY_REASON_SEEK &&
            oldPosition.mediaItem?.mediaId == current.trackId && newPosition.mediaItem?.mediaId == current.trackId &&
            newPosition.positionMs == (current.startSec * 1000).toLong()
    }

    fun startRunner() {
        stopRunner()
        if (get() != null && player.isPlaying) handler.post(checkRunnable)
    }

    fun stopRunner() { handler.removeCallbacks(checkRunnable) }

    fun handleEndOfItem(): Boolean {
        if (get() == null) return false
        jumpToStart(resume = true)
        return true
    }

    private fun enforce() {
        val current = get() ?: return
        if (player.isPlaying && player.currentPosition / 1000.0 >= current.endSec) jumpToStart(resume = false)
    }

    private fun jumpToStart(resume: Boolean) {
        val current = get() ?: return
        onLoop(player.currentPosition / 1000.0, current.startSec)
        internalSeekPending = true
        player.seekTo((current.startSec * 1000).toLong())
        if (resume) player.play()
    }
}

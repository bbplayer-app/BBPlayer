/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.internal.player

import android.media.session.PlaybackState
import android.os.Build
import android.os.SharedMemory
import android.util.Log
import androidx.annotation.RequiresApi
import io.github.proify.lyricon.lyric.model.Song
import io.github.proify.lyricon.provider.IRemotePlayer
import io.github.proify.lyricon.provider.RemotePlayer
import io.github.proify.lyricon.provider.internal.wire.deflate
import io.github.proify.lyricon.provider.internal.wire.json
import java.nio.ByteBuffer

/**
 * [RemotePlayer] 的 Binder 通道实现。
 *
 * 普通播放器命令通过 [IRemotePlayer] 发送，播放进度写入共享内存，减少高频 Binder 调用。
 */
@RequiresApi(Build.VERSION_CODES.O_MR1)
internal class AidlRemotePlayer : RemotePlayer {

    /** 当前连接状态是否允许发送播放器命令（由连接端点随状态转移更新）。 */
    @Volatile
    var isSendingEnabled: Boolean = false

    /** 远端播放器 AIDL 代理，null 表示未连接。 */
    private var remotePlayer: IRemotePlayer? = null

    /** 中心服务返回的共享内存句柄。 */
    private var positionSharedMemory: SharedMemory? = null

    /** [positionSharedMemory] 的读写映射缓冲。 */
    private var positionBuffer: ByteBuffer? = null

    override val isActive: Boolean
        get() = remotePlayer?.asBinder()?.isBinderAlive == true

    /**
     * 绑定或清空远端播放器 Binder。
     *
     * 会同时重建位置共享内存映射；映射失败时立即关闭已取得的共享内存，避免泄漏。
     *
     * @param player 远端播放器，null 表示清空。
     */
    fun attachPlayer(player: IRemotePlayer?) {
        detachPositionMemory()
        remotePlayer = player
        positionSharedMemory = runCatching { player?.positionMemory }
            .onFailure { Log.e(TAG, "Failed to get position memory", it) }
            .getOrNull()
        positionBuffer = try {
            positionSharedMemory?.mapReadWrite()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to map position memory", e)
            positionSharedMemory?.close()
            positionSharedMemory = null
            null
        }
    }

    override fun setSong(song: Song?): Boolean = send {
        setSong(song?.let { json.encodeToString(it).toByteArray().deflate() })
    }

    override fun setPlaybackState(playing: Boolean): Boolean = send {
        setPlaybackState(playing)
    }

    override fun seekTo(position: Long): Boolean = send {
        seekTo(position.coerceAtLeast(0L))
    }

    override fun setPosition(position: Long): Boolean {
        if (!isSendingEnabled) return false

        return try {
            positionBuffer?.putLong(0, position.coerceAtLeast(0L))
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to write position", e)
            false
        }
    }

    override fun setPositionUpdateInterval(interval: Int): Boolean = send {
        setPositionUpdateInterval(interval.coerceAtLeast(0))
    }

    override fun sendText(text: String?): Boolean = send {
        sendText(text)
    }

    override fun setDisplayTranslation(isDisplayTranslation: Boolean): Boolean = send {
        setDisplayTranslation(isDisplayTranslation)
    }

    override fun setDisplayRoma(isDisplayRoma: Boolean): Boolean = send {
        setDisplayRoma(isDisplayRoma)
    }

    override fun setPlaybackState(state: PlaybackState?): Boolean = send {
        setPlaybackState2(state)
    }

    /**
     * 在允许发送且已连接时执行一次远端命令。
     *
     * @return 命令是否成功发出。
     */
    private inline fun send(block: IRemotePlayer.() -> Unit): Boolean {
        val player = remotePlayer
        if (!isSendingEnabled || player == null) return false

        return try {
            block(player)
            true
        } catch (it: Exception) {
            Log.e(TAG, "Failed to send player command", it)
            false
        }
    }

    /** 关闭位置共享内存映射并释放句柄。 */
    private fun detachPositionMemory() {
        positionBuffer = null
        positionSharedMemory?.close()
        positionSharedMemory = null
    }

    private companion object {
        private const val TAG = "AidlRemotePlayer"
    }
}

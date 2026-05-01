/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.impl

import android.media.session.PlaybackState
import android.os.Build
import android.os.SharedMemory
import android.util.Log
import androidx.annotation.RequiresApi
import io.github.proify.lyricon.lyric.model.Song
import io.github.proify.lyricon.provider.IRemotePlayer
import io.github.proify.lyricon.provider.RemotePlayer
import io.github.proify.lyricon.provider.deflate
import io.github.proify.lyricon.provider.json
import java.nio.ByteBuffer

/**
 * [RemotePlayer] 的 Binder 代理实现。
 *
 * 普通播放器命令通过 [IRemotePlayer] 发送，播放进度写入共享内存，减少高频 Binder 调用。
 */
@RequiresApi(Build.VERSION_CODES.O_MR1)
internal class RemotePlayerProxy : RemotePlayer {
    /** 当前连接状态是否允许发送播放器命令。 */
    @Volatile
    var allowSending: Boolean = false

    private var remotePlayer: IRemotePlayer? = null
    private var positionMemory: SharedMemory? = null
    private var positionBuffer: ByteBuffer? = null

    override val isActive: Boolean
        get() = remotePlayer?.asBinder()?.isBinderAlive == true

    /** 绑定或清空远端播放器 Binder。 */
    fun bindRemoteService(player: IRemotePlayer?) {
        closePositionMemory()
        remotePlayer = player
        positionMemory = runCatching { player?.positionMemory }
            .onFailure { Log.e(TAG, "Failed to get position memory", it) }
            .getOrNull()
        positionBuffer = runCatching { positionMemory?.mapReadWrite() }
            .onFailure { Log.e(TAG, "Failed to map position memory", it) }
            .getOrNull()
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
        if (!allowSending) return false

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

    private inline fun send(block: IRemotePlayer.() -> Unit): Boolean {
        val player = remotePlayer
        if (!allowSending || player == null) return false

        return try {
            block(player)
            true
        } catch (it: Exception) {
            Log.e(TAG, "Failed to send player command", it)
            false
        }
    }

    private fun closePositionMemory() {
        positionBuffer = null
        positionMemory?.close()
        positionMemory = null
    }

    private companion object {
        private const val TAG = "RemotePlayerProxy"
    }
}

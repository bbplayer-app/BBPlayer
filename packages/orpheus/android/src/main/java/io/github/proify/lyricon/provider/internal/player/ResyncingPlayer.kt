/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.internal.player

import android.media.session.PlaybackState
import io.github.proify.lyricon.lyric.model.Song
import io.github.proify.lyricon.provider.RemotePlayer

/**
 * [RemotePlayer] 的装饰器实现，支持断线重连后的状态恢复。
 *
 * 内部维护不可变的 [PlayerSessionSnapshot]。当远程连接断开时，外部调用仍能更新快照；
 * 当连接恢复并调用 [sync] 时，快照会被整体回放到远端通道。
 *
 * @property channel 实际的远端播放器通道。
 */
internal class ResyncingPlayer(
    private val channel: RemotePlayer,
) : RemotePlayer {

    /** 当前的播放会话快照；对外始终是一致的一份。 */
    @Volatile
    private var snapshot: PlayerSessionSnapshot = PlayerSessionSnapshot.EMPTY

    /** 快照读改写互斥锁，防止并发写入丢更新。 */
    private val updateLock = Any()

    /**
     * 串行化地执行一次快照更新。
     *
     * @param transform 基于当前快照产生新快照的转换函数。
     */
    private inline fun commit(transform: (PlayerSessionSnapshot) -> PlayerSessionSnapshot) {
        synchronized(updateLock) {
            snapshot = transform(snapshot)
        }
    }

    /** 将当前快照整体回放到远端通道。 */
    fun sync() {
        snapshot.replayTo(channel)
    }

    override val isActive: Boolean
        get() = channel.isActive

    override fun setSong(song: Song?): Boolean {
        commit { it.copy(lyric = LyricContent.SongPayload(song)) }
        return channel.setSong(song)
    }

    override fun setPlaybackState(playing: Boolean): Boolean {
        commit { current ->
            current.copy(
                playback = PlaybackSync.Manual(
                    playing = playing,
                    position = current.playback.position
                )
            )
        }
        return channel.setPlaybackState(playing)
    }

    override fun seekTo(position: Long): Boolean {
        commit { current ->
            current.copy(playback = current.playback.withPosition(position.coerceAtLeast(0L)))
        }
        return channel.seekTo(position)
    }

    override fun setPosition(position: Long): Boolean {
        commit { current ->
            current.copy(playback = current.playback.withPosition(position.coerceAtLeast(0L)))
        }
        return channel.setPosition(position)
    }

    override fun setPositionUpdateInterval(interval: Int): Boolean {
        commit { it.copy(positionUpdateInterval = interval) }
        return channel.setPositionUpdateInterval(interval)
    }

    override fun sendText(text: String?): Boolean {
        commit { it.copy(lyric = LyricContent.TextPayload(text)) }
        return channel.sendText(text)
    }

    override fun setDisplayTranslation(isDisplayTranslation: Boolean): Boolean {
        commit { it.copy(displayTranslation = isDisplayTranslation) }
        return channel.setDisplayTranslation(isDisplayTranslation)
    }

    override fun setDisplayRoma(isDisplayRoma: Boolean): Boolean {
        commit { it.copy(displayRoma = isDisplayRoma) }
        return channel.setDisplayRoma(isDisplayRoma)
    }

    override fun setPlaybackState(state: PlaybackState?): Boolean {
        commit { current ->
            current.copy(
                playback = PlaybackSync.PlaybackStateDriven(
                    state = state,
                    playing = current.playback.playing,
                    position = current.playback.position
                )
            )
        }
        return channel.setPlaybackState(state)
    }
}

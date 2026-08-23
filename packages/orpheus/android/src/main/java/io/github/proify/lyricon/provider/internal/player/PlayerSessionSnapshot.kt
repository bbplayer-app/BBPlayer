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
 * 当前歌词内容：歌曲与纯文本互斥，只保留最后一次设置的内容。
 */
internal sealed interface LyricContent {

    /** 最近一次设置的歌曲，null 表示清空。 */
    data class SongPayload(val song: Song?) : LyricContent

    /** 最近一次发送的纯文本，null 表示清空。 */
    data class TextPayload(val text: String?) : LyricContent

    /** 尚未设置过任何歌词内容。 */
    data object Empty : LyricContent
}

/**
 * 播放状态同步模式：由最后调用的 [RemotePlayer.setPlaybackState] 重载决定。
 *
 * 手动模式下由提供端上报播放状态和位置；状态驱动模式下由中心服务根据
 * [PlaybackState] 计算实时位置。两种模式都保留最近一次手动上报的播放状态与位置，
 * 便于模式切换后保持上下文。
 */
internal sealed interface PlaybackSync {

    /** 最近一次手动上报的播放状态。 */
    val playing: Boolean

    /** 最近一次手动上报的播放位置（毫秒）。 */
    val position: Long

    /** 手动上报：播放状态与位置都由提供端决定。 */
    data class Manual(
        override val playing: Boolean,
        override val position: Long,
    ) : PlaybackSync {
        override fun withPosition(position: Long): PlaybackSync = copy(position = position)
    }

    /** 由 [PlaybackState] 驱动；同时保留手动上下文，null 表示停止使用该模式。 */
    data class PlaybackStateDriven(
        val state: PlaybackState?,
        override val playing: Boolean,
        override val position: Long,
    ) : PlaybackSync {
        override fun withPosition(position: Long): PlaybackSync = copy(position = position)
    }

    /** 返回带新位置的同模式同步状态。 */
    fun withPosition(position: Long): PlaybackSync
}

/**
 * 播放器会话快照（不可变）。
 *
 * 每个 [RemotePlayer] 写入都产生一个新快照；断线重连时把当前快照整体回放到远端，
 * 避免多个分散字段的状态不一致。
 *
 * @property lyric 最近的歌词内容。
 * @property playback 最近的播放状态同步模式。
 * @property positionUpdateInterval 位置更新间隔，-1 表示未设置。
 * @property displayTranslation 翻译显示配置，null 表示未设置。
 * @property displayRoma 罗马音显示配置，null 表示未设置。
 */
internal data class PlayerSessionSnapshot(
    val lyric: LyricContent = LyricContent.Empty,
    val playback: PlaybackSync = PlaybackSync.Manual(playing = false, position = 0L),
    val positionUpdateInterval: Int = -1,
    val displayTranslation: Boolean? = null,
    val displayRoma: Boolean? = null,
) {

    /** 将快照内容按原有同步顺序回放到 [target]。 */
    fun replayTo(target: RemotePlayer) {
        if (positionUpdateInterval >= 0) {
            target.setPositionUpdateInterval(positionUpdateInterval)
        }
        displayTranslation?.let { target.setDisplayTranslation(it) }
        displayRoma?.let { target.setDisplayRoma(it) }

        when (val content = lyric) {
            is LyricContent.SongPayload -> target.setSong(content.song)
            is LyricContent.TextPayload -> target.sendText(content.text)
            LyricContent.Empty -> Unit
        }

        when (val sync = playback) {
            is PlaybackSync.Manual -> {
                target.setPlaybackState(sync.playing)
                target.seekTo(sync.position)
            }

            is PlaybackSync.PlaybackStateDriven -> target.setPlaybackState(sync.state)
        }
    }

    companion object {
        /** 空快照，即尚未设置任何播放上下文。 */
        val EMPTY = PlayerSessionSnapshot()
    }
}

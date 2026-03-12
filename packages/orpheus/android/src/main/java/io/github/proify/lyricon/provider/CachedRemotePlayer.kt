/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import io.github.proify.lyricon.lyric.model.Song

/**
 * [RemotePlayer] 的装饰器实现，支持断线重连后的状态恢复。
 * * 内部公开维护最近一次设置的播放上下文。当远程连接断开时，外部调用仍能更新这些缓存值；
 * 当连接恢复并调用 [syncs] 时，缓存的状态将原子化地同步至远程播放器。
 *
 * @property player 实际的远程播放器实例。
 */
class CachedRemotePlayer(
    val player: RemotePlayer
) : RemotePlayer {

    /** 最近设置的歌曲（发送纯文本后会被清空） */
    @Volatile
    var lastSong: Song? = null
        private set

    /** 最近的播放状态（正在播放为 true） */
    @Volatile
    var lastPlaybackState: Boolean = false
        private set

    /** 最近的播放位置（毫秒） */
    @Volatile
    var lastPosition: Long = 0
        private set

    /** 最近设置的位置更新间隔（毫秒） */
    @Volatile
    var lastPositionUpdateInterval: Int = -1
        private set

    /** 最近发送的文本内容（设置歌曲对象后会被清空） */
    @Volatile
    var lastText: String? = null
        private set

    /** 是否显示翻译内容 */
    @Volatile
    var lastDisplayTranslation: Boolean? = null
        private set

    /** 最近的显示罗马音 */
    @Volatile
    var lastDisplayRoma: Boolean? = null

    @Volatile
    private var lastLyricType = LastLyricType.NONE

    private enum class LastLyricType {
        SONG, TEXT, NONE
    }

    /**
     * 根据当前缓存的状态同步至 [player]。
     */
    @Synchronized
    internal fun syncs() {
        player.setPlaybackState(lastPlaybackState)

        val interval = lastPositionUpdateInterval
        if (interval >= 0) {
            player.setPositionUpdateInterval(interval)
        }

        lastDisplayTranslation?.let { player.setDisplayTranslation(it) }
        lastDisplayRoma?.let { player.setDisplayRoma(it) }

        when (lastLyricType) {
            LastLyricType.SONG -> player.setSong(lastSong)
            LastLyricType.TEXT -> player.sendText(lastText)
            else -> Unit
        }

        player.seekTo(lastPosition.coerceAtLeast(0))
    }

    override val isActive: Boolean get() = player.isActive

    override fun setSong(song: Song?): Boolean {
        lastLyricType = LastLyricType.SONG
        lastSong = song
        return player.setSong(song)
    }

    override fun setPlaybackState(playing: Boolean): Boolean {
        lastPlaybackState = playing
        return player.setPlaybackState(playing)
    }

    override fun seekTo(position: Long): Boolean {
        lastPosition = position
        return player.seekTo(position)
    }

    override fun setPosition(position: Long): Boolean {
        lastPosition = position
        return player.setPosition(position)
    }

    override fun setPositionUpdateInterval(interval: Int): Boolean {
        lastPositionUpdateInterval = interval
        return player.setPositionUpdateInterval(interval)
    }

    override fun sendText(text: String?): Boolean {
        lastLyricType = LastLyricType.TEXT
        lastText = text
        return player.sendText(text)
    }

    override fun setDisplayTranslation(displayTranslation: Boolean): Boolean {
        lastDisplayTranslation = displayTranslation
        return player.setDisplayTranslation(displayTranslation)
    }

    override fun setDisplayRoma(displayRoma: Boolean): Boolean {
        lastDisplayRoma = displayRoma
        return player.setDisplayRoma(displayRoma)
    }
}
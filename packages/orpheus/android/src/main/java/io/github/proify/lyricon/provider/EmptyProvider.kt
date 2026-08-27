/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import android.media.session.PlaybackState
import io.github.proify.lyricon.lyric.model.Song
import io.github.proify.lyricon.provider.service.RemoteService

/** 不支持当前运行环境时返回的提供端空实现。 */
class EmptyProvider(override val providerInfo: ProviderInfo) : LyriconProvider {
    override val service: RemoteService = EmptyRemoteService
    override val player = service.player
    override var autoSync: Boolean = true
    override var providerService: ProviderService? = null
    override fun register(): Boolean = false
    override fun unregister() = false
    override fun destroy() = false

    /** 空远端服务：所有操作均无效果。 */
    private object EmptyRemoteService : RemoteService {
        override val player: RemotePlayer = EmptyRemotePlayer
        override val isActive: Boolean = false
        override val connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED
        override fun addConnectionListener(listener: ConnectionListener): Boolean = false
        override fun removeConnectionListener(listener: ConnectionListener): Boolean = false
    }

    /** 空远端播放器：所有发送均返回 false。 */
    private object EmptyRemotePlayer : RemotePlayer {
        override val isActive: Boolean = false
        override fun setSong(song: Song?): Boolean = false
        override fun setPlaybackState(playing: Boolean): Boolean = false
        override fun seekTo(position: Long): Boolean = false
        override fun setPosition(position: Long): Boolean = false
        override fun setPositionUpdateInterval(interval: Int): Boolean = false
        override fun sendText(text: String?): Boolean = false
        override fun setDisplayTranslation(isDisplayTranslation: Boolean): Boolean = false
        override fun setDisplayRoma(isDisplayRoma: Boolean): Boolean = false
        override fun setPlaybackState(state: PlaybackState?): Boolean = false
    }
}
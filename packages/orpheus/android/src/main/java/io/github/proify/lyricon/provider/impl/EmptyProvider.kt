/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.impl

import android.media.session.PlaybackState
import io.github.proify.lyricon.lyric.model.Song
import io.github.proify.lyricon.provider.ConnectionListener
import io.github.proify.lyricon.provider.ConnectionStatus
import io.github.proify.lyricon.provider.LyriconProvider
import io.github.proify.lyricon.provider.ProviderInfo
import io.github.proify.lyricon.provider.ProviderService
import io.github.proify.lyricon.provider.RemotePlayer
import io.github.proify.lyricon.provider.service.RemoteService

class EmptyProvider(override val providerInfo: ProviderInfo) : LyriconProvider {
    override val service: RemoteService = EmptyRemoteService
    override val player = service.player
    override var autoSync: Boolean = true
    override var providerService: ProviderService? = null
    override fun register(): Boolean = false
    override fun unregister() = false
    override fun destroy() = false

    private object EmptyRemoteService : RemoteService {
        override val player: RemotePlayer = EmptyRemotePlayer
        override val isActive: Boolean = false
        override val connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED
        override fun addConnectionListener(listener: ConnectionListener): Boolean = false
        override fun removeConnectionListener(listener: ConnectionListener): Boolean = false
    }

    private object EmptyRemotePlayer : RemotePlayer {
        override val isActive: Boolean = false
        override fun setSong(song: Song?): Boolean = false
        override fun setPlaybackState(playing: Boolean): Boolean = false
        override fun seekTo(position: Long): Boolean = false
        override fun setPosition(position: Long): Boolean = false
        override fun setPositionUpdateInterval(interval: Int): Boolean = false
        override fun sendText(text: String?): Boolean = false
        override fun setDisplayTranslation(displayTranslation: Boolean): Boolean = false
        override fun setDisplayRoma(displayRoma: Boolean): Boolean = false
        override fun setPlaybackState(state: PlaybackState?): Boolean = false
    }
}
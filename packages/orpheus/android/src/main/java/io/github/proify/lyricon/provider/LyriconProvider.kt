/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import io.github.proify.lyricon.provider.service.RemoteService

/**
 * @see [LyriconFactory]
 */
interface LyriconProvider {
    val providerInfo: ProviderInfo
    val service: RemoteService
    val player: RemotePlayer
    var autoSync: Boolean
    var providerService: ProviderService?
    fun register(): Boolean
    fun unregister(): Boolean
    fun destroy(): Boolean
}
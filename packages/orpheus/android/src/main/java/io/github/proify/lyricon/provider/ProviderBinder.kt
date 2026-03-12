/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import io.github.proify.lyricon.provider.service.RemoteServiceBinder
import kotlinx.serialization.encodeToString
import java.util.concurrent.CopyOnWriteArraySet

internal class ProviderBinder(
    val provider: LyriconProvider,
    val localProviderService: LocalProviderService,
    val remoteServiceBinder: RemoteServiceBinder<IRemoteService?>?
) : IProviderBinder.Stub() {
    private val registrationCallbacks = CopyOnWriteArraySet<OnRegistrationCallback>()

    val providerInfoByteArray by lazy {
        json.encodeToString(provider.providerInfo).toByteArray()
    }

    fun addRegistrationCallback(callback: OnRegistrationCallback) =
        registrationCallbacks.add(callback)

    fun removeRegistrationCallback(callback: OnRegistrationCallback) =
        registrationCallbacks.remove(callback)

    override fun onRegistrationCallback(remoteProviderService: IRemoteService?) {
        remoteServiceBinder?.bindRemoteService(remoteProviderService)
        registrationCallbacks.forEach { it.onRegistered() }
    }

    override fun getProviderService(): IProviderService = localProviderService
    override fun getProviderInfo(): ByteArray = providerInfoByteArray

    interface OnRegistrationCallback {
        fun onRegistered()
    }
}
/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.impl

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.core.os.bundleOf
import io.github.proify.lyricon.provider.CentralServiceReceiver
import io.github.proify.lyricon.provider.ConnectionListener
import io.github.proify.lyricon.provider.ConnectionStatus
import io.github.proify.lyricon.provider.LocalProviderService
import io.github.proify.lyricon.provider.LyriconProvider
import io.github.proify.lyricon.provider.ProviderBinder
import io.github.proify.lyricon.provider.ProviderConstants
import io.github.proify.lyricon.provider.ProviderConstants.ACTION_REGISTER_PROVIDER
import io.github.proify.lyricon.provider.ProviderConstants.EXTRA_BINDER
import io.github.proify.lyricon.provider.ProviderInfo
import io.github.proify.lyricon.provider.ProviderService
import io.github.proify.lyricon.provider.RemotePlayer
import io.github.proify.lyricon.provider.isConnecting
import io.github.proify.lyricon.provider.service.RemoteService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

@RequiresApi(Build.VERSION_CODES.O_MR1)
internal class ProviderV27Impl(
    private val context: Context,
    override val providerInfo: ProviderInfo,
    providerService: ProviderService? = null,
    val centralPackageName: String,
) : LyriconProvider,
    CentralServiceReceiver.ServiceListener,
    ConnectionListener {

    override var providerService: ProviderService? = providerService
        set(value) {
            field = value
            localProviderService.callback = value
        }

    private val localProviderService = LocalProviderService(providerService)
    private val remoteServiceProxy = RemoteServiceProxy(this)

    private val providerBinder = ProviderBinder(
        this,
        localProviderService,
        remoteServiceProxy
    )

    override val service: RemoteService = remoteServiceProxy
    override val player: RemotePlayer
        get() = service.player

    override var autoSync: Boolean = true

    private val destroyed = AtomicBoolean(false)

    private val coroutineScope =
        CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @Volatile
    private var connectionTimeoutJob: Job? = null

    init {
        service.addConnectionListener(this)
        CentralServiceReceiver.addServiceListener(this)
    }

    override fun onServiceBootCompleted() {
        if (remoteServiceProxy.connectionStatus == ConnectionStatus.DISCONNECTED_REMOTE) {
            register()
        }
    }

    override fun register(): Boolean {
        if (destroyed.get()) return false

        return when (remoteServiceProxy.connectionStatus) {
            ConnectionStatus.CONNECTED,
            ConnectionStatus.CONNECTING -> false

            else -> performRegistration()
        }
    }

    private fun performRegistration(): Boolean {
        if (centralPackageName.isBlank()) return false
        if (destroyed.get()) return false

        connectionTimeoutJob?.cancel()
        connectionTimeoutJob = null

        val registrationCallback = object : ProviderBinder.OnRegistrationCallback {
            override fun onRegistered() {
                connectionTimeoutJob?.cancel()
                connectionTimeoutJob = null
                providerBinder.removeRegistrationCallback(this)
            }
        }

        remoteServiceProxy.connectionStatus = ConnectionStatus.CONNECTING

        connectionTimeoutJob = coroutineScope.launch {
            delay(CONNECTION_TIMEOUT_MS)
            if (remoteServiceProxy.connectionStatus.isConnecting()) {
                remoteServiceProxy.connectionStatus = ConnectionStatus.DISCONNECTED
                providerBinder.removeRegistrationCallback(registrationCallback)

                remoteServiceProxy.forEachConnectionListener {
                    it.onConnectTimeout(this@ProviderV27Impl)
                }
            }
        }

        providerBinder.addRegistrationCallback(registrationCallback)

        context.sendBroadcast(
            Intent(ACTION_REGISTER_PROVIDER).apply {
                setPackage(centralPackageName)
                putExtra(
                    ProviderConstants.EXTRA_BUNDLE,
                    bundleOf(EXTRA_BINDER to providerBinder)
                )
            }
        )

        return true
    }

    override fun unregister(): Boolean {
        if (destroyed.get()) return false
        unregisterInternal()
        return true
    }

    private fun unregisterInternal() {
        connectionTimeoutJob?.cancel()
        connectionTimeoutJob = null
        remoteServiceProxy.disconnect(RemoteServiceProxy.DisconnectType.USER)
    }

    override fun destroy(): Boolean {
        if (!destroyed.compareAndSet(false, true)) return false

        connectionTimeoutJob?.cancel()
        connectionTimeoutJob = null

        coroutineScope.cancel()
        unregisterInternal()

        service.removeConnectionListener(this)
        CentralServiceReceiver.removeServiceListener(this)

        return true
    }

    override fun onConnected(provider: LyriconProvider) {
        if (autoSync) remoteServiceProxy.syncs()
    }

    override fun onReconnected(provider: LyriconProvider) {
        if (autoSync) remoteServiceProxy.syncs()
    }

    override fun onDisconnected(provider: LyriconProvider) {
        // no-op
    }

    override fun onConnectTimeout(provider: LyriconProvider) {
        // no-op
    }

    private companion object {
        private const val CONNECTION_TIMEOUT_MS = 4_000L
    }
}
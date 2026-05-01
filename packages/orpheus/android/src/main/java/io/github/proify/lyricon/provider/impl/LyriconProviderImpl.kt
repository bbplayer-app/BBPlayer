/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.impl

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.annotation.RequiresApi
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

/**
 * 默认提供端实现。
 *
 * 负责发送注册广播、处理连接超时、维护本地服务 Binder，并把远端服务交给
 * [ProviderRemoteEndpoint] 管理。
 */
@RequiresApi(Build.VERSION_CODES.O_MR1)
internal class LyriconProviderImpl(
    private val context: Context,
    override val providerInfo: ProviderInfo,
    providerService: ProviderService? = null,
    private val centralPackageName: String,
) : LyriconProvider, ConnectionListener {
    private val destroyed = AtomicBoolean(false)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val localService = LocalProviderService(providerService)
    private val remote = ProviderRemoteEndpoint(this)
    private val registration = Registration()
    private val binder = ProviderBinder(this, localService, remote)

    override var providerService: ProviderService? = providerService
        set(value) {
            field = value
            localService.callback = value
        }

    override val service: RemoteService = remote
    override val player: RemotePlayer get() = service.player
    override var autoSync: Boolean = true

    init {
        service.addConnectionListener(this)
    }

    override fun register(): Boolean = registration.start()

    override fun unregister(): Boolean {
        if (destroyed.get()) return false
        disconnect(ProviderRemoteEndpoint.DisconnectReason.USER)
        return true
    }

    override fun destroy(): Boolean {
        if (!destroyed.compareAndSet(false, true)) return false
        registration.close()
        disconnect(ProviderRemoteEndpoint.DisconnectReason.USER)
        service.removeConnectionListener(this)
        scope.cancel()
        return true
    }

    override fun onConnected(provider: LyriconProvider) {
        if (autoSync) remote.syncPlayer()
    }

    override fun onReconnected(provider: LyriconProvider) {
        if (autoSync) remote.syncPlayer()
    }

    override fun onDisconnected(provider: LyriconProvider) = Unit
    override fun onConnectTimeout(provider: LyriconProvider) = Unit

    private fun disconnect(reason: ProviderRemoteEndpoint.DisconnectReason) {
        registration.cancelTimeout()
        remote.disconnect(reason)
    }

    /** 管理注册广播、超时和中心服务重启后的恢复注册。 */
    private inner class Registration : CentralServiceReceiver.ServiceListener {
        private var timeoutJob: Job? = null
        private val callback = object : ProviderBinder.OnRegistrationCallback {
            override fun onRegistered() {
                cancelTimeout()
                binder.removeRegistrationCallback(this)
            }
        }

        init {
            CentralServiceReceiver.addServiceListener(this)
        }

        fun start(): Boolean {
            if (destroyed.get() || centralPackageName.isBlank()) return false
            if (remote.connectionStatus in setOf(
                    ConnectionStatus.CONNECTED,
                    ConnectionStatus.CONNECTING
                )
            ) {
                return false
            }

            remote.connectionStatus = ConnectionStatus.CONNECTING
            binder.addRegistrationCallback(callback)
            scheduleTimeout()
            context.sendBroadcast(Intent(ACTION_REGISTER_PROVIDER).apply {
                setPackage(centralPackageName)
                putExtra(
                    ProviderConstants.EXTRA_BUNDLE,
                    Bundle().apply {
                        putBinder(EXTRA_BINDER, binder)
                    }
                )
            })
            return true
        }

        override fun onServiceBootCompleted() {
            if (remote.connectionStatus == ConnectionStatus.DISCONNECTED_REMOTE) start()
        }

        fun cancelTimeout() {
            timeoutJob?.cancel()
            timeoutJob = null
        }

        fun close() {
            cancelTimeout()
            binder.removeRegistrationCallback(callback)
            CentralServiceReceiver.removeServiceListener(this)
        }

        private fun scheduleTimeout() {
            cancelTimeout()
            timeoutJob = scope.launch {
                delay(CONNECTION_TIMEOUT_MS)
                if (!remote.connectionStatus.isConnecting()) return@launch
                remote.connectionStatus = ConnectionStatus.DISCONNECTED
                binder.removeRegistrationCallback(callback)
                remote.forEachConnectionListener { it.onConnectTimeout(this@LyriconProviderImpl) }
            }
        }
    }

    private companion object {
        private const val CONNECTION_TIMEOUT_MS = 4_000L
    }
}

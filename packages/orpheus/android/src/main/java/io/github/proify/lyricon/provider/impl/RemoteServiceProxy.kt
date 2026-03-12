/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.impl

import android.os.Build
import android.os.IBinder
import android.os.RemoteException
import android.util.Log
import androidx.annotation.RequiresApi
import io.github.proify.lyricon.provider.CachedRemotePlayer
import io.github.proify.lyricon.provider.ConnectionListener
import io.github.proify.lyricon.provider.ConnectionStatus
import io.github.proify.lyricon.provider.IRemoteService
import io.github.proify.lyricon.provider.LyriconProvider
import io.github.proify.lyricon.provider.ProviderConstants
import io.github.proify.lyricon.provider.RemotePlayer
import io.github.proify.lyricon.provider.isConnected
import io.github.proify.lyricon.provider.service.RemoteService
import io.github.proify.lyricon.provider.service.RemoteServiceBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.CopyOnWriteArraySet

@RequiresApi(Build.VERSION_CODES.O_MR1)
internal class RemoteServiceProxy(
    private val provider: LyriconProvider
) : RemoteService, RemoteServiceBinder<IRemoteService?> {

    private val playerProxy = RemotePlayerProxy()
    private val cachedRemotePlayer = CachedRemotePlayer(playerProxy)
    override val player: RemotePlayer = cachedRemotePlayer

    @Volatile
    override var connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED
        set(value) {
            field = value
            playerProxy.allowSending = value.isConnected()
        }

    @Volatile
    private var iRemoteService: IRemoteService? = null

    private var hasConnectedHistory = false

    private val connectionListeners = CopyOnWriteArraySet<ConnectionListener>()

    private val callbackScope = CoroutineScope(Dispatchers.Main.immediate)

    private val deathRecipient = IBinder.DeathRecipient {
        disconnect(DisconnectType.REMOTE)
    }

    inline fun forEachConnectionListener(block: (ConnectionListener) -> Unit) {
        connectionListeners.forEach(block)
    }

    fun syncs() {
        cachedRemotePlayer.syncs()
    }

    override fun bindRemoteService(service: IRemoteService?) {
        Log.d(TAG, "Bind remote service")

        disconnect(DisconnectType.DEFAULT)

        if (service == null) {
            Log.w(TAG, "Service is null")
            return
        }

        val binder = service.asBinder()
        if (!binder.isBinderAlive) {
            Log.w(TAG, "Binder is not alive")
            return
        }

        try {
            binder.linkToDeath(deathRecipient, 0)
        } catch (e: RemoteException) {
            Log.e(TAG, "Failed to link death recipient", e)
            return
        }

        iRemoteService = service
        playerProxy.bindRemoteService(service.player)

        connectionStatus = ConnectionStatus.CONNECTED

        callbackScope.launch {
            connectionListeners.forEach {
                if (hasConnectedHistory) {
                    it.onReconnected(provider)
                } else {
                    it.onConnected(provider)
                }
            }
            hasConnectedHistory = true
        }
    }

    override val isActive: Boolean
        get() = iRemoteService?.asBinder()?.isBinderAlive == true

    fun disconnect(disconnectType: DisconnectType) {
        connectionStatus = when (disconnectType) {
            DisconnectType.USER -> ConnectionStatus.DISCONNECTED_USER
            DisconnectType.REMOTE -> ConnectionStatus.DISCONNECTED_REMOTE
            DisconnectType.DEFAULT -> ConnectionStatus.DISCONNECTED
        }

        if (ProviderConstants.DEBUG) {
            Log.d(TAG, "Disconnect: $disconnectType")
        }

        playerProxy.bindRemoteService(null)

        val service = iRemoteService
        iRemoteService = null

        service?.let {
            runCatching { it.asBinder().unlinkToDeath(deathRecipient, 0) }
                .onFailure { e -> Log.w(TAG, "Failed to unlink death recipient", e) }

            runCatching { it.disconnect() }
                .onFailure { e -> Log.e(TAG, "Failed to disconnect remote service", e) }

            callbackScope.launch {
                connectionListeners.forEach { listener ->
                    listener.onDisconnected(provider)
                }
            }
        }
    }

    override fun addConnectionListener(listener: ConnectionListener): Boolean =
        connectionListeners.add(listener)

    override fun removeConnectionListener(listener: ConnectionListener): Boolean =
        connectionListeners.remove(listener)

    enum class DisconnectType {
        DEFAULT, // 默认断开
        USER,    // 用户主动断开
        REMOTE   // Binder 死亡断开
    }

    private companion object {
        private const val TAG = "RemoteServiceProxy"
    }
}
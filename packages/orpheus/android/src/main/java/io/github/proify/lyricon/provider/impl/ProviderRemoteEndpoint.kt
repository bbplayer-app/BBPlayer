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

/**
 * 提供端远端连接端点。
 *
 * 负责维护中心服务返回的 [IRemoteService]、监听 Binder 死亡、分发连接状态，
 * 并向外提供缓存后的 [RemotePlayer]。
 */
@RequiresApi(Build.VERSION_CODES.O_MR1)
internal class ProviderRemoteEndpoint(
    private val provider: LyriconProvider,
) : RemoteService, RemoteServiceBinder<IRemoteService?> {
    private val playerProxy = RemotePlayerProxy()
    private val playerCache = CachedRemotePlayer(playerProxy)
    private val listeners = CopyOnWriteArraySet<ConnectionListener>()
    private val callbackScope = CoroutineScope(Dispatchers.Main.immediate)
    private val deathRecipient = IBinder.DeathRecipient { disconnect(DisconnectReason.REMOTE) }

    @Volatile
    private var remoteService: IRemoteService? = null

    private var hasConnectedHistory = false

    override val player: RemotePlayer = playerCache

    @Volatile
    override var connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED
        set(value) {
            field = value
            playerProxy.allowSending = value.isConnected()
        }

    override val isActive: Boolean
        get() = remoteService?.asBinder()?.isBinderAlive == true

    /** 绑定中心服务返回的远端服务 Binder。 */
    override fun bindRemoteService(service: IRemoteService?) {
        if (ProviderConstants.DEBUG) Log.d(TAG, "Bind remote service")
        disconnect(DisconnectReason.REPLACE)

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

        remoteService = service
        playerProxy.bindRemoteService(service.player)
        connectionStatus = ConnectionStatus.CONNECTED
        dispatchConnected()
    }

    /** 将缓存的播放器状态同步到当前远端播放器。 */
    fun syncPlayer() {
        playerCache.syncs()
    }

    /** 遍历当前连接监听器，用于注册超时等外部状态分发。 */
    inline fun forEachConnectionListener(block: (ConnectionListener) -> Unit) {
        listeners.forEach(block)
    }

    /** 按指定原因断开当前远端服务。 */
    fun disconnect(reason: DisconnectReason) {
        connectionStatus = when (reason) {
            DisconnectReason.USER -> ConnectionStatus.DISCONNECTED_USER
            DisconnectReason.REMOTE -> ConnectionStatus.DISCONNECTED_REMOTE
            DisconnectReason.REPLACE -> ConnectionStatus.DISCONNECTED
        }

        if (ProviderConstants.DEBUG) Log.d(TAG, "Disconnect: $reason")
        playerProxy.bindRemoteService(null)

        val service = remoteService ?: return
        remoteService = null

        runCatching { service.asBinder().unlinkToDeath(deathRecipient, 0) }
            .onFailure { Log.w(TAG, "Failed to unlink death recipient", it) }
        runCatching { service.disconnect() }
            .onFailure { Log.e(TAG, "Failed to disconnect remote service", it) }

        callbackScope.launch {
            listeners.forEach { it.onDisconnected(provider) }
        }
    }

    override fun addConnectionListener(listener: ConnectionListener): Boolean =
        listeners.add(listener)

    override fun removeConnectionListener(listener: ConnectionListener): Boolean =
        listeners.remove(listener)

    private fun dispatchConnected() {
        callbackScope.launch {
            listeners.forEach {
                if (hasConnectedHistory) it.onReconnected(provider) else it.onConnected(provider)
            }
            hasConnectedHistory = true
        }
    }

    /** 内部断开原因，用于映射为公开连接状态。 */
    enum class DisconnectReason {
        /** 用户主动断开。 */
        USER,

        /** 远端 Binder 死亡或服务主动断开。 */
        REMOTE,

        /** 新服务绑定前替换旧连接。 */
        REPLACE
    }

    private companion object {
        private const val TAG = "ProviderRemoteEndpoint"
    }
}

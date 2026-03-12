/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.service

import io.github.proify.lyricon.provider.ConnectionListener
import io.github.proify.lyricon.provider.ConnectionStatus
import io.github.proify.lyricon.provider.LyriconProvider
import io.github.proify.lyricon.provider.RemotePlayer

/**
 * 远程服务接口，定义与中心服务的交互。
 */
interface RemoteService {

    /** 播放器控制接口 */
    val player: RemotePlayer

    /** 当前服务是否激活 */
    val isActive: Boolean

    /** 当前连接状态 */
    val connectionStatus: ConnectionStatus

    /**
     * 注册连接状态监听器
     *
     * @param listener 监听器实例
     * @return 是否成功添加
     */
    fun addConnectionListener(listener: ConnectionListener): Boolean

    /**
     * 移除已注册的连接状态监听器
     *
     * @param listener 之前注册的监听器实例
     * @return 是否成功移除
     */
    fun removeConnectionListener(listener: ConnectionListener): Boolean
}

/**
 * 构建连接状态监听器的便捷函数
 *
 * 使用 [ConnectionListenerBuilder] 定义各类事件回调。
 */
fun buildConnectionListener(block: ConnectionListenerBuilder.() -> Unit): ConnectionListener {
    val builder = ConnectionListenerBuilder().apply(block)
    return object : ConnectionListener {
        override fun onConnected(provider: LyriconProvider) {
            builder.onConnected?.invoke(provider)
        }

        override fun onReconnected(provider: LyriconProvider) {
            builder.onReconnected?.invoke(provider)
        }

        override fun onDisconnected(provider: LyriconProvider) {
            builder.onDisconnected?.invoke(provider)
        }

        override fun onConnectTimeout(provider: LyriconProvider) {
            builder.onConnectTimeout?.invoke(provider)
        }
    }
}

/**
 * 扩展函数，向 [RemoteService] 注册连接状态监听器
 *
 * @param block 使用 [ConnectionListenerBuilder] 定义回调
 * @return 注册的监听器实例
 */
fun RemoteService.addConnectionListener(block: ConnectionListenerBuilder.() -> Unit)
        : ConnectionListener {
    val listener = buildConnectionListener(block)
    addConnectionListener(listener)
    return listener
}

/**
 * 连接状态监听器构建器
 *
 * 用于按需设置各类连接状态回调。
 *
 * @property onConnected 服务首次连接回调
 * @property onReconnected 服务重连回调
 * @property onDisconnected 服务断开回调
 * @property onConnectTimeout 连接超时回调
 */
class ConnectionListenerBuilder(
    var onConnected: ((LyriconProvider) -> Unit)? = null,
    var onReconnected: ((LyriconProvider) -> Unit)? = null,
    var onDisconnected: ((LyriconProvider) -> Unit)? = null,
    var onConnectTimeout: ((LyriconProvider) -> Unit)? = null
) {
    fun onConnected(block: (LyriconProvider) -> Unit): ConnectionListenerBuilder =
        apply { onConnected = block }

    fun onReconnected(block: (LyriconProvider) -> Unit): ConnectionListenerBuilder =
        apply { onReconnected = block }

    fun onDisconnected(block: (LyriconProvider) -> Unit): ConnectionListenerBuilder =
        apply { onDisconnected = block }

    fun onConnectTimeout(block: (LyriconProvider) -> Unit): ConnectionListenerBuilder =
        apply { onConnectTimeout = block }
}
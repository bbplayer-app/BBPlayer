/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

@file:Suppress("unused")

package io.github.proify.lyricon.provider

/** 提供端与中心服务之间的连接状态。 */
enum class ConnectionStatus {
    /** 未连接或被内部替换连接。 */
    DISCONNECTED,

    /** 远端 Binder 死亡或中心服务主动断开。 */
    DISCONNECTED_REMOTE,

    /** 用户主动调用 [LyriconProvider.unregister] 断开。 */
    DISCONNECTED_USER,

    /** 注册广播已发送，正在等待中心服务回调。 */
    CONNECTING,

    /** 已完成注册并绑定远端服务。 */
    CONNECTED,
}

/** 是否处于任意断开状态。 */
fun ConnectionStatus.isDisconnected(): Boolean =
    this == ConnectionStatus.DISCONNECTED
            || isDisconnectedByRemote()
            || isDisconnectedByUser()

/** 是否由本地主动断开。 */
fun ConnectionStatus.isDisconnectedByUser(): Boolean = this == ConnectionStatus.DISCONNECTED_USER

/** 是否由远端断开。 */
fun ConnectionStatus.isDisconnectedByRemote(): Boolean =
    this == ConnectionStatus.DISCONNECTED_REMOTE

/** 是否已连接。 */
fun ConnectionStatus.isConnected(): Boolean = this == ConnectionStatus.CONNECTED

/** 是否正在连接。 */
fun ConnectionStatus.isConnecting(): Boolean = this == ConnectionStatus.CONNECTING

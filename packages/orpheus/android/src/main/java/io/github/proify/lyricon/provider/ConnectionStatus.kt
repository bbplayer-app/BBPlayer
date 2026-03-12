/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

@file:Suppress("unused")

package io.github.proify.lyricon.provider

enum class ConnectionStatus {
    /** 未连接 */
    DISCONNECTED,

    /** 已断开连接（服务器主动触发） */
    DISCONNECTED_REMOTE,

    /** 已断开连接（用户主动触发） */
    DISCONNECTED_USER,

    /** 连接中 */
    CONNECTING,

    /** 已连接 */
    CONNECTED,
}

fun ConnectionStatus.isDisconnected(): Boolean =
    this == ConnectionStatus.DISCONNECTED
            || isDisconnectedByRemote()
            || isDisconnectedByUser()

fun ConnectionStatus.isDisconnectedByUser(): Boolean = this == ConnectionStatus.DISCONNECTED_USER
fun ConnectionStatus.isDisconnectedByRemote(): Boolean =
    this == ConnectionStatus.DISCONNECTED_REMOTE

fun ConnectionStatus.isConnected(): Boolean = this == ConnectionStatus.CONNECTED
fun ConnectionStatus.isConnecting(): Boolean = this == ConnectionStatus.CONNECTING
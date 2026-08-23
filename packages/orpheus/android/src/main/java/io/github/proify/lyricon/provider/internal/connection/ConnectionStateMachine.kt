/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.internal.connection

import io.github.proify.lyricon.provider.ConnectionStatus
import io.github.proify.lyricon.provider.isDisconnected

/** 触发连接状态机的一次外部事件。 */
internal enum class ConnectionTrigger {
    /** 发起注册。 */
    REGISTER,

    /** 注册等待超时。 */
    REGISTRATION_TIMEOUT,

    /** 远端服务已就绪（注册回调返回）。 */
    SERVICE_READY,

    /** 远端服务断开或 Binder 死亡。 */
    SERVICE_LOST,

    /** 新服务到来时先拆除旧连接。 */
    PREEMPT,

    /** 用户主动断开。 */
    USER_DISCONNECT,
}

/** 状态机产生的一次对外通知。 */
internal enum class ConnectionNotice {
    /** 首次连接成功。 */
    CONNECTED,

    /** 断开后重新连接成功。 */
    RECONNECTED,

    /** 连接已断开。 */
    DISCONNECTED,

    /** 注册等待超时。 */
    CONNECT_TIMEOUT,
}

/**
 * 一次状态转移的结果。
 *
 * @property status 转移后的连接状态。
 * @property notice 需要分发给监听器的通知，null 表示无通知。
 */
internal data class ConnectionTransition(
    val status: ConnectionStatus,
    val notice: ConnectionNotice?,
)

/**
 * 提供端连接状态机（纯 Kotlin，可单元测试）。
 *
 * 所有状态转移都经由 [on] 完成：状态与监听器通知在同一处决定，
 * [CentralConnection] 只负责把转移翻译成实际的 Binder 操作。
 */
/**
 * @property initialStatus 初始连接状态，默认 [ConnectionStatus.DISCONNECTED]（用于测试或恢复）。
 */
internal class ConnectionStateMachine(
    initialStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED,
) {

    /** 当前连接状态。 */
    var status: ConnectionStatus = initialStatus
        private set

    /** 是否曾经成功连接过（用于区分首次连接与重连）。 */
    var hasConnectedBefore: Boolean = false
        private set

    /**
     * 处理一次事件。
     *
     * @param trigger 触发事件。
     * @param serviceWasBound 拆除旧连接时是否有已绑定的远端服务；
     *   决定是否产生 [ConnectionNotice.DISCONNECTED] 通知，与原有实现保持一致。
     */
    fun on(trigger: ConnectionTrigger, serviceWasBound: Boolean = false): ConnectionTransition {
        val transition = transitionFor(trigger, serviceWasBound)
        status = transition.status
        return transition
    }

    /**
     * 计算一次触发对应的转移结果（不修改本机状态）。
     *
     * @param trigger 触发事件。
     * @param serviceWasBound 拆除旧连接时是否有已绑定的远端服务。
     */
    private fun transitionFor(
        trigger: ConnectionTrigger,
        serviceWasBound: Boolean,
    ): ConnectionTransition = when (trigger) {
            ConnectionTrigger.REGISTER ->
                if (status.isDisconnected()) {
                    ConnectionTransition(ConnectionStatus.CONNECTING, null)
                } else {
                    ConnectionTransition(status, null)
                }

            ConnectionTrigger.REGISTRATION_TIMEOUT ->
                if (status == ConnectionStatus.CONNECTING) {
                    ConnectionTransition(
                        ConnectionStatus.DISCONNECTED,
                        ConnectionNotice.CONNECT_TIMEOUT
                    )
                } else {
                    ConnectionTransition(status, null)
                }

            ConnectionTrigger.SERVICE_READY -> {
                val notice = if (hasConnectedBefore) {
                    ConnectionNotice.RECONNECTED
                } else {
                    ConnectionNotice.CONNECTED
                }
                hasConnectedBefore = true
                ConnectionTransition(ConnectionStatus.CONNECTED, notice)
            }

            ConnectionTrigger.SERVICE_LOST ->
                ConnectionTransition(
                    ConnectionStatus.DISCONNECTED_REMOTE,
                    ConnectionNotice.DISCONNECTED.takeIf { serviceWasBound }
                )

            ConnectionTrigger.PREEMPT ->
                ConnectionTransition(
                    ConnectionStatus.DISCONNECTED,
                    ConnectionNotice.DISCONNECTED.takeIf { serviceWasBound }
                )

            ConnectionTrigger.USER_DISCONNECT ->
                ConnectionTransition(
                    ConnectionStatus.DISCONNECTED_USER,
                    ConnectionNotice.DISCONNECTED.takeIf { serviceWasBound }
                )
        }
}

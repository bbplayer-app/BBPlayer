/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.internal.registration

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.annotation.RequiresApi
import io.github.proify.lyricon.provider.ProviderConstants
import io.github.proify.lyricon.provider.ProviderConstants.ACTION_REGISTER_PROVIDER
import io.github.proify.lyricon.provider.ProviderConstants.EXTRA_BINDER
import io.github.proify.lyricon.provider.internal.binding.RegistrationBinder
import io.github.proify.lyricon.provider.internal.connection.CentralConnection
import io.github.proify.lyricon.provider.isDisconnected
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * 注册协调器：发送注册广播、管理连接超时与失败重试，并在中心服务重启后恢复注册。
 *
 * 每次 [start] 建立一次注册尝试；[cancel] 结束尝试并停止重试，之后到达的中心回调
 * 会被 [RegistrationBinder] 忽略，从而同时覆盖"断开已连接"与"取消连接中"两种语义。
 *
 * [wantsConnection] 记录提供端是否期望保持连接：为 true 时，
 * - 中心服务启动广播触发重新注册；
 * - 注册失败/超时按指数退避自动重试（1s 起，封顶 [MAX_RETRY_DELAY_MS]），
 *   覆盖中心暂时不可用、广播丢失等场景，无需等待下一次中心启动。
 *
 * @property context 发送注册广播的上下文。
 * @property centralPackageName 中心服务所在包名。
 * @property registrationBinder 注册 AIDL 桩。
 * @property connection 连接端点。
 * @property scope 超时与重试协程的宿主作用域。
 */
@RequiresApi(Build.VERSION_CODES.O_MR1)
internal class RegistrationCoordinator(
    private val context: Context,
    private val centralPackageName: String,
    private val registrationBinder: RegistrationBinder,
    private val connection: CentralConnection,
    private val scope: CoroutineScope,
) : CentralBootReceiver.BootListener {

    /** 当前注册尝试的超时协程。 */
    private var timeoutJob: Job? = null

    /** 失败重试协程。 */
    private var retryJob: Job? = null

    /** 期望保持连接（register 时置位，unregister/destroy 时复位）。 */
    @Volatile
    private var wantsConnection: Boolean = false

    /** 下一次失败重试的等待时间（指数退避）。 */
    @Volatile
    private var retryDelayMs: Long = INITIAL_RETRY_DELAY_MS

    /** 当前注册尝试的回调：成功后停止重试，失败后安排下一次重试。 */
    private val attempt = object : RegistrationBinder.RegistrationAttempt {
        override fun onCompleted(connected: Boolean) {
            cancelTimeout()
            if (connected) {
                cancelRetry()
            } else {
                scheduleRetry()
            }
            registrationBinder.endAttempt(this)
        }
    }

    init {
        CentralBootReceiver.addBootListener(this)
    }

    /** 发出注册广播；返回是否真正启动了一次注册。 */
    fun start(): Boolean {
        if (centralPackageName.isBlank()) return false
        // 用户/外部主动触发：取消待定重试，退避回到起点。
        cancelRetry()
        retryDelayMs = INITIAL_RETRY_DELAY_MS
        // 状态机权威判定：连接中或已连接时不重复注册，避免破坏现有连接。
        if (!connection.beginRegistration()) return false

        wantsConnection = true
        registrationBinder.beginAttempt(attempt)
        scheduleTimeout()
        context.sendBroadcast(Intent(ACTION_REGISTER_PROVIDER).apply {
            setPackage(centralPackageName)
            putExtra(
                ProviderConstants.EXTRA_BUNDLE,
                Bundle().apply {
                    putBinder(EXTRA_BINDER, registrationBinder)
                }
            )
        })
        return true
    }

    override fun onBootCompleted() {
        // 中心服务重启：只要提供端仍期望连接且当前未在连接中，就补一次注册。
        if (wantsConnection && connection.connectionStatus.isDisconnected()) {
            start()
        }
    }

    /** 取消当前注册尝试：清空超时与重试、复位期望连接标记，并让迟到回调失效。 */
    fun cancel() {
        wantsConnection = false
        cancelTimeout()
        cancelRetry()
        registrationBinder.endAttempt(attempt)
    }

    /** 销毁：取消全部等待并停止监听中心启动广播。 */
    fun close() {
        cancel()
        CentralBootReceiver.removeBootListener(this)
    }

    /** 取消注册超时等待。 */
    private fun cancelTimeout() {
        timeoutJob?.cancel()
        timeoutJob = null
    }

    /** 取消待定的失败重试。 */
    private fun cancelRetry() {
        retryJob?.cancel()
        retryJob = null
    }

    /** 启动注册超时等待；超时后结束尝试并按退避安排重试。 */
    private fun scheduleTimeout() {
        cancelTimeout()
        timeoutJob = scope.launch {
            delay(CONNECTION_TIMEOUT_MS)
            connection.onRegistrationTimeout()
            registrationBinder.endAttempt(attempt)
            scheduleRetry()
        }
    }

    /** 注册失败/超时后按指数退避安排一次重试（仅当仍期望连接时）。 */
    private fun scheduleRetry() {
        if (!wantsConnection) return
        cancelRetry()
        retryJob = scope.launch {
            delay(retryDelayMs)
            retryDelayMs = (retryDelayMs * 2).coerceAtMost(MAX_RETRY_DELAY_MS)
            start()
        }
    }

    private companion object {
        private const val CONNECTION_TIMEOUT_MS = 4_000L
        private const val INITIAL_RETRY_DELAY_MS = 1_000L
        private const val MAX_RETRY_DELAY_MS = 30_000L
    }
}

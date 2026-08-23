/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.internal.binding

import android.util.Log
import io.github.proify.lyricon.provider.IProviderBinder
import io.github.proify.lyricon.provider.IProviderService
import io.github.proify.lyricon.provider.IRemoteService
import io.github.proify.lyricon.provider.ProviderInfo
import io.github.proify.lyricon.provider.internal.connection.RemoteServiceSink
import io.github.proify.lyricon.provider.internal.wire.json

/**
 * 提供端暴露给中心服务的注册 AIDL 适配器。
 *
 * 该桩负责向中心服务提供注册信息与本地命令 Binder，并接收中心服务返回的远端服务 Binder。
 *
 * 每次注册广播对应一次 [RegistrationAttempt]；尝试被取消（用户断开、销毁或超时）后，
 * 迟到的注册回调将被忽略，不会建立连接。尝试由 [RegistrationAttempts] 托管，
 * 保证回调至多被消费一次。
 *
 * @property providerInfo 注册信息，序列化后通过 [getProviderInfo] 交给中心服务。
 * @property providerCommand 中心服务调用本地命令的桩。
 * @property remoteServiceSink 连接端点，接收中心服务返回的远端服务。
 */
internal class RegistrationBinder(
    providerInfo: ProviderInfo,
    private val providerCommand: ProviderCommandStub,
    private val remoteServiceSink: RemoteServiceSink<IRemoteService?>,
) : IProviderBinder.Stub() {

    /** 等待中的注册尝试登记表。 */
    private val attempts = RegistrationAttempts<RegistrationAttempt>()

    /** 注册信息的 JSON 序列化结果（懒生成，只算一次）。 */
    private val serializedProviderInfo: ByteArray by lazy {
        json.encodeToString(providerInfo).toByteArray()
    }

    /** 进入等待中心服务回调的状态。 */
    fun beginAttempt(attempt: RegistrationAttempt) {
        attempts.begin(attempt)
    }

    /** 结束等待：仅在 [attempt] 仍为当前尝试时清除。 */
    fun endAttempt(attempt: RegistrationAttempt) {
        attempts.end(attempt)
    }

    override fun onRegistrationCallback(remoteProviderService: IRemoteService?) {
        // 原子地消费本次尝试：迟到回调（尝试已被取消）或重复回调（已被消费）
        // 在这里被拦截，不再触碰连接端点，并把结果上报注册尝试。
        val attempt = attempts.consume() ?: run {
            Log.w(TAG, "Ignoring registration callback (attempt was cancelled)")
            return
        }
        val connected = remoteServiceSink.onRemoteService(remoteProviderService)
        attempt.onCompleted(connected)
    }

    override fun getProviderService(): IProviderService = providerCommand
    override fun getProviderInfo(): ByteArray = serializedProviderInfo

    /** 一次注册尝试：中心服务回调返回并处理完成后触发。 */
    interface RegistrationAttempt {
        /**
         * 回调已处理完成。
         *
         * @param connected 是否成功建立连接；false 时调用方可安排重试。
         */
        fun onCompleted(connected: Boolean)
    }

    private companion object {
        private const val TAG = "RegistrationBinder"
    }
}

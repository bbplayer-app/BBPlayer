/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import io.github.proify.lyricon.provider.service.RemoteServiceBinder
import kotlinx.serialization.encodeToString
import java.util.concurrent.CopyOnWriteArraySet

/**
 * 提供端暴露给中心服务的 AIDL 适配器。
 *
 * 该类负责向中心服务提供注册信息、本地服务 Binder，并接收中心服务返回的远端服务 Binder。
 */
internal class ProviderBinder(
    private val provider: LyriconProvider,
    private val localProviderService: LocalProviderService,
    private val remoteServiceBinder: RemoteServiceBinder<IRemoteService?>?
) : IProviderBinder.Stub() {
    private val registrationCallbacks = CopyOnWriteArraySet<OnRegistrationCallback>()

    private val providerInfoByteArray by lazy {
        json.encodeToString(provider.providerInfo).toByteArray()
    }

    /** 添加注册完成回调。 */
    fun addRegistrationCallback(callback: OnRegistrationCallback) =
        registrationCallbacks.add(callback)

    /** 移除注册完成回调。 */
    fun removeRegistrationCallback(callback: OnRegistrationCallback) =
        registrationCallbacks.remove(callback)

    override fun onRegistrationCallback(remoteProviderService: IRemoteService?) {
        remoteServiceBinder?.bindRemoteService(remoteProviderService)
        registrationCallbacks.forEach { it.onRegistered() }
    }

    override fun getProviderService(): IProviderService = localProviderService
    override fun getProviderInfo(): ByteArray = providerInfoByteArray

    /** 中心服务完成注册后触发的内部回调。 */
    interface OnRegistrationCallback {
        fun onRegistered()
    }
}

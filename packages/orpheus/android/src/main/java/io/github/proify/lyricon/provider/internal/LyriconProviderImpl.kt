/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.internal

import android.content.Context
import android.os.Build
import androidx.annotation.RequiresApi
import io.github.proify.lyricon.provider.ConnectionListener
import io.github.proify.lyricon.provider.LyriconProvider
import io.github.proify.lyricon.provider.ProviderInfo
import io.github.proify.lyricon.provider.ProviderService
import io.github.proify.lyricon.provider.RemotePlayer
import io.github.proify.lyricon.provider.internal.binding.ProviderCommandStub
import io.github.proify.lyricon.provider.internal.binding.RegistrationBinder
import io.github.proify.lyricon.provider.internal.connection.CentralConnection
import io.github.proify.lyricon.provider.internal.registration.RegistrationCoordinator
import io.github.proify.lyricon.provider.service.RemoteService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 默认提供端实现。
 *
 * 只负责装配与生命周期：注册流程交给 [RegistrationCoordinator]，
 * 远端连接交给 [CentralConnection]；自动同步由 [autoSync] 策略驱动。
 *
 * @property context 注册广播与进程信息所需的上下文。
 * @property providerInfo 提供端注册信息。
 * @property providerService 暴露给中心服务调用的本地命令处理器。
 * @property centralPackageName 中心服务所在包名。
 */
@RequiresApi(Build.VERSION_CODES.O_MR1)
internal class LyriconProviderImpl(
    private val context: Context,
    override val providerInfo: ProviderInfo,
    providerService: ProviderService? = null,
    private val centralPackageName: String,
) : LyriconProvider, ConnectionListener {

    /** 是否已销毁；销毁后返回全部 no-op。 */
    private val destroyed = AtomicBoolean(false)

    /** 注册超时与失败重试的协程作用域。 */
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** 中心服务调用本地命令的 AIDL 桩。 */
    private val commandStub = ProviderCommandStub(providerService)

    /** 与中心服务的连接端点。 */
    private val connection = CentralConnection(this)

    /** 注册 AIDL 桩，承载注册回调与注册信息。 */
    private val registrationBinder = RegistrationBinder(providerInfo, commandStub, connection)

    /** 注册协调器：广播、超时、重试与启动恢复。 */
    private val registration = RegistrationCoordinator(
        context,
        centralPackageName,
        registrationBinder,
        connection,
        scope
    )

    override var providerService: ProviderService? = providerService
        set(value) {
            field = value
            commandStub.handler = value
        }

    override val service: RemoteService = connection
    override val player: RemotePlayer get() = service.player
    override var autoSync: Boolean = true

    init {
        service.addConnectionListener(this)
    }

    override fun register(): Boolean {
        if (destroyed.get()) return false
        return registration.start()
    }

    override fun unregister(): Boolean {
        if (destroyed.get()) return false
        registration.cancel()
        connection.disconnectByUser()
        return true
    }

    override fun destroy(): Boolean {
        if (!destroyed.compareAndSet(false, true)) return false
        registration.close()
        connection.disconnectByUser()
        service.removeConnectionListener(this)
        scope.cancel()
        return true
    }

    override fun onConnected(provider: LyriconProvider) {
        if (autoSync) connection.syncPlayer()
    }

    override fun onReconnected(provider: LyriconProvider) {
        if (autoSync) connection.syncPlayer()
    }

    override fun onDisconnected(provider: LyriconProvider) = Unit
    override fun onConnectTimeout(provider: LyriconProvider) = Unit
}

/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import android.app.ActivityManager
import android.app.Application
import android.content.Context
import android.os.Build
import io.github.proify.lyricon.provider.impl.EmptyProvider
import io.github.proify.lyricon.provider.impl.LyriconProviderImpl

/** 创建 [LyriconProvider] 的工厂。 */
object LyriconFactory {

    /**
     * 使用基础字段创建歌词提供端。
     *
     * Android 8.1 以下系统不支持当前 Binder/SharedMemory 通道，会返回空实现。
     *
     * @param context 用于注册中心服务广播接收器和读取进程信息的上下文。
     * @param providerPackageName 提供端应用包名，默认使用当前应用包名。
     * @param playerPackageName 播放器应用包名，默认与 [providerPackageName] 相同。
     * @param logo 提供端或播放器图标。
     * @param metadata 提供端附加元数据。
     * @param processName 播放器进程名，默认读取当前进程名。
     * @param providerService 暴露给中心服务调用的本地命令处理器。
     * @param centralPackageName 中心服务所在包名。
     */
    fun createProvider(
        context: Context,
        providerPackageName: String = context.packageName,
        playerPackageName: String = providerPackageName,
        logo: ProviderLogo? = null,
        metadata: ProviderMetadata? = null,
        processName: String? = getCurrentProcessName(context),
        providerService: ProviderService? = null,
        centralPackageName: String = ProviderConstants.SYSTEM_UI_PACKAGE_NAME,
    ): LyriconProvider = createProvider(
        context,
        ProviderInfo(
            providerPackageName = providerPackageName,
            playerPackageName = playerPackageName,
            logo = logo,
            metadata = metadata,
            processName = processName
        ),
        providerService,
        centralPackageName
    )

    /**
     * 使用完整 [ProviderInfo] 创建歌词提供端。
     *
     * @param context 用于注册中心服务广播接收器的上下文。
     * @param providerInfo 提供端注册信息。
     * @param providerService 暴露给中心服务调用的本地命令处理器。
     * @param centralPackageName 中心服务所在包名。
     * @return 可用于注册中心服务的提供端实例。
     */
    fun createProvider(
        context: Context,
        providerInfo: ProviderInfo,
        providerService: ProviderService? = null,
        centralPackageName: String = ProviderConstants.SYSTEM_UI_PACKAGE_NAME,
    ): LyriconProvider {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            initialize(context)

            return LyriconProviderImpl(
                context,
                providerInfo,
                providerService,
                centralPackageName
            )
        }

        return EmptyProvider(providerInfo)
    }

    private fun initialize(context: Context) {
        if (!CentralServiceReceiver.isInitialized) {
            CentralServiceReceiver.initialize(context)
        }
    }

    private fun getCurrentProcessName(context: Context): String? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            Application.getProcessName()
        } else {
            val pid = android.os.Process.myPid()
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            am.runningAppProcesses?.firstOrNull { it.pid == pid }?.processName
        }
    }
}

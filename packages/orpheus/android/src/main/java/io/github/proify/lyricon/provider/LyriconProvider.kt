/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import io.github.proify.lyricon.provider.service.RemoteService

/**
 * Lyricon 提供端入口。
 *
 * 提供端负责把播放器状态、歌曲和歌词显示配置发送给中心服务。实例通常由
 * [LyriconFactory.createProvider] 创建。
 */
interface LyriconProvider {
    /** 注册到中心服务时上报的提供端信息。 */
    val providerInfo: ProviderInfo

    /** 与中心服务的远端连接入口，可读取连接状态并注册连接监听。 */
    val service: RemoteService

    /** 播放器状态发送入口。 */
    val player: RemotePlayer

    /** 连接或重连成功后是否自动同步最近一次缓存的播放器状态。 */
    var autoSync: Boolean

    /** 暴露给中心服务调用的本地命令处理器。 */
    var providerService: ProviderService?

    /** 向中心服务发送注册请求。 */
    fun register(): Boolean

    /** 主动断开当前中心服务连接。 */
    fun unregister(): Boolean

    /** 释放监听器、注册回调和远端连接资源。 */
    fun destroy(): Boolean
}

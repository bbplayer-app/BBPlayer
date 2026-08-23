/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.internal.connection

/**
 * 远端服务接收槽位。
 *
 * 用于把 AIDL 注册回调返回的远端服务实例交给内部连接端点。
 */
internal interface RemoteServiceSink<T> {
    /**
     * 接收新的远端服务实例。
     *
     * @return 是否成功建立连接；false 表示服务不可用，调用方可安排重试。
     */
    fun onRemoteService(service: T): Boolean
}

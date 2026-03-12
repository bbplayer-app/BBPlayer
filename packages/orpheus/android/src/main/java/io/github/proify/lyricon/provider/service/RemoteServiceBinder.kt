/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.service

/**
 * 远程服务绑定器接口。
 *
 * 用于管理远程服务实例的绑定操作。
 *
 * @param T 远程服务类型
 */
internal interface RemoteServiceBinder<T> {

    /**
     * 绑定远程服务实例。
     *
     * @param service 远程服务实例
     */
    fun bindRemoteService(service: T)
}
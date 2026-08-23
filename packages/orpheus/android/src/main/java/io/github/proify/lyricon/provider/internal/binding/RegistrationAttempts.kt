/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.internal.binding

/**
 * 注册尝试登记表（纯 Kotlin，可单元测试）。
 *
 * 同一时间至多一个等待中的注册尝试；[consume] 在锁内"取用并清空"，
 * 保证中心回调至多被消费一次：迟到的回调（尝试已结束）与重复回调
 * 都会拿到 null 而被拦截。
 */
internal class RegistrationAttempts<T> {

    /** 当前等待中的尝试，null 表示无等待。 */
    @Volatile
    private var pending: T? = null

    /** 进入等待中心回应的状态（覆盖旧的等待尝试）。 */
    fun begin(attempt: T) {
        synchronized(this) {
            pending = attempt
        }
    }

    /** 结束等待：仅在 [attempt] 仍为当前尝试时清除。 */
    fun end(attempt: T) {
        synchronized(this) {
            if (pending === attempt) pending = null
        }
    }

    /** 原子地取用并清空当前尝试；没有等待中的尝试时返回 null。 */
    fun consume(): T? = synchronized(this) {
        val current = pending
        pending = null
        current
    }
}

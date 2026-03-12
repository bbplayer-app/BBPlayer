/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import java.util.concurrent.CopyOnWriteArraySet

/**
 * 中央服务状态广播接收器，用于协调服务启动状态的通知。
 */
internal object CentralServiceReceiver {

    @Volatile
    var isInitialized = false
        private set

    private val listeners = CopyOnWriteArraySet<ServiceListener>()

    /**
     * 内部广播处理器，过滤并分发指定的系统或应用广播。
     */
    private val innerReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == ProviderConstants.ACTION_CENTRAL_BOOT_COMPLETED) {
                notifyServiceBootCompleted()
            }
        }
    }

    /**
     * 注册服务启动监听器。
     */
    fun addServiceListener(listener: ServiceListener) {
        listeners.add(listener)
    }

    /**
     * 移除服务启动监听器。
     */
    fun removeServiceListener(listener: ServiceListener) {
        listeners.remove(listener)
    }

    /**
     * 执行广播接收器的初始化与系统注册。
     *
     * @param context 建议传入 Application Context。
     */
    fun initialize(context: Context) {
        if (isInitialized) return

        synchronized(this) {
            if (isInitialized) return

            val filter = IntentFilter(ProviderConstants.ACTION_CENTRAL_BOOT_COMPLETED)
            ContextCompat.registerReceiver(
                context.applicationContext,
                innerReceiver,
                filter,
                ContextCompat.RECEIVER_EXPORTED
            )
            isInitialized = true
        }
    }

    /**
     * 遍历并回调所有已注册监听器的启动完成事件。
     */
    fun notifyServiceBootCompleted() {
        for (listener in listeners) {
            listener.onServiceBootCompleted()
        }
    }

    /**
     * 服务状态变更回调接口。
     */
    interface ServiceListener {
        /**
         * 当接收到中央服务启动完成信号时触发。
         */
        fun onServiceBootCompleted()
    }
}
/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.internal.registration

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import io.github.proify.lyricon.provider.ProviderConstants
import java.util.concurrent.CopyOnWriteArraySet

/**
 * 中央服务启动完成广播接收器，用于协调服务重启后的恢复注册。
 *
 * 全局单例：只注册一次系统广播接收器，向所有 [BootListener] 分发启动完成事件。
 */
internal object CentralBootReceiver {

    /** 是否已完成系统广播注册。 */
    @Volatile
    var isInitialized = false
        private set

    /** 启动完成事件监听器集合。 */
    private val listeners = CopyOnWriteArraySet<BootListener>()

    /**
     * 内部广播处理器，过滤并分发中央服务启动完成的广播。
     */
    private val innerReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == ProviderConstants.ACTION_CENTRAL_BOOT_COMPLETED) {
                notifyBootCompleted()
            }
        }
    }

    /** 注册启动完成监听器。 */
    fun addBootListener(listener: BootListener) {
        listeners.add(listener)
    }

    /** 移除启动完成监听器。 */
    fun removeBootListener(listener: BootListener) {
        listeners.remove(listener)
    }

    /**
     * 执行广播接收器的初始化与系统注册。
     *
     * 幂等：重复调用不生效。
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
    private fun notifyBootCompleted() {
        for (listener in listeners) {
            listener.onBootCompleted()
        }
    }

    /** 中央服务启动完成回调接口。 */
    interface BootListener {
        /** 当接收到中央服务启动完成信号时触发。 */
        fun onBootCompleted()
    }
}

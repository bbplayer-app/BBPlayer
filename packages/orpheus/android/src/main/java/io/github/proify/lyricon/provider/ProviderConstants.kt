/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.provider

/**
 * 常量定义类，用于 Provider 与中心服务交互。
 */
object ProviderConstants {

    /** 默认歌词更新间隔 */
    const val DEFAULT_POSITION_UPDATE_INTERVAL: Long = 1000L / 24

    internal const val DEBUG: Boolean = false

    /** 注册提供者广播动作 */
    internal const val ACTION_REGISTER_PROVIDER: String =
        "io.github.proify.lyricon.lyric.bridge.REGISTER_PROVIDER"

    /** 中心服务启动完成广播动作 */
    internal const val ACTION_CENTRAL_BOOT_COMPLETED: String =
        "io.github.proify.lyricon.lyric.bridge.CENTRAL_BOOT_COMPLETED"

    internal const val EXTRA_BUNDLE: String = "bundle"
    internal const val EXTRA_BINDER: String = "binder"

    const val SYSTEM_UI_PACKAGE_NAME: String = "com.android.systemui"
}
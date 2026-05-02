/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.provider

/** 提供端与中心服务交互使用的常量。 */
object ProviderConstants {

    /** 默认播放进度写入间隔，约 24 FPS。 */
    const val DEFAULT_POSITION_UPDATE_INTERVAL: Long = 1000L / 24

    internal const val DEBUG: Boolean = false

    /** 注册提供端广播动作。 */
    internal const val ACTION_REGISTER_PROVIDER: String =
        "io.github.proify.lyricon.lyric.bridge.REGISTER_PROVIDER"

    /** 中心服务启动完成广播动作。 */
    internal const val ACTION_CENTRAL_BOOT_COMPLETED: String =
        "io.github.proify.lyricon.lyric.bridge.CENTRAL_BOOT_COMPLETED"

    /** 广播中承载 Binder 的 Bundle key。 */
    internal const val EXTRA_BUNDLE: String = "bundle"

    /** Bundle 中提供端 Binder 的 key。 */
    internal const val EXTRA_BINDER: String = "binder"

    /** 默认中心服务包名。 */
    const val SYSTEM_UI_PACKAGE_NAME: String = "com.android.systemui"
}

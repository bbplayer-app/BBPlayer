package expo.modules.bbplayernative

/**
 * bbplayer-native 的 logcat tag，统一以 `BBNative.` 开头。级别和消息格式的约定同 orpheus 的 LogTags：
 * E 导致功能失败，W 可恢复的异常，I 状态变化，D 排查细节；消息格式为 `事件 key=value`。
 * I 及以上会经 Sentry 的 Logcat 插桩进入 Sentry Logs。
 */
internal object LogTags {
    /** 应用内更新：下载、安装 APK */
    const val UPDATE = "BBNative.Update"

    /** 存储占用、清理缓存、解压、备份导出 */
    const val STORAGE = "BBNative.Storage"

    const val BOOT_SPLASH = "BBNative.BootSplash"

    /** 签名校验等与遥测相关的环境信息 */
    const val TELEMETRY = "BBNative.Telemetry"
}

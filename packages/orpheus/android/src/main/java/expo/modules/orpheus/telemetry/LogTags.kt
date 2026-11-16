package expo.modules.orpheus.telemetry

/**
 * orpheus 的 logcat tag，统一以 `Orpheus.` 开头，可以用 `logcat Orpheus.*:V *:S` 只看 orpheus。
 *
 * 级别约定：
 * - E：导致功能失败（播放停止、下载失败、导出失败）
 * - W：可恢复的异常（镜像切换、解码器可恢复错误、欠载、降级到其他音质）
 * - I：状态变化（切歌、播放状态、解码器与输出配置、取流结果、下载状态）
 * - D：排查用的细节，高频事件（每个 buffer、每次进度）只能用 D 或不打
 *
 * I 及以上会经 Sentry 的 Logcat 插桩进入 Sentry Logs，W 及以上同时记为 breadcrumb，
 * 所以 I 级日志也不能在播放过程中持续输出。
 *
 * 普通消息格式为 `事件 key=value key=value`。关键播放故障使用 NativeLog，
 * 显式上报 log.tag 和诊断属性，同时输出本地日志，不再经 Logcat 插桩重复采集。
 */
internal object LogTags {
    /** JS 调用的播放控制与播放错误 */
    const val PLAYER = "Orpheus.Player"

    /** 播放服务、播放器的创建与销毁、队列恢复 */
    const val SERVICE = "Orpheus.Service"

    /** 解码器、输入格式、AudioTrack、offload */
    const val AUDIO = "Orpheus.Audio"

    /** 解析 B 站音频流、选择音轨、镜像切换、网络加载 */
    const val STREAM = "Orpheus.Stream"

    const val DOWNLOAD = "Orpheus.Download"
    const val EXPORT = "Orpheus.Export"
    const val COVER = "Orpheus.Cover"

    /** 桌面、状态栏、车机歌词 */
    const val LYRICS = "Orpheus.Lyrics"

    /** MMKV 持久化 */
    const val STORAGE = "Orpheus.Storage"

    /** 响度均衡 */
    const val LOUDNESS = "Orpheus.Loudness"

    /** 随机播放、逐首断点 */
    const val QUEUE = "Orpheus.Queue"
}

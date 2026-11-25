package expo.modules.orpheus.telemetry

import io.sentry.Sentry

/**
 * 把播放器当前的状态写进 Sentry 原生 scope 的 `orpheus` context 和几个 tag。
 *
 * JS 上报事件时会合并原生 scope，所以不管 issue 来自 JS 还是原生，都能看到出问题时在播什么、
 * 用什么解码器、输出走 PCM 还是直通。tag 可以在 Sentry 里筛选和聚合，只放取值有限的字段。
 *
 * 只在状态变化时调用（每首歌几次），不要放进逐 buffer 的路径。
 * 原生 SDK 没有初始化（例如用户关闭了数据采集）时，Sentry 的调用都是空操作。播放服务通常比
 * 原生 SDK 先启动，所以字段和 tag 都保存在这里，SDK 初始化完成后由 JS 调用 [resync] 补写一次。
 */
object OrpheusTelemetry {
    private const val CONTEXT_KEY = "orpheus"
    private const val MAX_STREAMS = 8

    private val fields = HashMap<String, Any>()
    private val tags = HashMap<String, String>()

    /** 按播放 URI 记录取到的流：播放器会提前为下一首取流，不能直接覆盖当前歌曲的信息 */
    private val streams = object : LinkedHashMap<String, Map<String, Any>>(MAX_STREAMS, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Map<String, Any>>?) =
            size > MAX_STREAMS
    }

    private var currentUri: String? = null

    /** 更新 context 字段，值为 null 时移除 */
    @Synchronized
    fun update(vararg values: Pair<String, Any?>) {
        for ((key, value) in values) {
            if (value == null) fields.remove(key) else fields[key] = value
        }
        flush()
    }

    @Synchronized
    fun setTag(key: String, value: String?) {
        if (value == null) tags.remove(key) else tags[key] = value
        Sentry.configureScope { scope ->
            if (value == null) scope.removeTag(key) else scope.setTag(key, value)
        }
    }

    /** 原生 SDK 初始化完成后调用，把之前写入时 SDK 还不存在的字段和 tag 补上 */
    @Synchronized
    fun resync() {
        val snapshot = HashMap(tags)
        Sentry.configureScope { scope -> snapshot.forEach(scope::setTag) }
        flush()
    }

    /** 取流完成时调用（在加载线程上） */
    @Synchronized
    fun recordStream(uri: String, info: Map<String, Any>) {
        streams[uri] = info
        if (uri == currentUri) applyStream(info)
    }

    /** 切歌时调用 */
    @Synchronized
    fun onMediaItemChanged(mediaId: String?, uri: String?) {
        currentUri = uri
        fields["mediaId"] = mediaId ?: "none"
        fields.remove("stream")
        val stream = uri?.let { streams[it] }
        if (stream != null) {
            applyStream(stream)
        } else {
            // 本地文件和已缓存的歌曲不会经过取流；B 站歌曲也可能只是还没取完，这时分不清是否命中缓存
            setTag("orpheus.source", if (uri == null) null else sourceOf(uri))
            flush()
        }
    }

    private fun applyStream(info: Map<String, Any>) {
        fields["stream"] = info
        setTag("orpheus.source", info["kind"]?.toString())
        flush()
    }

    private fun sourceOf(uri: String) = when {
        uri.startsWith("orpheus://bilibili") -> "bilibili"
        uri.startsWith("file:") || uri.startsWith("content:") -> "local"
        else -> "other"
    }

    private fun flush() {
        val snapshot = HashMap(fields)
        Sentry.configureScope { it.setContexts(CONTEXT_KEY, snapshot) }
    }
}

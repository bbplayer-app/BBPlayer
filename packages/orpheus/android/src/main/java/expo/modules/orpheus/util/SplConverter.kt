package expo.modules.orpheus.util

/**
 * SPL（Salt Player Lyrics）→ 标准 LRC 转换工具。
 *
 * SPL 是 LRC 的超集，通过行内尖括号时间戳 `<mm:ss.ms>` 实现逐字卡拉OK效果。
 * 绝大多数播放器无法识别此语法，转换时直接剥离行内时间戳即可。
 * 行首方括号时间戳 `[mm:ss.ms]` 以及翻译行（同一时间戳出现两次）保持不变。
 */
object SplConverter {

    /** 匹配 SPL 逐字时间戳，格式：`<分:秒.毫秒>`，尖括号包裹 */
    private val INLINE_TIMESTAMP_REGEX = Regex("<\\d{1,3}:\\d{1,2}\\.\\d{1,6}>")

    /**
     * 将 SPL 内容转换为标准 LRC，移除所有行内逐字时间戳。
     * @param spl 原始 SPL 字符串
     * @return 标准 LRC 字符串
     */
    fun toStandardLrc(spl: String): String =
        spl.lines().joinToString("\n") { line ->
            INLINE_TIMESTAMP_REGEX.replace(line, "")
        }
}

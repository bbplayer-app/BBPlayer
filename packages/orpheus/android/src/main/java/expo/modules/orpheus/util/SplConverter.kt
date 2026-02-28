package expo.modules.orpheus.util

/**
 * SPL（Salt Player Lyrics）→ 标准 LRC 转换工具。
 *
 * SPL 是 LRC 的超集，支持两种逐字（卡拉 OK）时间戳写法：
 *   1. 行内 `[mm:ss.ms]`（标准 SPL，即非行首的方括号时间戳）
 *   2. 行内 `<mm:ss.ms>`（SPL 兼容写法，仅用于中间逐字位置）
 *
 * 转换规则：
 *   - 行首 `[mm:ss.ms]` 块（可能有多个，对应重复行）→ **保留**，这是标准 LRC 行时间戳
 *   - 行体中的 `[mm:ss.ms]` 或 `<mm:ss.ms>` → **剥离**，这是逐字时间戳
 *   - 元数据行（如 `[ti:Title]`、空行）→ 原样保留
 */
object SplConverter {

    /**
     * 匹配行首一个或多个 [mm:ss.ms] 块（标准 LRC 行时间戳或重复行写法），必须锚定在行首。
     * 示例：`[05:20.22]` 或 `[05:20.22][05:30.22]`（重复行）。
     */
    private val LEADING_TIMESTAMPS_REGEX = Regex("^(?:\\[\\d{1,3}:\\d{1,2}\\.\\d{1,6}\\])+")

    /**
     * 匹配行体（非行首位置）中的逐字时间戳，兼容两种写法：
     *   - `[mm:ss.ms]` —— 标准 SPL 逐字标记
     *   - `<mm:ss.ms>` —— SPL 兼容逐字标记
     */
    private val INLINE_TIMESTAMP_REGEX = Regex("(?:\\[\\d{1,3}:\\d{1,2}\\.\\d{1,6}\\])|(?:<\\d{1,3}:\\d{1,2}\\.\\d{1,6}>)")

    /**
     * 元数据行 / 空行中的逐字时间戳正则，避免分配。
     */
    private val METADATA_TIMESTAMP_REGEX = Regex("<\\d{1,3}:\\d{1,2}\\.\\d{1,6}>")

    /**
     * 将 SPL 内容转换为标准 LRC：
     * 保留行首时间戳，剥离所有行内逐字时间戳。
     */
    fun toStandardLrc(spl: String): String =
        spl.lines().joinToString("\n") { line ->
            val leadingMatch = LEADING_TIMESTAMPS_REGEX.find(line)
            if (leadingMatch != null) {
                // 保留行首时间戳，对行体剥离所有逐字时间戳
                val body = line.substring(leadingMatch.range.last + 1)
                leadingMatch.value + INLINE_TIMESTAMP_REGEX.replace(body, "")
            } else {
                // 元数据行 / 空行：仅剥除 <...> 形式（不会误伤 [ti:Title] 等元数据标签）
                METADATA_TIMESTAMP_REGEX.replace(line, "")
            }
        }
}


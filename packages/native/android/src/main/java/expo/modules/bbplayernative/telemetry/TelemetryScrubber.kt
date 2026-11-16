package expo.modules.bbplayernative.telemetry

/**
 * 上报前抹掉能关联到具体账号、设备或 IP 的字段。
 *
 * 歌名、BV 号等播放记录保留：它们是排查问题需要的，只要不能和账号关联起来就没有意义。
 * 规则与 JS 侧的 `apps/mobile/src/lib/telemetry/scrub.ts` 保持一致。
 */
object TelemetryScrubber {
    private const val REDACTED = "[redacted]"

    // B 站登录凭据、账号 id（mid）、设备标识（buvid）以及 CDN 链接里的签名和客户端 IP（oi）
    private const val SENSITIVE_KEYS =
        "SESSDATA|bili_jct|DedeUserID(?:__ckMd5)?|sid|buvid[34]?|b_nut|bili_ticket|ac_time_value|" +
            "access_key|access_token|refresh_token|csrf|(?:up_|v)?mid|upsig|oi"

    // 查询参数与 cookie 里的 key=value
    private val pairRegex = Regex(
        """(?<![\w-])($SENSITIVE_KEYS)=([^&;\s"'<>]+)""",
        RegexOption.IGNORE_CASE,
    )

    // JSON 或对象打印里的 "key": value
    private val fieldRegex = Regex(
        """(?<![\w-])(["']?)($SENSITIVE_KEYS)\1(\s*:\s*)("[^"]*"|'[^']*'|[^,}\s]+)""",
        RegexOption.IGNORE_CASE,
    )

    // 请求头整行
    private val headerRegex = Regex(
        """\b(cookie|set-cookie|authorization)\b(["']?\s*[:=]\s*)[^\n]+""",
        RegexOption.IGNORE_CASE,
    )

    fun scrub(text: String): String {
        if (text.isEmpty()) return text
        return text
            .replace(headerRegex) { "${it.groupValues[1]}${it.groupValues[2]}$REDACTED" }
            .replace(pairRegex) { "${it.groupValues[1]}=$REDACTED" }
            .replace(fieldRegex) {
                val quote = it.groupValues[1]
                "$quote${it.groupValues[2]}$quote${it.groupValues[3]}\"$REDACTED\""
            }
    }

    fun scrubNullable(text: String?): String? = text?.let(::scrub)
}

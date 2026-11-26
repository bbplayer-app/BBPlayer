/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.lyric.model

import io.github.proify.lyricon.lyric.model.interfaces.ILyricTiming
import kotlinx.serialization.Serializable

/**
 * 歌词时间信息，纯生命周期数据类。
 *
 * 实现 [ILyricTiming] 的三元组（开始/结束/持续时间），不含文本等内容字段。
 * **时间单位为毫秒 (ms)**，合法的生命周期满足 `begin >= 0` 且 `end > begin`。
 *
 * 与 [LyricLine]、[LyricWord] 不同，本类**不提供** `duration` 兜底：
 * 构造后时间值完全由调用方提供，`duration == 0` 不会被自动计算。
 *
 * @property begin 开始时间（毫秒）
 * @property end 结束时间（毫秒）
 * @property duration 持续时间（毫秒）
 *
 * @see ILyricTiming
 */
@Serializable
data class LyricTiming(
    override var begin: Long,
    override var end: Long,
    override var duration: Long
) : ILyricTiming

/**
 * 构造期的持续时间兜底。
 *
 * 仅在 `duration == 0` 且 `end > begin` 时用 `end - begin` 补全，其余情况原样返回；
 * [LyricTiming] 刻意不参与兜底。集中此处的目的是让 [LyricWord]、[LyricLine]、
 * [RichLyricLine] 三处 `init` 的时间语义保持完全一致，避免规则散落产生分歧。
 *
 * @param begin 开始时间（毫秒）
 * @param end 结束时间（毫秒）
 * @param duration 调用方提供的持续时间（毫秒）
 * @return 兜底后的持续时间（毫秒）
 */
internal fun fallbackZeroDuration(begin: Long, end: Long, duration: Long): Long =
    if (duration == 0L && end > begin) end - begin else duration

/**
 * 规范化期的持续时间兜底。
 *
 * `duration <= 0` 时一律以 `end - begin` 为准，用于修正歌词源里
 * "duration 与 begin/end 不一致"的脏数据（`begin`/`end` 为唯一事实来源）。
 *
 * @param begin 开始时间（毫秒）
 * @param end 结束时间（毫秒）
 * @param duration 待校验的持续时间（毫秒）
 * @return 合法的持续时间（毫秒）；`end <= begin` 时返回非正值，交由上层决定是否剔除
 */
internal fun resolveDuration(begin: Long, end: Long, duration: Long): Long =
    if (duration > 0L) duration else end - begin

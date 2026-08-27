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

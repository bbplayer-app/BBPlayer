/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model.interfaces

/**
 * 歌词时间基元接口，所有带时间轴歌词元素的公共契约。
 *
 * 表示一个歌词元素（行、单词等）在时间轴上的生命周期，**时间单位统一为毫秒 (ms)**。
 *
 * 约定：
 * - 合法的生命周期满足 `begin >= 0` 且 `end > begin`，此时 `duration == end - begin`；
 * - 当 `duration == 0` 且 `end > begin` 时，实现类
 *   [io.github.proify.lyricon.lyric.model.LyricLine]、
 *   [io.github.proify.lyricon.lyric.model.LyricWord]
 *   会在初始化时自动以 `end - begin` 兜底；纯时间数据类
 *   [io.github.proify.lyricon.lyric.model.LyricTiming] 不提供兜底。
 *
 * @property begin 开始时间（毫秒）
 * @property end 结束时间（毫秒）
 * @property duration 持续时间（毫秒）
 *
 * @see io.github.proify.lyricon.lyric.model.LyricTiming
 * @see io.github.proify.lyricon.lyric.model.LyricLine
 * @see io.github.proify.lyricon.lyric.model.LyricWord
 */
interface ILyricTiming {
    var begin: Long
    var end: Long
    var duration: Long
}

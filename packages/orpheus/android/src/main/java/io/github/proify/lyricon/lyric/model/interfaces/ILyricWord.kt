/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model.interfaces

import io.github.proify.lyricon.lyric.model.LyricMetadata

/**
 * 带时间轴的歌词单词契约。
 *
 * 扩展自 [ILyricTiming]，在生命周期之外携带单词文本与单词级元数据，
 * 用于逐词卡拉OK等需要精确到词的时间场景。时间单位为毫秒 (ms)。
 *
 * @property text 单词文本；允许为空白字符串（规范化时作为词间分隔符保留）
 * @property metadata 单词级元数据
 *
 * @see ILyricTiming
 * @see io.github.proify.lyricon.lyric.model.LyricWord
 */
interface ILyricWord : ILyricTiming {
    var text: String?
    var metadata: LyricMetadata?
}

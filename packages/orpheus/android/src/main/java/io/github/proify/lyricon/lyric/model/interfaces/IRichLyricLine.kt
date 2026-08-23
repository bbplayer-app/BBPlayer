/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model.interfaces

import io.github.proify.lyricon.lyric.model.LyricWord

/**
 * 富歌词行契约，一行内同时承载多份文本与其各自的逐词时间轴。
 *
 * 扩展自 [ILyricLine]，在行级基础属性（继承自 [ILyricLine] 的 time 字段、
 * [ILyricLine.text]、[ILyricLine.words] 等）之上增加：
 * - **次要文本**：[secondary]/[secondaryWords]，如主题句、伴奏提示等附加字幕；
 * - **翻译**：[translation]/[translationWords]，主要翻译文本，可与主文本逐词对齐；
 * - **罗马音**：[roma]，主文本的罗马音注音（无独立逐词时间轴）。
 *
 * 各文本字段与其 `*Words` 字段互为冗余：规范化（[normalize]）后由 `*Words`
 * 重新生成对应文本，无法生成时保留原文本。
 *
 * @property secondary 次要文本
 * @property secondaryWords 次要文本的逐词数据
 * @property translation 主要翻译文本
 * @property translationWords 主要翻译文本的逐词数据
 * @property roma 主文本的罗马音注音
 *
 * @see ILyricLine
 * @see io.github.proify.lyricon.lyric.model.RichLyricLine
 * @see io.github.proify.lyricon.lyric.model.Song
 */
interface IRichLyricLine : ILyricLine {
    var secondary: String?
    var secondaryWords: List<LyricWord>?
    var translation: String?
    var translationWords: List<LyricWord>?
    var roma: String?
}

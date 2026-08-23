/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model.interfaces

import io.github.proify.lyricon.lyric.model.LyricMetadata
import io.github.proify.lyricon.lyric.model.LyricWord

/**
 * 带时间轴与逐词数据的歌词行契约。
 *
 * 扩展自 [ILyricTiming]，在生命周期之外携带渲染方向、行级元数据、整行文本
 * 与逐词数据。一般用于逐字卡拉OK（整行按单词切分）场景；需要多份文本
 * （次要文本/翻译/罗马音）时使用 [IRichLyricLine]。时间单位为毫秒 (ms)。
 *
 * @property isAlignedRight 是否渲染显示在右边（右对齐）
 * @property metadata 行级元数据
 * @property text 整行文本；与 [words] 互为冗余，规范化后由 [words] 重新生成
 * @property words 逐词数据列表；非空时优先作为渲染文本来源
 *
 * @see ILyricTiming
 * @see ILyricWord
 * @see IRichLyricLine
 * @see io.github.proify.lyricon.lyric.model.LyricLine
 */
interface ILyricLine : ILyricTiming {
    var isAlignedRight: Boolean
    var metadata: LyricMetadata?
    var text: String?
    var words: List<LyricWord>?
}

/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.lyric.model

import io.github.proify.lyricon.lyric.model.extensions.deepCopy
import io.github.proify.lyricon.lyric.model.extensions.normalize
import io.github.proify.lyricon.lyric.model.interfaces.DeepCopyable
import io.github.proify.lyricon.lyric.model.interfaces.ILyricLine
import io.github.proify.lyricon.lyric.model.interfaces.Normalize
import kotlinx.serialization.Serializable

/**
 * 歌词行
 *
 * @property begin 开始时间
 * @property end 结束时间
 * @property duration 持续时间
 * @property isAlignedRight 是否渲染显示在右边
 * @property metadata 元数据
 * @property text 文本
 * @property words 文本单词列表
 */
@Serializable
data class LyricLine(
    override var begin: Long = 0,
    override var end: Long = 0,
    override var duration: Long = 0,
    override var isAlignedRight: Boolean = false,
    override var metadata: LyricMetadata? = null,
    override var text: String? = null,
    override var words: List<LyricWord>? = null,
) : ILyricLine, DeepCopyable<LyricLine>, Normalize<LyricLine> {

    init {
        if (duration == 0L && end > begin) duration = end - begin
    }

    override fun deepCopy(): LyricLine = copy(
        words = words?.deepCopy()
    )

    override fun normalize(): LyricLine = deepCopy().apply {
        words = words?.normalize()
        text = words
            ?.takeIf { it.isNotEmpty() }
            ?.joinToString("") { it.text.orEmpty() }
            ?: text
    }
}
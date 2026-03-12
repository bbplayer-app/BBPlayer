/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.lyric.model

import io.github.proify.lyricon.lyric.model.interfaces.DeepCopyable
import io.github.proify.lyricon.lyric.model.interfaces.ILyricWord
import kotlinx.serialization.Serializable

/**
 * 歌词单词
 *
 * @property begin 开始时间
 * @property end 结束时间
 * @property duration 持续时间
 * @property text 文本
 * @property metadata 元数据
 */
@Serializable
data class LyricWord(
    override var begin: Long = 0,
    override var end: Long = 0,
    override var duration: Long = 0,
    override var text: String? = null,
    override var metadata: LyricMetadata? = null,
) : ILyricWord, DeepCopyable<LyricWord> {

    init {
        if (duration == 0L && end > begin) duration = end - begin
    }

    override fun deepCopy(): LyricWord = copy()
}
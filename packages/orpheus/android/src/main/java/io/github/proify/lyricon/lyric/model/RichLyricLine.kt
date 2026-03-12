/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.lyric.model

import io.github.proify.lyricon.lyric.model.extensions.deepCopy
import io.github.proify.lyricon.lyric.model.extensions.normalize
import io.github.proify.lyricon.lyric.model.interfaces.DeepCopyable
import io.github.proify.lyricon.lyric.model.interfaces.IRichLyricLine
import io.github.proify.lyricon.lyric.model.interfaces.Normalize
import kotlinx.serialization.Serializable

/**
 * 富歌词
 *
 * @property begin 开始时间
 * @property end 结束时间
 * @property duration 持续时间
 * @property isAlignedRight 是否显示在右边
 * @property metadata 元数据
 * @property text 主文本
 * @property words 主文本单词列表
 * @property secondary 次要文本
 * @property secondaryWords 次要文本单词列表
 * @property translation 主要翻译文本
 * @property translationWords 主要翻译文本单词列表
 */
@Serializable
data class RichLyricLine(
    override var begin: Long = 0,
    override var end: Long = 0,
    override var duration: Long = 0,
    override var isAlignedRight: Boolean = false,
    override var metadata: LyricMetadata? = null,
    override var text: String? = null,
    override var words: List<LyricWord>? = null,
    override var secondary: String? = null,
    override var secondaryWords: List<LyricWord>? = null,
    override var translation: String? = null,
    override var translationWords: List<LyricWord>? = null,
    override var roma: String? = null
) : IRichLyricLine, DeepCopyable<RichLyricLine>, Normalize<RichLyricLine> {

    init {
        if (duration == 0L && end > begin) duration = end - begin
    }

    override fun deepCopy(): RichLyricLine = copy(
        words = words?.deepCopy(),
        secondaryWords = secondaryWords?.deepCopy(),
        translationWords = translationWords?.deepCopy(),
    )

    override fun normalize(): RichLyricLine = deepCopy().apply {
        words = words?.normalize()
        text = words.toText(text)
        secondaryWords = secondaryWords?.normalize()
        secondary = secondaryWords.toText(secondary)
        translationWords = translationWords?.normalize()
        translation = translationWords.toText(translation)
    }

    private fun List<LyricWord>?.toText(default: String?): String? =
        if (isNullOrEmpty()) default else joinToString("") { it.text.orEmpty() }
}
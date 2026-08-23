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
 * 富歌词行，一行歌词的完整表示，也是 [Song.lyrics] 的元素类型。
 *
 * 在一行内同时承载多份文本与各自独立的逐词时间轴：
 * - **主文本**（[text]/[words]）：歌词主体；
 * - **次要文本**（[secondary]/[secondaryWords]）：如主题句、伴奏提示等附加字幕；
 * - **翻译**（[translation]/[translationWords]）：主要翻译文本，可与主文本逐词对齐；
 * - **罗马音**（[roma]）：主文本的罗马音注音，无独立逐词时间轴。
 *
 * - **时间单位为毫秒 (ms)**；初始化时若 `duration == 0` 且 `end > begin`，
 *   会自动以 `end - begin` 兜底。
 * - 各文本字段与其 `*Words` 字段互为冗余：[normalize] 会逐组规范化 `*Words`，
 *   并用其重新生成对应文本，无法生成时保留原文本。
 *
 * @property begin 开始时间（毫秒）
 * @property end 结束时间（毫秒）
 * @property duration 持续时间（毫秒）
 * @property isAlignedRight 是否渲染显示在右边（右对齐）
 * @property metadata 行级元数据
 * @property text 主文本；与 [words] 互为冗余
 * @property words 主文本的逐词数据
 * @property secondary 次要文本；与 [secondaryWords] 互为冗余
 * @property secondaryWords 次要文本的逐词数据
 * @property translation 主要翻译文本；与 [translationWords] 互为冗余
 * @property translationWords 主要翻译文本的逐词数据
 * @property roma 主文本的罗马音注音
 *
 * @see IRichLyricLine
 * @see LyricLine
 * @see Song
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

    /**
     * 返回本行的深拷贝。
     *
     * 除按值复制基础字段外，会分别深拷贝 [words]、[secondaryWords]、
     * [translationWords] 三个列表（每个单词元素均重新创建副本），
     * 因此结果与原实例不共享任何可变引用。
     *
     * @return 本行的深拷贝
     */
    override fun deepCopy(): RichLyricLine = copy(
        words = words?.deepCopy(),
        secondaryWords = secondaryWords?.deepCopy(),
        translationWords = translationWords?.deepCopy(),
    )

    /**
     * 返回规范化后的深拷贝，原对象不受影响。
     *
     * 先深拷贝自身；随后对三组 `*Words` 逐词规范化（丢弃无效词、修正持续时间、
     * 合并碎片、填充空隙），并分别用非空的 `*Words` 重新生成 [text]、[secondary]、
     * [translation]（对应 `*Words` 为空时保留原文本）。
     *
     * @return 规范化后的深拷贝
     */
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

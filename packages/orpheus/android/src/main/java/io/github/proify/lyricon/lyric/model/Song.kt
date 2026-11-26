/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model

import io.github.proify.lyricon.lyric.model.extensions.deepCopy
import io.github.proify.lyricon.lyric.model.extensions.normalize
import io.github.proify.lyricon.lyric.model.extensions.sortedByBegin
import io.github.proify.lyricon.lyric.model.interfaces.DeepCopyable
import io.github.proify.lyricon.lyric.model.interfaces.Normalize
import kotlinx.serialization.Serializable

/**
 * 歌曲信息，歌词数据的顶层容器。
 *
 * 数据层次：`Song → [lyrics] → [RichLyricLine] → [LyricWord]`。
 * **时间单位为毫秒 (ms)**。
 *
 * [normalize] 会返回一个新的深拷贝（原对象不受影响），并逐层收口：
 * - 行级规范化：对每一行调用 [RichLyricLine.normalize]，即规范化三组逐词数据
 *   （丢弃无效词、修正持续时间、合并 ASCII 碎片、填充空隙）并重建文本；
 *   主文本为空但逐词数据有效的行会在这一步重建出文本并被保留；
 * - 修正持续时间：`duration <= 0` 时以 `end - begin` 兜底；
 * - 剔除非法行：`begin < 0`、`begin >= end`、`duration <= 0` 或文本为空白；
 * - 按 `begin` 升序稳定排序。
 *
 * 注意：仅承载翻译/次要文本而无主文本的行（[RichLyricLine.text] 为空白且
 * [RichLyricLine.words] 为空）仍会被剔除，与历史行为一致。
 *
 * @property id 歌曲唯一标识
 * @property name 歌曲名
 * @property artist 艺术家
 * @property duration 歌曲时长（毫秒）
 * @property metadata 歌曲级元数据
 * @property lyrics 歌词行列表，每行为一个 [RichLyricLine]
 *
 * @see RichLyricLine
 * @see LyricMetadata
 */
@Serializable
data class Song(
    var id: String? = null,
    var name: String? = null,
    var artist: String? = null,
    var duration: Long = 0,
    var metadata: LyricMetadata? = null,
    var lyrics: List<RichLyricLine>? = null,
) : DeepCopyable<Song>, Normalize<Song> {

    /**
     * 返回本歌曲的深拷贝。
     *
     * 除按值复制基础字段外，会深拷贝 [lyrics] 列表（每行及其逐词数据均重新创建副本），
     * 因此结果与原实例不共享任何可变引用。
     *
     * @return 本歌曲的深拷贝
     */
    override fun deepCopy(): Song = copy(lyrics = lyrics?.deepCopy())

    /**
     * 返回规范化后的深拷贝，原对象不受影响。
     *
     * 实现为单遍处理：每行只深拷贝一次（[RichLyricLine.normalize] 自身即返回深拷贝），
     * 随后就地修正持续时间、剔除非法行并排序，不额外复制整棵对象图。
     *
     * @return 规范化后的深拷贝
     */
    override fun normalize(): Song = copy(lyrics = normalizedLyrics())

    /**
     * 逐行规范化 → 剔除不可渲染行 → 按开始时间稳定排序。
     *
     * @return 规范化后的歌词行列表；[lyrics] 为 `null` 时返回 `null`
     */
    private fun normalizedLyrics(): List<RichLyricLine>? = lyrics
        ?.map { it.normalize() }
        ?.mapNotNull(::keepIfRenderable)
        ?.sortedByBegin()

    /**
     * 修正持续时间并判断该行是否可渲染。
     *
     * [line] 来自 [RichLyricLine.normalize]，是原始对象的深拷贝，
     * 因此此处的就地修正不会污染调用方数据。
     */
    private fun keepIfRenderable(line: RichLyricLine): RichLyricLine? {
        val resolvedDuration = resolveDuration(line.begin, line.end, line.duration)

        val isRenderable = line.begin >= 0 &&
                line.begin < line.end &&
                resolvedDuration > 0 &&
                !line.text.isNullOrBlank()

        if (!isRenderable) return null

        line.duration = resolvedDuration
        return line
    }
}

/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model

import io.github.proify.lyricon.lyric.model.extensions.deepCopy
import io.github.proify.lyricon.lyric.model.extensions.normalizeSortByTime
import io.github.proify.lyricon.lyric.model.interfaces.DeepCopyable
import io.github.proify.lyricon.lyric.model.interfaces.Normalize
import kotlinx.serialization.Serializable

/**
 * 歌曲信息，歌词数据的顶层容器。
 *
 * 数据层次：`Song → [lyrics] → [RichLyricLine] → [LyricWord]`。
 * **时间单位为毫秒 (ms)**。
 *
 * [normalize] 会返回一个新的深拷贝（原对象不受影响）：
 * - 剔除非法行：`begin < 0`、`begin >= end`、`duration <= 0` 或
 *   [RichLyricLine.text] 为空白；
 * - 对剩余行修正 `duration` 兜底值（`duration <= 0` 时取 `end - begin`）；
 * - 按 `begin` 升序稳定排序。
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
     * 依次完成：修正剩余行的 `duration` 兜底值、剔除非法行（见类文档的判定条件）、
     * 以及按 `begin` 升序稳定排序；非法行被剔除后列表可能变短或为空。
     *
     * @return 规范化后的深拷贝
     */
    override fun normalize(): Song = deepCopy().apply {
        lyrics = lyrics?.mapNotNull { line ->
            if (line.duration <= 0) line.duration = line.end - line.begin

            val isValid = line.begin >= 0
                    && line.begin < line.end
                    && line.duration > 0
                    && !line.text.isNullOrBlank()
            if (isValid) line else null
        }?.normalizeSortByTime()
    }
}

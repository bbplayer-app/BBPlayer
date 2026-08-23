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
 * 歌词行，带时间轴、渲染属性与逐词数据的一行歌词。
 *
 * - **时间单位为毫秒 (ms)**；初始化时若 `duration == 0` 且 `end > begin`，
 *   会自动以 `end - begin` 兜底。
 * - [text] 与 [words] 互为冗余：规范化（[normalize]）后由 [words] 重新拼接出 [text]，
 *   [words] 为空或拼接结果为空时保留原 [text]。
 * - [isAlignedRight] 表示本行渲染时是否靠右对齐（如副歌、伴唱行）。
 *
 * @property begin 开始时间（毫秒）
 * @property end 结束时间（毫秒）
 * @property duration 持续时间（毫秒）
 * @property isAlignedRight 是否渲染显示在右边（右对齐）
 * @property metadata 行级元数据
 * @property text 行文本；与 [words] 互为冗余，规范化后由 [words] 重新生成
 * @property words 逐词数据列表；非空时优先作为渲染文本来源
 *
 * @see ILyricLine
 * @see RichLyricLine
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

    /**
     * 返回本行的深拷贝。
     *
     * 除按值复制基础字段外，会深拷贝 [words] 列表（每个单词元素均重新创建副本），
     * 因此结果与原实例不共享任何可变引用。
     *
     * @return 本行的深拷贝
     */
    override fun deepCopy(): LyricLine = copy(
        words = words?.deepCopy()
    )

    /**
     * 返回规范化后的深拷贝，原对象不受影响。
     *
     * 先深拷贝自身；随后对 [words] 逐词规范化（丢弃无效词、修正持续时间、
     * 合并碎片、填充空隙）；最后用非空的 [words] 重新拼接 [text]，
     * [words] 为空或拼接结果为空时保留原 [text]。
     *
     * @return 规范化后的深拷贝
     */
    override fun normalize(): LyricLine = deepCopy().apply {
        words = words?.normalize()
        text = words
            ?.takeIf { it.isNotEmpty() }
            ?.joinToString("") { it.text.orEmpty() }
            ?: text
    }
}

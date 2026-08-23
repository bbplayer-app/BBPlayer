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
 * 歌词单词，带独立时间轴的最小文本单元。
 *
 * 用于逐词卡拉OK（行内单词级时间戳）等场景，通常作为 [LyricLine.words] 的元素。
 * **时间单位为毫秒 (ms)**。
 *
 * 初始化时若 `duration == 0` 且 `end > begin`，会自动以 `end - begin` 兜底。
 * [text] 允许包含空白字符串（规范化时作为词间分隔符保留），为空表示无有效文本。
 *
 * @property begin 开始时间（毫秒）
 * @property end 结束时间（毫秒）
 * @property duration 持续时间（毫秒）
 * @property text 文本内容；可为空白（分隔符），不允许为 null 时参与渲染
 * @property metadata 单词级元数据
 *
 * @see ILyricWord
 * @see LyricLine
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

    /**
     * 返回本单词的深拷贝。
     *
     * 本类的全部字段均为不可变类型（值类型，以及只读委托的 [LyricMetadata]），
     * 因此 `copy()` 即等价于深拷贝，结果不共享任何可变引用。
     *
     * @return 本单词的深拷贝
     */
    override fun deepCopy(): LyricWord = copy()
}

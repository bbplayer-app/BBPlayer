/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model.extensions

import io.github.proify.lyricon.lyric.model.LyricWord
import io.github.proify.lyricon.lyric.model.resolveDuration

/**
 * 孤立无效词的兜底结束时间（毫秒）。
 *
 * 当整行单词的时间戳全部无效时会构造一个占位词，仅保证 `duration > 0`
 * 从而不被上层剔除，**不代表真实演唱时长**。
 */
private const val ORPHAN_WORD_END_MS = 100L

/**
 * 规范化歌词单词列表。
 *
 * 处理无效的时间戳、修正持续时间、合并碎片单词以及填充空隙，返回新列表，
 * **不修改原列表及原单词**（内部先对输入逐词深拷贝，所有修正只作用于副本）。
 * 常作为 [io.github.proify.lyricon.lyric.model.LyricLine.normalize]
 * 等规范化流程的中间步骤。
 *
 * 规则说明：
 * - 空文本单词会被丢弃，空白文本会保留为分隔符；
 * - 时间有效的单词必须满足 `begin >= 0` 且 `end > begin`；
 * - 时间无效的单词会先缓存，之后按可用时间空隙填充，或合并到相邻有效单词；
 * - `duration > 0` 会保留；`duration <= 0` 时使用 `end - begin` 兜底；
 * - ASCII 字母/数字片段之间如果没有空白分隔符，会按同一个英文单词合并。
 *
 * @return 规范化后的新列表；原列表不含任何有效文本时返回空列表
 *
 * @see LyricWord
 */
fun List<LyricWord>.normalize(): List<LyricWord> {
    // 0. 只处理副本：本函数承诺不修改调用方传入的单词对象
    val source = map { it.deepCopy() }

    // 1. 过滤掉没有文本内容的单词
    val validTextWords = source.filter { !it.text.isNullOrEmpty() }

    if (validTextWords.isEmpty()) {
        return emptyList()
    }

    val result = ArrayList<LyricWord>(validTextWords.size)
    val invalidBuffer = ArrayList<LyricWord>()

    var lastEndTime = 0L

    for (word in validTextWords) {
        // 判断单词时间是否有效: 开始时间必须非负,且结束时间必须大于开始时间
        val isTimeValid = word.begin >= 0 && word.end > word.begin

        if (isTimeValid) {
            // --- 处理堆积的无效单词 ---
            if (invalidBuffer.isNotEmpty()) {
                val combinedText = invalidBuffer.joinToString("") { it.text ?: "" }
                val gap = word.begin - lastEndTime

                if (gap > 0) {
                    // 情况 A: 存在时间空隙, 用空隙承载缓冲文本(不额外占用相邻词的时间)
                    result.add(
                        LyricWord(
                            begin = lastEndTime,
                            end = word.begin,
                            text = combinedText
                        )
                    )
                } else {
                    // 情况 B: 空间不足,需要合并文本
                    if (result.isNotEmpty()) {
                        // 如果有前一个单词,合并到前一个单词后面 (Suffix)
                        val prev = result.last()
                        prev.text = (prev.text ?: "") + combinedText
                    } else {
                        // 如果没有前一个单词(即无效单词在整个列表最前面且空间不足),合并到当前单词前面 (Prefix)
                        word.text = combinedText + (word.text ?: "")
                    }
                }
                invalidBuffer.clear()
            }

            // --- 处理当前有效单词 ---
            // duration 无效(<=0)时以 begin/end 为唯一事实来源兜底
            word.duration = resolveDuration(word.begin, word.end, word.duration)
            result.add(word)

            // 更新最后结束时间
            lastEndTime = word.end
        } else {
            // 当前单词时间无效,加入缓冲区等待处理
            invalidBuffer.add(word)
        }
    }

    // --- 处理列表末尾残留的无效单词 ---
    if (invalidBuffer.isNotEmpty()) {
        val combinedText = invalidBuffer.joinToString("") { it.text ?: "" }

        if (result.isNotEmpty()) {
            // 如果前面有单词,合并到最后一个单词的后缀
            val lastWord = result.last()
            lastWord.text = (lastWord.text ?: "") + combinedText
        } else {
            // 如果全是无效单词 (孤立情况),创建一个最小可渲染的占位词
            result.add(
                LyricWord(
                    begin = 0,
                    end = ORPHAN_WORD_END_MS,
                    text = combinedText
                )
            )
        }
    }

    return result.sortedByBegin().mergeAsciiWordFragments()
}

/**
 * 合并没有空白分隔的 ASCII 字母/数字片段。
 *
 * 部分歌词源会把英文复合词拆成多个有时间戳的片段，例如 under + ground。
 * 这些片段之间没有独立空格词，因此规范化后应作为同一个词显示。
 */
private fun List<LyricWord>.mergeAsciiWordFragments(): List<LyricWord> {
    if (size < 2) return this

    val result = ArrayList<LyricWord>(size)

    for (word in this) {
        val previous = result.lastOrNull()

        if (previous != null && previous.canMergeAsciiWordFragmentWith(word)) {
            previous.text = previous.text.orEmpty() + word.text.orEmpty()
            previous.end = maxOf(previous.end, word.end)
            // 合并后跨度已变，按 begin/end 重新派生 duration，避免累加放大历史误差
            previous.duration = resolveDuration(previous.begin, previous.end, 0L)
        } else {
            result.add(word)
        }
    }

    return result
}

private fun LyricWord.canMergeAsciiWordFragmentWith(next: LyricWord): Boolean =
    text.isAsciiWordFragment() && next.text.isAsciiWordFragment() && end == next.begin

private fun String?.isAsciiWordFragment(): Boolean =
    !isNullOrEmpty() && all { it.isLetterOrDigit() && it.code < 128 }

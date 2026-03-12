/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model.extensions

import io.github.proify.lyricon.lyric.model.LyricWord

/**
 * 规范化歌词单词列表。
 * 处理无效的时间戳、修正持续时间、合并碎片单词以及填充空隙。
 */
fun List<LyricWord>.normalize(): List<LyricWord> {
    // 1. 过滤掉没有文本内容的单词
    val validTextWords = this.filter { !it.text.isNullOrEmpty() }

    if (validTextWords.isEmpty()) {
        return emptyList()
    }

    val result = ArrayList<LyricWord>()
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
                    // 情况 A: 有足够的空间 (Gap > 1),创建一个填补单词
                    val filler = LyricWord().apply {
                        this.text = combinedText
                        this.begin = lastEndTime
                        this.end = word.begin
                        this.duration = this.end - this.begin
                    }
                    result.add(filler)
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
            // 强制修正 duration 字段
            if (word.duration <= 0) word.duration = word.end - word.begin
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
            // 如果全是无效单词 (孤立情况),创建一个新单词
            val newWord = LyricWord().apply {
                this.text = combinedText
                this.begin = 0
                this.end = 100
                this.duration = 100
            }
            result.add(newWord)
        }
    }

    return result.normalizeSortByTime()
}
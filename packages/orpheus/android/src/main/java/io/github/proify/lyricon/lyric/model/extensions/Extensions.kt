/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
@file:Suppress("unused")

package io.github.proify.lyricon.lyric.model.extensions

import io.github.proify.lyricon.lyric.model.LyricWord
import io.github.proify.lyricon.lyric.model.interfaces.DeepCopyable
import io.github.proify.lyricon.lyric.model.interfaces.ILyricTiming
import io.github.proify.lyricon.lyric.model.interfaces.Normalize

/**
 * 按 [ILyricTiming.begin] 升序稳定排序。
 *
 * 返回新列表，原列表不变；`begin` 相同的元素保持原有相对顺序。
 *
 * @param T 实现 [ILyricTiming] 的元素类型
 * @return 按开始时间升序排列的新列表
 */
fun <T : ILyricTiming> List<T>.sortedByBegin(): List<T> = sortedBy { it.begin }

/**
 * [sortedByBegin] 的历史名称。
 *
 * 原名带 `normalize` 前缀但只做排序，容易让调用方误以为会修正时间值；
 * 保留一版（标记为废弃）以便下游平滑迁移。
 *
 * @param T 实现 [ILyricTiming] 的元素类型
 * @return 按开始时间升序排列的新列表
 */
@Deprecated(
    message = "命名与行为不符（本函数只做排序），请改用 sortedByBegin()",
    replaceWith = ReplaceWith("sortedByBegin()")
)
fun <T : ILyricTiming> List<T>.normalizeSortByTime(): List<T> = sortedByBegin()

/**
 * 对列表逐元素深拷贝。
 *
 * 返回的新列表中的每个元素都是原元素 [DeepCopyable.deepCopy] 的副本，
 * 与原列表不共享任何可变引用。
 *
 * @param T 实现 [DeepCopyable] 的元素类型
 * @return 逐元素深拷贝后的新列表
 */
fun <T : DeepCopyable<T>> List<T>.deepCopy(): List<T> = map { it.deepCopy() }

/**
 * 对列表逐元素规范化。
 *
 * 返回的新列表中的每个元素都是 [Normalize.normalize] 的结果（本身即为深拷贝），
 * 原列表及其元素均不会被修改。
 *
 * @param T 实现 [Normalize] 的元素类型
 * @return 逐元素规范化后的新列表
 */
fun <T : Normalize<T>> List<T>.normalize(): List<T> = map { it.normalize() }

/**
 * 用逐词数据重建整行文本。
 *
 * [LyricLine][io.github.proify.lyricon.lyric.model.LyricLine] 与
 * [RichLyricLine][io.github.proify.lyricon.lyric.model.RichLyricLine]
 * 的各组文本字段共用本逻辑，避免同一条规则出现两份实现。
 *
 * 接收者为 `null` 或空列表时返回 [default]（即保留原文本）；否则按顺序拼接
 * 每个单词的文本，单词文本为 `null` 时按空串处理。
 *
 * @param default 逐词数据缺失时保留的原文本
 * @return 重建后的文本，或 [default]
 */
internal fun List<LyricWord>?.rebuildTextOr(default: String?): String? =
    if (isNullOrEmpty()) default else joinToString("") { it.text.orEmpty() }

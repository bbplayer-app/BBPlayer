/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 */

package io.github.proify.lyricon.lyric.model.extensions

import io.github.proify.lyricon.lyric.model.interfaces.ILyricTiming

/**
 * 毫秒级时间轴导航器，支持重叠歌词的高效检索。
 *
 * @property source 必须按 [ILyricTiming.begin] 升序排列的数据源。
 */
class TimingNavigator<T : ILyricTiming>(
    val source: Array<T>
) {
    val size: Int = source.size

    /** 记录 0..i 范围内的最大结束时间，用于 O(log N) 级别的重叠回溯剪枝 */
    val maxEndSoFar: LongArray = LongArray(size).apply {
        var currentMax = -1L
        for (i in source.indices) {
            currentMax = maxOf(currentMax, source[i].end)
            this[i] = currentMax
        }
    }

    var lastMatchedIndex: Int = -1
        private set

    var lastQueryPosition: Long = -1L
        private set

    fun first(position: Long): T? {
        val index = findTargetIndex(position)
        updateCache(position, index)
        if (index == -1) return null

        // 确保返回的是当前时间点真正匹配的那一个（因为 targetIndex 只是起始点的边界）
        return if (position <= source[index].end) source[index] else {
            var found: T? = null
            resolveOverlapping(position, index) { found = it; return@resolveOverlapping }
            found
        }
    }

    inline fun forEachAt(position: Long, action: (T) -> Unit): Int {
        if (size == 0) return 0

        val anchorIndex = findTargetIndex(position)
        updateCache(position, anchorIndex)

        if (anchorIndex == -1) return 0

        return resolveOverlapping(position, anchorIndex, action)
    }

    inline fun forEachAtOrPrevious(position: Long, action: (T) -> Unit): Int {
        val count = forEachAt(position, action)
        if (count > 0) return count

        val previous = findPreviousEntry(position) ?: return 0
        action(previous)
        return 1
    }

    fun findPreviousEntry(position: Long): T? {
        val idx = findUpperBound(position)
        return if (idx >= 0) source[idx] else null
    }

    @Suppress("unused")
    fun resetCache() {
        lastMatchedIndex = -1
        lastQueryPosition = -1L
    }

    /**
     * 定位起始时间小于等于 [position] 的最后一个索引。
     */
    fun findTargetIndex(position: Long): Int {
        if (size == 0 || position < source[0].begin) return -1

        val lastIdx = lastMatchedIndex
        // 顺序播放优化
        if (lastIdx >= 0 && position >= lastQueryPosition) {
            if (position >= source[lastIdx].begin) {
                val nextIdx = lastIdx + 1
                if (nextIdx < size && position >= source[nextIdx].begin) {
                    // 若下一条也满足起始条件，且再下一条不满足，则顺序步进成功
                    val nNext = nextIdx + 1
                    if (nNext >= size || position < source[nNext].begin) return nextIdx
                } else {
                    return lastIdx
                }
            }
        }

        return findUpperBound(position)
    }

    private fun findUpperBound(position: Long): Int {
        var low = 0
        var high = size - 1
        var ans = -1
        while (low <= high) {
            val mid = (low + high) ushr 1
            if (source[mid].begin <= position) {
                ans = mid
                low = mid + 1
            } else {
                high = mid - 1
            }
        }
        return ans
    }

    @PublishedApi
    internal inline fun resolveOverlapping(
        position: Long,
        anchorIndex: Int,
        action: (T) -> Unit
    ): Int {
        var start = anchorIndex

        // 利用 maxEndSoFar 快速跳过不可能重叠的区域
        while (start > 0 && maxEndSoFar[start - 1] >= position) {
            start--
        }

        var count = 0
        for (i in start..anchorIndex) {
            val entry = source[i]
            if (position <= entry.end && position >= entry.begin) {
                action(entry)
                count++
            }
        }
        return count
    }

    @PublishedApi
    internal fun updateCache(position: Long, index: Int) {
        lastQueryPosition = position
        lastMatchedIndex = index
    }
}
/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.lyric.model.extensions

import io.github.proify.lyricon.lyric.model.interfaces.ILyricTiming

/**
 * 毫秒级时间轴导航器，支持重叠歌词的高效检索。
 *
 * @property source 必须按 [ILyricTiming.begin] 升序排列的数据源。
 * @param T 实现 [ILyricTiming] 接口的数据类型。
 */
class TimingNavigator<T : ILyricTiming>(
    val source: Array<T>
) {
    /** 歌词源总数 */
    val size: Int = source.size

    /**
     * 记录 0..i 范围内的最大结束时间。
     * 该数组具有单调递增属性，用于在 [resolveOverlapping] 中进行二分查找。
     */
    val maxEndSoFar: LongArray = LongArray(size)

    init {
        var currentMax = -1L
        for (i in source.indices) {
            val end = source[i].end
            if (end > currentMax) {
                currentMax = end
            }
            maxEndSoFar[i] = currentMax
        }
    }

    /** 缓存最后一次匹配成功的索引，用于顺序播放优化 */
    var lastMatchedIndex: Int = -1
        private set

    /** 记录最后一次查询的时间戳 */
    var lastQueryPosition: Long = -1L
        private set

    /**
     * 获取指定位置 [position] 匹配的第一条记录。
     */
    fun first(position: Long): T? {
        val index = findTargetIndex(position)
        updateCache(position, index)
        if (index == -1) return null

        if (position <= source[index].end) {
            return source[index]
        }

        resolveOverlapping(position, index) { return it }
        return null
    }

    /**
     * 遍历指定位置 [position] 处的所有有效记录（包含重叠部分）。
     * @param action 对每个匹配项执行的回调。
     * @return 找到的匹配项总数。
     */
    inline fun forEachAt(position: Long, action: (T) -> Unit): Int {
        if (size == 0) return 0

        val anchorIndex = findTargetIndex(position)
        updateCache(position, anchorIndex)

        if (anchorIndex == -1) return 0

        return resolveOverlapping(position, anchorIndex, action)
    }

    /**
     * 遍历 [position] 处的记录，若当前点无记录，则返回最近的一条历史记录。
     */
    inline fun forEachAtOrPrevious(position: Long, action: (T) -> Unit): Int {
        val count = forEachAt(position, action)
        if (count > 0) return count

        val previous = findPreviousEntry(position) ?: return 0
        action(previous)
        return 1
    }

    /**
     * 寻找起始时间小于等于 [position] 的最后一条记录。
     */
    fun findPreviousEntry(position: Long): T? {
        val idx = findUpperBound(position)
        return if (idx >= 0) source[idx] else null
    }

    /**
     * 手动重置缓存，在手动跳进度或切换歌曲时使用。
     */
    @Suppress("unused")
    fun resetCache() {
        lastMatchedIndex = -1
        lastQueryPosition = -1L
    }

    /**
     * 定位起始时间小于等于 [position] 的最后一个索引。
     * 包含短步长顺序扫描优化。
     */
    fun findTargetIndex(position: Long): Int {
        if (size == 0 || position < source[0].begin) return -1

        val lastIdx = lastMatchedIndex
        // 顺序播放优化：短步长前向探测
        if (lastIdx >= 0 && position >= lastQueryPosition && position >= source[lastIdx].begin) {
            var currIdx = lastIdx
            var steps = 0
            // 阈值设为 4，超过则切换为二分查找以维持 logN 效率
            while (currIdx + 1 < size && source[currIdx + 1].begin <= position) {
                currIdx++
                steps++
                if (steps > 4) return findUpperBound(position)
            }
            return currIdx
        }

        return findUpperBound(position)
    }

    /**
     * 标准二分查找，定位第一个起始时间大于 [position] 的索引的前一个位置。
     */
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

    /**
     * 解决重叠检索的核心逻辑。
     * 利用 [maxEndSoFar] 的单调性排除不可能重叠的区间。
     */
    @PublishedApi
    internal inline fun resolveOverlapping(
        position: Long,
        anchorIndex: Int,
        action: (T) -> Unit
    ): Int {
        var low = 0
        var high = anchorIndex
        var start = anchorIndex

        // 二分定位第一个满足 maxEndSoFar >= position 的索引
        while (low <= high) {
            val mid = (low + high) ushr 1
            if (maxEndSoFar[mid] >= position) {
                start = mid
                high = mid - 1
            } else {
                low = mid + 1
            }
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

    /**
     * 更新播放状态缓存。
     */
    @PublishedApi
    internal fun updateCache(position: Long, index: Int) {
        lastQueryPosition = position
        lastMatchedIndex = index
    }
}
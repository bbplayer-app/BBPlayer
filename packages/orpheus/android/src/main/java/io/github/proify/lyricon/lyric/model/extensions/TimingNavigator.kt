/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

@file:Suppress("unused")

package io.github.proify.lyricon.lyric.model.extensions

import io.github.proify.lyricon.lyric.model.interfaces.ILyricTiming

/**
 * 时间轴导航器（毫秒级）
 *
 * 用途
 * - 在播放进度（毫秒）中高效定位歌词条目。
 * - 支持单行显示与多行重叠歌词（Overlapping Lyrics）的遍历。
 *
 * 设计要点
 * - 分级定位策略：
 *   - 热路径 (O(1))：利用最近命中的索引与其后继项，优化顺序播放场景。
 *   - 冷路径 (O(log N))：对随机跳转或回退使用二分查找。
 * - 轻重路径分离：
 *   - `first`：仅返回首条匹配（单行场景），无额外回溯开销。
 *   - `forEachAt`：处理重叠歌词，回溯并顺序扫描以保证多行展示准确性。
 *
 * 前提与约束
 * - `source` 必须按 `ILyricTiming.begin` 升序排列。
 * - 本类非线程安全；仅用于单一播放控制线程（单线程语境下使用）。
 *
 * 复杂度
 * - 热路径：常数时间 O(1)
 * - 冷路径（二分查找）：对数时间 O(log N)
 */
class TimingNavigator<T : ILyricTiming>(
    val source: Array<T>
) {
    /** 条目总数（只读） */
    val size: Int = source.size

    /**
     * 最近一次成功匹配的索引。
     * 初始值 -1：表示未命中或越界。
     * 由内部方法维护（对外只读）。
     */
    var lastMatchedIndex: Int = -1
        private set

    /**
     * 最近一次查询的时间戳（毫秒）。
     * 用于判断播放方向（递增时启用顺序优化）。
     */
    var lastQueryPosition: Long = -1L
        private set

    // ----------------------------------------------------------------
    // Public APIs
    // ----------------------------------------------------------------

    /**
     * 返回给定时间点对应的第一条有效歌词（若存在）。
     *
     * 场景：仅需显示单行歌词的 UI（例如普通文本显示）。
     *
     * @param position 播放时间（ms）
     * @return 匹配条目或 null（无匹配或超出范围）
     */
    fun first(position: Long): T? {
        val index = findTargetIndex(position)
        updateCache(position, index)
        return if (index != -1) source[index] else null
    }

    /**
     * 对给定时间点所有生效的歌词执行操作，处理重叠情况。
     *
     * 场景：多行重叠显示、卡拉 OK 逐字渲染等。
     *
     * @param position 播放时间（ms）
     * @param action 对每个匹配条目的回调
     * @return 匹配到的条目数量
     */
    inline fun forEachAt(position: Long, action: (T) -> Unit): Int {
        if (size == 0) return 0

        val anchorIndex = findTargetIndex(position)
        updateCache(position, anchorIndex)

        if (anchorIndex == -1) return 0

        // 回溯并顺序扫描以覆盖所有重叠条目
        return resolveOverlapping(position, anchorIndex, action)
    }

    /**
     * 与 `forEachAt` 类似，但在当前时间窗口没有匹配时回退至最近的历史条目并执行一次回调。
     *
     * 场景：UI 在间歇期保留上一句歌词显示时使用。
     *
     * @param position 播放时间（ms）
     * @param action 对匹配或回退到的条目执行的回调
     * @return 实际调用回调的条目数量（0 或 1）
     */
    inline fun forEachAtOrPrevious(position: Long, action: (T) -> Unit): Int {
        val count = forEachAt(position, action)
        if (count > 0) return count

        val previous = findPreviousEntry(position) ?: return 0
        action(previous)
        return 1
    }

    /**
     * 查找指定时间点之前（严格小于或等于 position）的最后一条条目。
     *
     * 返回值说明：
     * - position < source[0].begin -> null
     * - position > source[last].end -> 返回最后一条
     *
     * @param position 播放时间（ms）
     * @return 找到的条目或 null
     */
    fun findPreviousEntry(position: Long): T? {
        if (size == 0 || position < source[0].begin) return null
        if (position > source[size - 1].end) return source[size - 1]

        var low = 0
        var high = size - 1
        var resultIdx = -1

        // 二分查找最后一个 begin < position 的索引
        while (low <= high) {
            val mid = (low + high) ushr 1
            if (source[mid].begin < position) {
                resultIdx = mid
                low = mid + 1
            } else {
                high = mid - 1
            }
        }
        return if (resultIdx >= 0) source[resultIdx] else null
    }

    /**
     * 重置内部缓存（用于切歌、停止或重新加载场景）。
     */
    fun resetCache() {
        lastMatchedIndex = -1
        lastQueryPosition = -1L
    }

    // ----------------------------------------------------------------
    // Internal Engine
    // ----------------------------------------------------------------

    /**
     * 定位给定时间点的目标索引（若存在）。
     *
     * 优先级：
     * 1. 边界快速失败（整体时间轴之外）
     * 2. 顺序缓存命中（热路径，O(1)）
     * 3. 紧邻下一项线性检查（热路径补充）
     * 4. 二分查找（冷路径，O(log N)）
     *
     * @param position 播放时间（ms）
     * @return 匹配索引或 -1
     */
    fun findTargetIndex(position: Long): Int {
        if (size == 0) return -1

        // 超出整体时间轴范围
        if (position < source[0].begin || position > source[size - 1].end) return -1

        val lastIdx = lastMatchedIndex

        // 顺序播放优化：当请求时间不小于上次查询时间时启用
        if (lastIdx >= 0 && position >= lastQueryPosition) {
            // 检查缓存索引
            if (isHit(lastIdx, position)) return lastIdx

            // 检查紧邻下一项（连续播放最常见）
            val nextIdx = lastIdx + 1
            if (nextIdx < size && isHit(nextIdx, position)) return nextIdx
        }

        // 随机跳转或回退：使用二分查找
        return binarySearch(position)
    }

    /**
     * 标准二分查找：在 [0, size-1] 中查找包含 position 的条目（按 begin 排序）。
     *
     * @return 匹配索引或 -1
     */
    private fun binarySearch(position: Long): Int {
        var low = 0
        var high = size - 1
        while (low <= high) {
            val mid = (low + high) ushr 1
            val entry = source[mid]
            when {
                position < entry.begin -> high = mid - 1
                position > entry.end -> low = mid + 1
                else -> return mid
            }
        }
        return -1
    }

    /**
     * 处理重叠条目：从锚点向前回溯到最早可能的重叠起点，然后顺序扫描直到不再匹配。
     *
     * 由于 source 按 begin 升序，回溯检查 prev.end 是否 >= position 即可判断是否可能重叠。
     *
     * @param position 播放时间（ms）
     * @param anchorIndex 二分查找或缓存命中的锚点索引
     * @param action 对每个匹配条目的回调
     * @return 匹配到的条目数量
     */
    @PublishedApi
    internal inline fun resolveOverlapping(
        position: Long,
        anchorIndex: Int,
        action: (T) -> Unit
    ): Int {
        var start = anchorIndex

        // 向前回溯所有可能包含 position 的条目起点
        while (start > 1) {
            val prev = source[start - 1]
            if (prev.end >= position) start-- else break
        }

        var count = 0
        for (i in start until size) {
            val entry = source[i]
            // 若当前项尚未开始，则后续项均未开始（按 begin 排序），可剪枝退出
            if (position < entry.begin) break

            if (position <= entry.end) {
                action(entry)
                count++
            }
        }
        return count
    }

    /**
     * 命中检测：判断指定索引的条目是否包含 position（闭区间 [begin, end]）。
     */
    private fun isHit(index: Int, position: Long): Boolean {
        val item = source[index]
        return position >= item.begin && position <= item.end
    }

    /**
     * 更新查询缓存（记录最后查询时间与匹配索引）。
     */
    @PublishedApi
    internal fun updateCache(position: Long, index: Int) {
        lastQueryPosition = position
        lastMatchedIndex = index
    }
}
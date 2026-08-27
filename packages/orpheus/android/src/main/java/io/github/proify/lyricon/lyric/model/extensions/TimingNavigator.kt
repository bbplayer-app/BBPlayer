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
 * 时间单位为毫秒 (ms)。[source] 必须在构造前按 [ILyricTiming.begin] 升序排列：
 * 构造时不做排序校验，也不做防御性拷贝（直接持有引用），
 * 因此查询期间请勿修改 [source]，否则行为未定义。
 *
 * 设计说明：
 * - **无重叠快速路径** — 构建时检测行间重叠；普通无重叠歌词（如标准 LRC）的查询
 *   退化为"锚点一次判断"，完全绕开重叠窗口定位。
 * - **maxEndSoFar 单调索引** — 记录每个位置前缀的最大结束时间；当前位置的所有行
 *   均已结束时 O(1) 短路返回空集合，并用于定位重叠窗口起点。
 * - **顺序播放滑动缓存** — 位置单调推进期间，重叠窗口起点只增不减，摊还 O(1) 滑动；
 *   随机跳转/回退则切换为"指数探测（gallop）+ 定向二分"定位起点。
 * - **大跳门控** — 位置前进超过 4 秒直接二分，避免随机跳转/拖动时无谓的步进探测。
 * - **消除冗余判断** — 扫描区间 [start, anchor] 内所有行均满足 `begin <= position`
 *   （依赖升序契约），只需比较 [ILyricTiming.end]。
 *
 * [forEachAtOrPrevious] 复用 [forEachAt] 刚缓存的锚点作为"最近历史行"，
 * 空拍时无需再次二分查找。
 *
 * @property source 必须按 [ILyricTiming.begin] 升序排列的数据源（构造时直接持有，不做拷贝）。
 * @param T 实现 [ILyricTiming] 接口的数据类型。
 */
class TimingNavigator<T : ILyricTiming>(
    val source: Array<T>
) {
    /** 歌词源总数 */
    val size: Int = source.size

    /**
     * 记录 0..i 范围内的最大结束时间。
     * 该数组具有单调递增属性，用于在 [resolveOverlapping] 中定位重叠窗口起点。
     */
    val maxEndSoFar: LongArray = LongArray(size)

    /** 数据源是否存在行间重叠(任一行的 begin 早于前缀最大结束时间) */
    @PublishedApi
    internal val hasOverlap: Boolean

    init {
        var currentMax = -1L
        var overlap = false
        for (i in source.indices) {
            val begin = source[i].begin
            if (begin < currentMax) overlap = true
            val end = source[i].end
            if (end > currentMax) {
                currentMax = end
            }
            maxEndSoFar[i] = currentMax
        }
        hasOverlap = overlap
    }

    /** 缓存最后一次匹配成功的索引，用于顺序播放优化 */
    var lastMatchedIndex: Int = -1
        private set

    /** 记录最后一次查询的时间戳 */
    var lastQueryPosition: Long = -1L
        private set

    /** 顺序播放期间缓存的重叠窗口起点(摊还 O(1) 滑动, 超过 16 步自动切换指数探测) */
    @PublishedApi
    internal var lastStartIndex: Int = -1
        private set

    /** [lastStartIndex] 对应的查询位置(用于判定滑动单调性, 防止回退查询使用过期起点) */
    @PublishedApi
    internal var lastStartQueryPosition: Long = -1L
        private set

    /** 最近一次定位是否经由顺序探测路径(短步长前向); 仅此时才允许滑动窗口起点 */
    @PublishedApi
    internal var sequentialMode: Boolean = false
        private set

    /**
     * 获取指定位置 [position] 处匹配的第一条活动记录。
     *
     * 返回所有覆盖该位置的行中 `begin` 最小的一条（按 `begin` 升序的遍历首项）；
     * 注意该行不一定是最后开始的行（存在重叠时由 [resolveOverlapping] 决定）。
     * 该位置没有活动行时返回 `null`。
     *
     * @param position 查询位置（毫秒）
     * @return 匹配的第一条记录；无匹配时返回 `null`
     */
    fun first(position: Long): T? {
        val index = findTargetIndex(position)
        updateCache(position, index)
        if (index == -1) return null

        if (position <= source[index].end) {
            return source[index]
        }

        // 无重叠数据源: 锚点结束即无活动行, 无需进入重叠解析
        if (!hasOverlap) return null
        if (maxEndSoFar[index] < position) return null

        resolveOverlapping(position, index) { return it }
        return null
    }

    /**
     * 遍历指定位置 [position] 处的所有有效记录（包含重叠部分）。
     *
     * 回调按 `begin` 升序依次执行；无活动行时不调用回调。
     *
     * @param position 查询位置（毫秒）
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
     * 遍历 [position] 处的所有活动记录；若当前点没有任何活动行，
     * 则回调最近的一条历史记录（最后一条 `begin <= position` 的行）并返回 `1`。
     *
     * 空拍/间隙场景下复用 [forEachAt] 刚缓存的锚点，无需再次二分查找。
     *
     * @param position 查询位置（毫秒）
     * @param action 对每个匹配项执行的回调。
     * @return 匹配项总数；历史记录兜底时返回 `1`；无任何记录时返回 `0`
     */
    inline fun forEachAtOrPrevious(position: Long, action: (T) -> Unit): Int {
        val count = forEachAt(position, action)
        if (count > 0) return count

        // 复用 forEachAt 刚缓存的锚点(最后一条 begin <= position), 避免再次二分
        val lm = lastMatchedIndex
        if (size > 0 && lm >= 0) {
            action(source[lm])
            return 1
        }
        return 0
    }

    /**
     * 返回起始时间小于等于 [position] 的最后一条记录（无论该行是否已结束）。
     *
     * 仅按 `begin` 二分定位，不校验 [ILyricTiming.end]，因此可用于"上一行"式导航。
     *
     * @param position 查询位置（毫秒）
     * @return 最后一条 `begin <= position` 的记录；无匹配时返回 `null`
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
        lastStartIndex = -1
        lastStartQueryPosition = -1L
        sequentialMode = false
    }

    /**
     * 定位起始时间小于等于 [position] 的最后一个索引。
     *
     * 包含短步长顺序扫描优化：顺序播放时摊还 O(1)，大幅跳转（超过 4s）自动退回二分。
     *
     * @param position 查询位置（毫秒）
     * @return 目标索引；没有 `begin <= position` 的行时返回 `-1`
     */
    fun findTargetIndex(position: Long): Int {
        if (size == 0 || position < source[0].begin) return -1

        val lastIdx = lastMatchedIndex
        // 顺序播放优化：短步长前向探测
        if (lastIdx >= 0 && position >= lastQueryPosition && position >= source[lastIdx].begin) {
            // 大幅前跳(随机跳转/拖动): 直接二分, 避免无谓的步进探测
            if (position - lastQueryPosition > 4096L) {
                sequentialMode = false
                return findUpperBound(position)
            }

            var currIdx = lastIdx
            var steps = 0
            // 阈值设为 4，超过则切换为二分查找以维持 logN 效率
            while (currIdx + 1 < size && source[currIdx + 1].begin <= position) {
                currIdx++
                steps++
                if (steps > 4) {
                    sequentialMode = false
                    return findUpperBound(position)
                }
            }
            sequentialMode = true
            return currIdx
        }

        sequentialMode = false
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
        if (anchorIndex < 0) return 0

        // 无重叠数据源: 锚点是最多一条候选
        if (!hasOverlap) {
            return if (position <= source[anchorIndex].end) {
                action(source[anchorIndex])
                1
            } else 0
        }

        // O(1) 短路: 当前位置之前的行都已结束(空拍/间隙)
        if (maxEndSoFar[anchorIndex] < position) return 0

        val start = locateStartIndex(position, anchorIndex)

        var count = 0
        // [start, anchor] 区间内所有行均满足 begin <= position(依赖升序契约), 仅需比较 end
        for (i in start..anchorIndex) {
            if (position <= source[i].end) {
                action(source[i])
                count++
            }
        }
        return count
    }

    /**
     * 定位重叠窗口起点: 第一个满足 maxEndSoFar[i] >= position 的索引。
     * 顺序模式走滑动缓存(摊还 O(1)); 冷启动/回退走指数探测 + 定向二分。
     */
    @PublishedApi
    internal fun locateStartIndex(position: Long, anchorIndex: Int): Int {
        val prevStart = lastStartIndex
        // 仅当"顺序探测模式 + 位置单调非减"时才允许滑动起点(摊还 O(1));
        // 随机跳转/回退一律走指数探测, 保证正确性与 log 级成本
        if (sequentialMode && prevStart in 0..anchorIndex && position >= lastStartQueryPosition) {
            // 单调推进: 起点只增不减; 滑动步数设上限(16), 大幅跳跃自动切换指数探测,
            // 避免从缓存起点一路扫到曲尾的退化 O(N)
            var s = prevStart
            var probe = 0
            while (s < anchorIndex && maxEndSoFar[s] < position) {
                s++
                if (++probe > 16) return gallopStart(position, anchorIndex)
            }
            lastStartIndex = s
            lastStartQueryPosition = position
            return s
        }
        return gallopStart(position, anchorIndex)
    }

    /** 指数探测: 1, 2, 4, 8... 向左试探, 常见窗口(K≤10) 1~3 次读数即定位, 仅极端窗口才退化到区间二分 */
    private fun gallopStart(position: Long, anchorIndex: Int): Int {
        var head = anchorIndex
        var step = 1
        while (head - step > 0 && maxEndSoFar[head - step] >= position) {
            head -= step
            step = step shl 1
        }
        val start = lowerBoundStart((head - step).coerceAtLeast(0), head, position)
        lastStartIndex = start
        lastStartQueryPosition = position
        return start
    }

    /** 在 [low, high] 内找第一个满足 maxEndSoFar[i] >= position 的索引(已知 high 满足) */
    private fun lowerBoundStart(low: Int, high: Int, position: Long): Int {
        var lo = low
        var hi = high
        var ans = high
        while (lo <= hi) {
            val mid = (lo + hi) ushr 1
            if (maxEndSoFar[mid] >= position) {
                ans = mid
                hi = mid - 1
            } else {
                lo = mid + 1
            }
        }
        return ans
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

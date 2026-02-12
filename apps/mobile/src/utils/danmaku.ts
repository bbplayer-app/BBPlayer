import type { BilibiliDanmakuItem } from '@/types/apis/bilibili'

/**
 * 清理弹幕数据
 * @param danmakus 原始弹幕数据
 * @param filterWeight 过滤权重阈值
 * @param maxNumPerSecond 每秒最大弹幕数
 * @returns 清理后的弹幕数据
 */
export function cleanDanmaku(
	danmakus: BilibiliDanmakuItem[],
	filterWeight: number,
	maxNumPerSecond?: number,
) {
	const filteredDanmakus = danmakus.filter((d) => {
		const w = d.weight ?? 10
		return w >= filterWeight && d.progress !== undefined && d.progress !== null
	})

	const sortedByWeight = [...filteredDanmakus].toSorted((a, b) => {
		const wa = a.weight ?? 10
		const wb = b.weight ?? 10
		return wb - wa
	})

	if (maxNumPerSecond === undefined) {
		return sortedByWeight.toSorted((a, b) => {
			return a.progress - b.progress
		})
	}

	const countMap = new Map<number, number>()
	const result: BilibiliDanmakuItem[] = []

	for (const dm of sortedByWeight) {
		const second = Math.floor(dm.progress / 1000)
		const currentCount = countMap.get(second) ?? 0

		if (currentCount < maxNumPerSecond) {
			result.push(dm)
			countMap.set(second, currentCount + 1)
		}
	}

	return result.toSorted((a, b) => {
		return a.progress - b.progress
	})
}

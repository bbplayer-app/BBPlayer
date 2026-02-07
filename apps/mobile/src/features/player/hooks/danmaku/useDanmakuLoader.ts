import { useCallback, useEffect, useRef } from 'react'
import {
	useAnimatedReaction,
	useSharedValue,
	type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { BilibiliDanmakuItem } from '@/types/apis/bilibili'
import { cleanDanmaku } from '@/utils/danmaku'
import log from '@/utils/log'

const PRELOAD_DISTANCE_MS = 1000 * 60
const SEGMENT_DURATION_MS = 1000 * 60 * 6

const logger = log.extend('UI.Player.DanmakuLoader')

export default function useDanmakuLoader(
	bvid: string,
	cid: number | undefined,
	currentTime: SharedValue<number>,
) {
	const rawDataSV = useSharedValue<BilibiliDanmakuItem[]>([])
	const loadedSegmentsRef = useRef<Set<number>>(new Set())
	const isLoadingRef = useRef(false)
	const danmakuFilterLevel = useAppStore(
		(state) => state.settings.danmakuFilterLevel,
	)

	const fetchSegment = useCallback(
		async (segIndex: number) => {
			if (isLoadingRef.current) return
			isLoadingRef.current = true
			let cidToUse = cid
			if (!cid) {
				const cidResult = await bilibiliApi.getPageList(bvid)
				if (cidResult.isErr()) {
					logger.error('获取 cid 失败', cidResult.error)
					isLoadingRef.current = false
					return
				}
				cidToUse = cidResult.value[0].cid
				if (!cidToUse) {
					logger.error('获取 cid 失败')
					isLoadingRef.current = false
					return
				}
			}
			const result = await bilibiliApi.getSegDanmaku(bvid, cidToUse!, segIndex)
			result.match(
				(danmakus) => {
					const cleaned = cleanDanmaku(danmakus, danmakuFilterLevel)
					const nextData = [...rawDataSV.value, ...cleaned].sort(
						(a, b) => a.progress - b.progress,
					)
					rawDataSV.value = nextData
					loadedSegmentsRef.current.add(segIndex)
				},
				(e) => {
					logger.error('获取弹幕失败', e)
				},
			)
			isLoadingRef.current = false
		},
		[bvid, cid, rawDataSV, danmakuFilterLevel],
	)

	const checkAndLoad = useCallback(
		(timeMs: number) => {
			const segIndex = Math.max(1, Math.ceil(timeMs / SEGMENT_DURATION_MS))

			// 1. 加载当前段
			if (!loadedSegmentsRef.current.has(segIndex)) {
				void fetchSegment(segIndex)
			}

			// 2. 预加载下一段
			const timeLeft = SEGMENT_DURATION_MS - (timeMs % SEGMENT_DURATION_MS)
			if (timeLeft < PRELOAD_DISTANCE_MS) {
				const nextSeg = segIndex + 1
				if (!loadedSegmentsRef.current.has(nextSeg)) {
					void fetchSegment(nextSeg)
				}
			}
		},
		[fetchSegment],
	)

	useAnimatedReaction(
		() => currentTime.value,
		(current, previous) => {
			if (previous === null) return
			const currentSec = current / 1000
			const previousSec = previous / 1000

			const diff = Math.abs(currentSec - previousSec)
			if (diff > 1.0) {
				scheduleOnRN(checkAndLoad, current)
			} else {
				const currentInt = Math.floor(currentSec)
				if (currentInt % 5 === 0 && Math.floor(previousSec) !== currentInt) {
					scheduleOnRN(checkAndLoad, current)
				}
			}
		},
		[checkAndLoad],
	)

	useEffect(() => {
		rawDataSV.set([])
		loadedSegmentsRef.current.clear()
		isLoadingRef.current = false
	}, [bvid, cid, rawDataSV])

	return {
		rawDataSV,
	}
}

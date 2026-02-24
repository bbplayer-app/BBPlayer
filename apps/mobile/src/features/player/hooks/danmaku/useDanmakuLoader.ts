import { useNetInfo } from '@react-native-community/netinfo'
import { useCallback, useEffect, useRef } from 'react'
import {
	useAnimatedReaction,
	useSharedValue,
	type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { fetchDanmakuSegmentQuery } from '@/hooks/queries/bilibili/danmaku'
import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { BilibiliDanmakuItem } from '@/types/apis/bilibili'
import { cleanDanmaku } from '@/utils/danmaku'
import log from '@/utils/log'

const PRELOAD_DISTANCE_MS = 1000 * 60
const SEGMENT_DURATION_MS = 1000 * 60 * 6
const BASE_RETRY_DELAY = 1000
const MAX_RETRY_DELAY = 1000 * 60 * 5

const logger = log.extend('UI.Player.DanmakuLoader')

export default function useDanmakuLoader(
	bvid: string,
	cid: number | undefined,
	currentTime: SharedValue<number>,
) {
	const networkState = useNetInfo()
	const isOffline = networkState.isConnected === false
	const rawDataSV = useSharedValue<BilibiliDanmakuItem[]>([])
	const loadedSegmentsRef = useRef<Set<number>>(new Set())
	const isLoadingRef = useRef(false)
	const retryCountRef = useRef<Record<number, number>>({})
	const retryTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
		{},
	)
	const danmakuFilterLevel = useAppStore(
		(state) => state.settings.danmakuFilterLevel,
	)

	const fetchSegment = useCallback(
		async (segIndex: number) => {
			if (isLoadingRef.current) return

			if (isOffline) {
				return
			}

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

			try {
				const danmakus = await fetchDanmakuSegmentQuery(
					bvid,
					cidToUse!,
					segIndex,
				)
				const cleaned = cleanDanmaku(danmakus, danmakuFilterLevel)
				const nextData = [...rawDataSV.value, ...cleaned].sort(
					(a, b) => a.progress - b.progress,
				)
				rawDataSV.value = nextData
				loadedSegmentsRef.current.add(segIndex)
				retryCountRef.current[segIndex] = 0
				if (retryTimersRef.current[segIndex]) {
					clearTimeout(retryTimersRef.current[segIndex])
					delete retryTimersRef.current[segIndex]
				}
			} catch (e) {
				logger.error(`获取弹幕失败 segIndex:${segIndex}`, e)
				const retryCount = (retryCountRef.current[segIndex] || 0) + 1
				retryCountRef.current[segIndex] = retryCount
				const delay = Math.min(
					BASE_RETRY_DELAY * Math.pow(2, retryCount - 1),
					MAX_RETRY_DELAY,
				)
				logger.info(`弹幕分段 ${segIndex} 将在 ${delay}ms 后才允许重试`)
				loadedSegmentsRef.current.add(segIndex)
				if (retryTimersRef.current[segIndex]) {
					clearTimeout(retryTimersRef.current[segIndex])
				}
				retryTimersRef.current[segIndex] = setTimeout(() => {
					loadedSegmentsRef.current.delete(segIndex)
					delete retryTimersRef.current[segIndex]
				}, delay)
			} finally {
				isLoadingRef.current = false
			}
		},
		[bvid, cid, rawDataSV, danmakuFilterLevel, isOffline],
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
		retryCountRef.current = {}
		Object.values(retryTimersRef.current).forEach(clearTimeout)
		retryTimersRef.current = {}
	}, [bvid, cid, rawDataSV])

	return {
		rawDataSV,
	}
}

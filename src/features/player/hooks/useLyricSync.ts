import playerProgressEmitter from '@/lib/player/progressListener'
import type { LyricLine } from '@/types/player/lyrics'
import TrackPlayer from '@roitium/react-native-track-player'
import type { FlashListRef } from '@shopify/flash-list'
import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

export default function useLyricSync(
	lyrics: LyricLine[],
	flashListRef: RefObject<FlashListRef<LyricLine> | null>,
	seekTo: (position: number) => Promise<void>,
	offset: number, // 单位秒
) {
	const [currentLyricIndex, setCurrentLyricIndex] = useState(0)
	const isManualScrollingRef = useRef(false)
	const manualScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	)
	const [isActive, setIsActive] = useState(true)
	const latestJumpRequestRef = useRef(0)

	const findIndexForTime = useCallback(
		(timestamp: number) => {
			let lo = 0,
				hi = lyrics.length - 1,
				ans = 0
			while (lo <= hi) {
				const mid = Math.floor((lo + hi) / 2)
				if (lyrics[mid]!.timestamp <= timestamp) {
					ans = mid
					lo = mid + 1
				} else {
					hi = mid - 1
				}
			}
			return Math.max(0, Math.min(ans, lyrics.length - 1))
		},
		[lyrics],
	)

	const onUserScrollStart = () => {
		if (!lyrics.length) return
		if (manualScrollTimeoutRef.current) {
			clearTimeout(manualScrollTimeoutRef.current)
			manualScrollTimeoutRef.current = null
		}
		isManualScrollingRef.current = true
	}

	const onUserScrollEnd = () => {
		if (!lyrics.length) return
		if (manualScrollTimeoutRef.current)
			clearTimeout(manualScrollTimeoutRef.current)

		manualScrollTimeoutRef.current = setTimeout(() => {
			manualScrollTimeoutRef.current = null
			isManualScrollingRef.current = false

			void flashListRef.current?.scrollToIndex({
				animated: true,
				index: currentLyricIndex,
				viewPosition: 0.4,
			})
		}, 2000)
	}

	const handleJumpToLyric = useCallback(
		async (index: number) => {
			if (lyrics.length === 0) return
			if (!lyrics[index]) return
			const requestId = ++latestJumpRequestRef.current
			await seekTo(lyrics[index].timestamp - offset)
			if (latestJumpRequestRef.current !== requestId) return
			setCurrentLyricIndex(index)
			if (manualScrollTimeoutRef.current) {
				clearTimeout(manualScrollTimeoutRef.current)
				manualScrollTimeoutRef.current = null
			}
			isManualScrollingRef.current = false
		},
		[lyrics, seekTo, offset],
	)

	useEffect(() => {
		const appStateSubscription = AppState.addEventListener(
			'change',
			(nextAppState) => {
				if (nextAppState === 'active') {
					setIsActive(true)
				}
			},
		)
		const handler = playerProgressEmitter.subscribe('progress', (data) => {
			const offsetedPosition = data.position + offset
			if (!isActive || offsetedPosition <= 0) {
				return
			}
			const index = findIndexForTime(offsetedPosition)
			if (index === currentLyricIndex) return
			setCurrentLyricIndex(index)
		})
		return () => {
			handler()
			appStateSubscription.remove()
		}
	}, [currentLyricIndex, findIndexForTime, isActive, offset])

	useEffect(() => {
		void TrackPlayer.getProgress().then((data) => {
			const offsetedPosition = data.position + offset
			if (!isActive || offsetedPosition <= 0) {
				return
			}
			const index = findIndexForTime(offsetedPosition)
			if (index === currentLyricIndex) return
			setCurrentLyricIndex(index)
		})
	}, [currentLyricIndex, findIndexForTime, isActive, offset])

	// 当歌词发生变化且用户没自己滚时，滚动到当前歌词
	useEffect(() => {
		if (isManualScrollingRef.current || manualScrollTimeoutRef.current) return
		// eslint-disable-next-line react-you-might-not-need-an-effect/no-pass-live-state-to-parent -- 我们使用命令式的方法来同步 flashlist 组件的滚动位置，这里没有更好的办法
		void flashListRef.current?.scrollToIndex({
			animated: true,
			index: currentLyricIndex,
			viewPosition: 0.4,
		})
	}, [currentLyricIndex, flashListRef, lyrics.length])

	useEffect(() => {
		return () => {
			if (manualScrollTimeoutRef.current) {
				clearTimeout(manualScrollTimeoutRef.current)
			}
		}
	}, [])

	return {
		currentLyricIndex,
		handleJumpToLyric,
		onUserScrollStart,
		onUserScrollEnd,
	}
}

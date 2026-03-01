import { Orpheus } from '@bbplayer/orpheus'
import type { LyricLine } from '@bbplayer/splash'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import playerProgressEmitter from '@/lib/player/progressListener'

export default function useLyricSync(
	lyrics: LyricLine[],
	scrollToIndex: (index: number, animated?: boolean) => void,
	offset: number, // 单位秒
	enabled: boolean,
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
				if (lyrics[mid].startTime / 1000 <= timestamp) {
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

			scrollToIndex(currentLyricIndex, true)
		}, 2000)
	}

	const handleJumpToLyric = useCallback(
		async (index: number) => {
			if (lyrics.length === 0) return
			if (!lyrics[index]) return
			const requestId = ++latestJumpRequestRef.current
			await Orpheus.seekTo(lyrics[index].startTime / 1000 - offset)
			if (latestJumpRequestRef.current !== requestId) return
			setCurrentLyricIndex(index)
			if (manualScrollTimeoutRef.current) {
				clearTimeout(manualScrollTimeoutRef.current)
				manualScrollTimeoutRef.current = null
			}
			isManualScrollingRef.current = false
		},
		[lyrics, offset],
	)

	useEffect(() => {
		const appStateSubscription = AppState.addEventListener(
			'change',
			(nextAppState) => {
				if (nextAppState === 'active') {
					setIsActive(true)
				} else {
					setIsActive(false)
				}
			},
		)
		const handler = playerProgressEmitter.subscribe('progress', (data) => {
			if (!enabled) return

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
	}, [currentLyricIndex, enabled, findIndexForTime, isActive, offset])

	useEffect(() => {
		if (!enabled) return
		void Orpheus.getPosition().then((data) => {
			const offsetedPosition = data + offset
			if (!isActive || offsetedPosition <= 0) {
				return
			}
			const index = findIndexForTime(offsetedPosition)
			if (index === currentLyricIndex) return
			setCurrentLyricIndex(index)
		})
	}, [currentLyricIndex, enabled, findIndexForTime, isActive, offset])

	// 当歌词发生变化且用户没自己滚时，滚动到当前歌词
	useEffect(() => {
		if (!enabled) return
		if (isManualScrollingRef.current || manualScrollTimeoutRef.current) return
		scrollToIndex(currentLyricIndex, true)
	}, [currentLyricIndex, enabled, lyrics.length, scrollToIndex])

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

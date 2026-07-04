import { Orpheus } from '@bbplayer/orpheus'
import type { LyricLine } from '@bbplayer/splash'
import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import playerProgressEmitter from '@/lib/player/progressListener'

export default function useLyricSync(
	lyrics: LyricLine[],
	scrollToIndex: (index: number, animated?: boolean) => void,
	offset: number, // 单位秒
	enabled: boolean,
) {
	const currentLyricIndex = useSharedValue(0)
	const isManualScrollingRef = useRef(false)
	const manualScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	)
	const isActiveRef = useRef(true)
	const latestJumpRequestRef = useRef(0)

	const onUserScrollStart = useCallback(() => {
		if (!lyrics.length) return
		if (manualScrollTimeoutRef.current) {
			clearTimeout(manualScrollTimeoutRef.current)
			manualScrollTimeoutRef.current = null
		}
		isManualScrollingRef.current = true
	}, [lyrics.length])

	const onUserScrollEnd = useCallback(() => {
		if (!lyrics.length) return
		if (manualScrollTimeoutRef.current)
			clearTimeout(manualScrollTimeoutRef.current)

		manualScrollTimeoutRef.current = setTimeout(() => {
			manualScrollTimeoutRef.current = null
			isManualScrollingRef.current = false

			scrollToIndex(currentLyricIndex.get(), true)
		}, 2000)
	}, [lyrics.length, scrollToIndex, currentLyricIndex])

	const handleJumpToLyric = useCallback(
		async (index: number) => {
			if (lyrics.length === 0) return
			if (!lyrics[index]) return
			const requestId = ++latestJumpRequestRef.current
			await Orpheus.seekTo(lyrics[index].startTime / 1000 - offset)
			if (latestJumpRequestRef.current !== requestId) return
			if (manualScrollTimeoutRef.current) {
				clearTimeout(manualScrollTimeoutRef.current)
				manualScrollTimeoutRef.current = null
			}
			isManualScrollingRef.current = false
			currentLyricIndex.set(index)
			if (!enabled) return
			if (isManualScrollingRef.current || manualScrollTimeoutRef.current) return
			scrollToIndex(index, true)
		},
		[lyrics, offset, enabled, scrollToIndex, currentLyricIndex],
	)

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

	// ponytail: animated reaction to scroll on index change without React state
	useAnimatedReaction(
		() => currentLyricIndex.value,
		(index, prevIndex) => {
			if (index === prevIndex) return
			if (!enabled) return
			if (isManualScrollingRef.current || manualScrollTimeoutRef.current) return
			scheduleOnRN(scrollToIndex, index, true)
		},
		[enabled, scrollToIndex],
	)

	useEffect(() => {
		const appStateSub = AppState.addEventListener('change', (nextAppState) => {
			isActiveRef.current = nextAppState === 'active'
		})
		const handler = playerProgressEmitter.subscribe('progress', (data) => {
			if (!enabled) return

			const offsetedPosition = data.position + offset
			if (!isActiveRef.current || offsetedPosition <= 0) return
			const index = findIndexForTime(offsetedPosition)
			currentLyricIndex.set(index)
		})
		return () => {
			handler()
			appStateSub.remove()
		}
	}, [enabled, findIndexForTime, offset, currentLyricIndex])

	useEffect(() => {
		if (!enabled) return
		void Orpheus.getPosition().then((data) => {
			const offsetedPosition = data + offset
			if (!isActiveRef.current || offsetedPosition <= 0) return
			const index = findIndexForTime(offsetedPosition)
			currentLyricIndex.set(index)
		})
	}, [enabled, findIndexForTime, offset, currentLyricIndex])

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

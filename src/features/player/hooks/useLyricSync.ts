import playerProgressEmitter from '@/lib/player/progressListener'
import type { LyricLine } from '@/types/player/lyrics'
import { Orpheus } from '@roitium/expo-orpheus'
import type { FlashListRef } from '@shopify/flash-list'
import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import {
	runOnJS,
	useAnimatedReaction,
	useSharedValue,
} from 'react-native-reanimated'

export default function useLyricSync(
	lyrics: LyricLine[],
	flashListRef: RefObject<FlashListRef<LyricLine> | null>,
	offset: number, // 单位秒
) {
	const currentLyricIndex = useSharedValue(0)
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
				if (lyrics[mid].timestamp <= timestamp) {
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

	const onUserScrollStart = useCallback(() => {
		'worklet'
		if (!lyrics.length) return
		if (manualScrollTimeoutRef.current) {
			clearTimeout(manualScrollTimeoutRef.current)
			manualScrollTimeoutRef.current = null
		}
		isManualScrollingRef.current = true
	}, [lyrics.length])

	const onUserScrollEnd = useCallback(() => {
		'worklet'
		if (!lyrics.length) return
		if (manualScrollTimeoutRef.current)
			clearTimeout(manualScrollTimeoutRef.current)

		manualScrollTimeoutRef.current = setTimeout(() => {
			manualScrollTimeoutRef.current = null
			isManualScrollingRef.current = false

			void flashListRef.current?.scrollToIndex({
				animated: true,
				index: currentLyricIndex.value,
				viewPosition: 0.15,
			})
		}, 2000)
	}, [currentLyricIndex, flashListRef, lyrics.length])

	const handleJumpToLyric = useCallback(
		async (index: number) => {
			if (lyrics.length === 0) return
			if (!lyrics[index]) return
			const requestId = ++latestJumpRequestRef.current
			await Orpheus.seekTo(lyrics[index].timestamp - offset)
			if (latestJumpRequestRef.current !== requestId) return
			currentLyricIndex.set(index)
			if (manualScrollTimeoutRef.current) {
				clearTimeout(manualScrollTimeoutRef.current)
				manualScrollTimeoutRef.current = null
			}
			isManualScrollingRef.current = false
		},
		[currentLyricIndex, lyrics, offset],
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
			if (index === currentLyricIndex.value) return
			currentLyricIndex.value = index
		})
		return () => {
			handler()
			appStateSubscription.remove()
		}
	}, [currentLyricIndex, findIndexForTime, isActive, offset])

	useEffect(() => {
		void Orpheus.getPosition().then((data) => {
			const offsetedPosition = data + offset
			if (!isActive || offsetedPosition <= 0) {
				return
			}
			const index = findIndexForTime(offsetedPosition)
			if (index === currentLyricIndex.value) return
			currentLyricIndex.set(index)
		})
	}, [currentLyricIndex, findIndexForTime, isActive, offset])

	const performScroll = useCallback(
		(index: number) => {
			if (isManualScrollingRef.current || manualScrollTimeoutRef.current) return
			void flashListRef.current?.scrollToIndex({
				animated: true,
				index: index,
				viewPosition: 0.15,
			})
		},
		[flashListRef],
	)

	useAnimatedReaction(
		() => currentLyricIndex.value,
		(currentIndex, previousIndex) => {
			if (currentIndex === previousIndex) return
			void runOnJS(performScroll)(currentIndex)
		},
		[lyrics.length, performScroll],
	)

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

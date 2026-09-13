import { seekDlnaCast } from '@bbplayer/dlna'
import { Orpheus } from '@bbplayer/orpheus'
import type { LyricLine } from '@bbplayer/splash'
import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useDlnaCastStore } from '@/hooks/stores/useDlnaCastStore'
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
			const target = lyrics[index].startTime / 1000 - offset
			if (useDlnaCastStore.getState().castingDevice) {
				useDlnaCastStore.getState().setPlayback({ position: target })
				await seekDlnaCast(target)
			} else {
				await Orpheus.seekTo(target)
			}
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
		() => {
			'worklet'
			return currentLyricIndex.value
		},
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
		const applyPosition = (raw: number) => {
			if (!enabled) return
			const offsetedPosition = raw + offset
			if (!isActiveRef.current || offsetedPosition <= 0) return
			currentLyricIndex.set(findIndexForTime(offsetedPosition))
		}

		const handler = playerProgressEmitter.subscribe('progress', (data) => {
			if (useDlnaCastStore.getState().castingDevice) return
			applyPosition(data.position)
		})
		const dlnaUnsub = useDlnaCastStore.subscribe((s) => {
			if (!s.castingDevice) return
			applyPosition(s.position)
		})
		return () => {
			handler()
			dlnaUnsub()
			appStateSub.remove()
		}
	}, [enabled, findIndexForTime, offset, currentLyricIndex])

	useEffect(() => {
		if (!enabled) return
		const raw = useDlnaCastStore.getState().castingDevice
			? useDlnaCastStore.getState().position
			: undefined
		const apply = (data: number) => {
			const offsetedPosition = data + offset
			if (!isActiveRef.current || offsetedPosition <= 0) return
			currentLyricIndex.set(findIndexForTime(offsetedPosition))
		}
		if (raw !== undefined) {
			apply(raw)
			return
		}
		void Orpheus.getPosition().then(apply)
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

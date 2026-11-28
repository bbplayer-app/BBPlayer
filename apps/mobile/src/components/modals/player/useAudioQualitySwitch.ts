import { Orpheus } from '@bbplayer/orpheus'
import type {
	AudioQualityInfo,
	AudioQualityPreference,
} from '@bbplayer/orpheus'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
	formatActualAudioQuality,
	formatAudioQualityLabel,
	resolveAudioQualityEventOutcome,
	shouldSkipAudioQualitySwitch,
} from '@/constants/audioQuality'
import { setPreferredAudioQuality } from '@/hooks/player/usePreferredAudioQuality'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

import { QUALITY_MESSAGES, showQualityMessage } from './audioQualityMessages'
import {
	createPendingSwitchTimer,
	type PendingSwitchTimer,
} from './audioQualityModalState'

export const QUALITY_CONFIRM_TIMEOUT_MS = 3_000

const SWITCH_IN_PROGRESS_MESSAGE = {
	message: '正在切换，请稍等',
	description: '这次切换完成后再选别的档位',
}

export interface UseAudioQualitySwitchOptions {
	preference: AudioQualityPreference
	actualQuality: AudioQualityInfo | null
}

export interface UseAudioQualitySwitchResult {
	pendingTarget: AudioQualityPreference | null
	qualityUnconfirmed: boolean
	handleQualityEvent: (info: AudioQualityInfo) => void
	applyReadQuality: (info: AudioQualityInfo | null) => void
	markUnconfirmed: () => void
	switchQuality: (next: AudioQualityPreference) => Promise<void>
}

export function useAudioQualitySwitch({
	preference,
	actualQuality,
}: UseAudioQualitySwitchOptions): UseAudioQualitySwitchResult {
	const [pendingTarget, setPendingTarget] =
		useState<AudioQualityPreference | null>(null)

	const [qualityUnconfirmed, setQualityUnconfirmed] = useState(false)

	const switchingRef = useRef(false)
	const mountedRef = useRef(true)
	const switchTimerRef = useRef<PendingSwitchTimer | null>(null)

	const pendingRef = useRef<AudioQualityPreference | null>(null)

	const clearPendingSwitch = useCallback(() => {
		switchTimerRef.current?.settle()
		pendingRef.current = null
		switchingRef.current = false

		if (!mountedRef.current) {
			return
		}

		setPendingTarget(null)
	}, [])

	const handleSwitchTimeout = useCallback(() => {
		clearPendingSwitch()

		if (!mountedRef.current) {
			return
		}

		setQualityUnconfirmed(true)
		showQualityMessage(QUALITY_MESSAGES.unconfirmed)
	}, [clearPendingSwitch])

	const enterPendingSwitch = useCallback((target: AudioQualityPreference) => {
		pendingRef.current = target
		switchingRef.current = true
		setPendingTarget(target)
		switchTimerRef.current?.start()
	}, [])

	useEffect(() => {
		mountedRef.current = true

		const switchTimer = createPendingSwitchTimer(
			QUALITY_CONFIRM_TIMEOUT_MS,
			handleSwitchTimeout,
		)

		switchTimerRef.current = switchTimer

		return () => {
			mountedRef.current = false
			switchTimer.dispose()
			switchTimerRef.current = null
			pendingRef.current = null
		}
	}, [handleSwitchTimeout])

	const applyReadQuality = useCallback((info: AudioQualityInfo | null) => {
		setQualityUnconfirmed(info !== null && info.actualKind === 'unknown')
	}, [])

	const markUnconfirmed = useCallback(() => setQualityUnconfirmed(true), [])

	const handleQualityEvent = useCallback(
		(info: AudioQualityInfo) => {
			setQualityUnconfirmed(info.actualKind === 'unknown')

			const pending = pendingRef.current

			if (pending === null || info.preferredQuality !== pending) {
				return
			}

			const outcome = resolveAudioQualityEventOutcome(info, pending)

			if (outcome === 'awaiting') {
				return
			}

			clearPendingSwitch()

			const targetLabel = formatAudioQualityLabel(pending)

			if (outcome === 'applied') {
				toast.success(QUALITY_MESSAGES.switched(targetLabel).message)

				return
			}

			showQualityMessage(
				QUALITY_MESSAGES.fallback(
					targetLabel,
					formatActualAudioQuality(info)?.title ?? null,
				),
			)
		},
		[clearPendingSwitch],
	)

	const switchQuality = async (next: AudioQualityPreference) => {
		if (switchingRef.current) {
			showQualityMessage(SWITCH_IN_PROGRESS_MESSAGE)

			return
		}

		const label = formatAudioQualityLabel(next)

		if (shouldSkipAudioQualitySwitch({ preference, next, actualQuality })) {
			showQualityMessage(QUALITY_MESSAGES.alreadyCurrent(label))

			return
		}

		switchingRef.current = true
		enterPendingSwitch(next)

		try {
			setPreferredAudioQuality(next)
		} catch (error) {
			clearPendingSwitch()
			toastAndLogError(
				QUALITY_MESSAGES.preferenceWriteFailed.message,
				error,
				'Modal.AudioQuality',
			)

			return
		}

		try {
			const result = await Orpheus.reloadCurrentTrackForQualityChange()

			if (result.reloaded) {
				return
			}

			clearPendingSwitch()

			if (result.reason === 'downloaded') {
				showQualityMessage(QUALITY_MESSAGES.setDefaultOffline(label))
			} else if (result.reason === 'not_bilibili') {
				showQualityMessage(QUALITY_MESSAGES.setDefault(label))
			} else if (result.reason === 'no_track') {
				showQualityMessage(QUALITY_MESSAGES.setDefaultNoTrack(label))
			} else if (result.reason === 'spectrum') {
				showQualityMessage(QUALITY_MESSAGES.setDefaultSpectrum(label))
			} else {
				toast.error(QUALITY_MESSAGES.switchFailed.message, {
					description: QUALITY_MESSAGES.switchFailed.description,
				})
			}
		} catch (error) {
			clearPendingSwitch()
			toastAndLogError(
				QUALITY_MESSAGES.switchFailed.message,
				error,
				'Modal.AudioQuality',
			)
		}
	}

	return {
		pendingTarget,
		qualityUnconfirmed,
		handleQualityEvent,
		applyReadQuality,
		markUnconfirmed,
		switchQuality,
	}
}

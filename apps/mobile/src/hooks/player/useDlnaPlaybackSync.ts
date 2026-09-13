import { getDlnaStatus } from '@bbplayer/dlna'
import { Orpheus } from '@bbplayer/orpheus'
import { useEffect, useRef } from 'react'

import {
	isDlnaDisconnecting,
	isDlnaRecasting,
	recastCurrentTrack,
	skipWithDlna,
} from '@/features/player/dlna/castCurrentTrack'
import { useDlnaCastStore } from '@/hooks/stores/useDlnaCastStore'
import log from '@/utils/log'

const logger = log.extend('Player.DlnaSync')

export default function useDlnaPlaybackSync() {
	const casting = useDlnaCastStore((s) => !!s.castingDevice)
	const sawPlayingRef = useRef(false)
	const lastPositionRef = useRef(0)
	const advancingRef = useRef(false)

	useEffect(() => {
		if (!casting) {
			sawPlayingRef.current = false
			lastPositionRef.current = 0
			advancingRef.current = false
			return
		}

		let cancelled = false

		const trackSub = Orpheus.addListener('onTrackStarted', () => {
			void recastCurrentTrack().catch((e) => {
				logger.warning('投屏切歌失败', { error: e })
			})
		})

		const tick = async () => {
			try {
				if (isDlnaRecasting() || isDlnaDisconnecting()) return
				const status = await getDlnaStatus()
				if (cancelled || isDlnaDisconnecting() || !status) return

				const playing = status.state === 'PLAYING'
				if (playing) sawPlayingRef.current = true

				useDlnaCastStore.getState().setPlayback({
					playing,
					position: status.position,
					duration: status.duration,
					transportState: status.state,
				})

				const atEnd =
					status.duration > 1 &&
					(status.position >= status.duration - 1.5 ||
						lastPositionRef.current >= status.duration - 1.5)
				const stopped =
					status.state === 'STOPPED' || status.state === 'NO_MEDIA_PRESENT'
				const ended =
					sawPlayingRef.current &&
					!isDlnaRecasting() &&
					(atEnd ||
						(stopped && lastPositionRef.current > 8 && status.position < 2)) &&
					(stopped || status.state === 'PAUSED_PLAYBACK' || (playing && atEnd))

				lastPositionRef.current = status.position

				if (cancelled || isDlnaDisconnecting()) return

				if (ended && !advancingRef.current) {
					advancingRef.current = true
					sawPlayingRef.current = false
					try {
						await skipWithDlna('next')
					} catch (e) {
						logger.warning('投屏自动切歌失败', { error: e })
					} finally {
						advancingRef.current = false
					}
				}
			} catch (e) {
				if (!cancelled) {
					logger.debug('读取音箱状态失败', { error: e })
				}
			}
		}

		void tick()
		const id = setInterval(() => void tick(), 1000)
		return () => {
			cancelled = true
			clearInterval(id)
			trackSub.remove()
		}
	}, [casting])
}

export function DlnaPlaybackSync() {
	useDlnaPlaybackSync()
	return null
}

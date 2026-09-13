import {
	castToDlna,
	pauseDlnaCast,
	resumeDlnaCast,
	stopDlnaCast,
	type DlnaDevice,
} from '@bbplayer/dlna'
import { Orpheus } from '@bbplayer/orpheus'

import {
	resolveCastSource,
	type ResolvedCastSource,
} from '@/features/player/dlna/resolveCastSource'
import { useDlnaCastStore } from '@/hooks/stores/useDlnaCastStore'
import { trackService } from '@/lib/services/trackService'
import log from '@/utils/log'

const logger = log.extend('Player.Dlna')

let recasting = false
let recastQueued = false
let disconnecting = false

export function isDlnaRecasting() {
	return recasting
}

export function isDlnaDisconnecting() {
	return disconnecting
}

export async function disconnectDlnaCast() {
	const { castingDevice, position, playing } = useDlnaCastStore.getState()
	if (!castingDevice || disconnecting) return

	disconnecting = true
	try {
		await stopDlnaCast()
		useDlnaCastStore.getState().setCasting(null)
	} catch (e) {
		logger.warning('停止音箱失败', { error: e })
		throw e
	} finally {
		disconnecting = false
	}

	try {
		if (position > 0.5) await Orpheus.seekTo(position)
		if (playing) await Orpheus.play()
	} catch (e) {
		logger.warning('恢复本地播放失败', { error: e })
	}
}

export async function playSourceOnDevice(
	device: DlnaDevice,
	source: ResolvedCastSource,
	resumeLocalOnFail: boolean,
) {
	await Orpheus.pause()
	try {
		await castToDlna({
			controlURL: device.controlURL,
			renderingControlURL: device.renderingControlURL ?? undefined,
			title: source.title,
			mime: source.mime,
			sourceUrl: source.sourceUrl,
			filePath: source.filePath,
			headers: source.headers,
		})
		useDlnaCastStore.getState().setCasting(device, source.title)
	} catch (e) {
		if (resumeLocalOnFail) {
			try {
				await Orpheus.play()
			} catch (playError) {
				logger.warning('投屏失败后恢复本地播放失败', { error: playError })
			}
		}
		throw e
	}
}

export async function recastCurrentTrack() {
	if (!useDlnaCastStore.getState().castingDevice || disconnecting) return
	if (recasting) {
		recastQueued = true
		return
	}

	recasting = true
	try {
		do {
			recastQueued = false
			const device = useDlnaCastStore.getState().castingDevice
			if (!device || disconnecting) return
			const uniqueKey = (await Orpheus.getCurrentTrack())?.id
			if (!uniqueKey) throw new Error('当前没有在播的歌曲')
			const result = await trackService.getTrackByUniqueKey(uniqueKey)
			if (result.isErr()) throw result.error
			const source = await resolveCastSource(result.value)
			await playSourceOnDevice(device, source, false)
			logger.info('已切到音箱', { title: source.title })
		} while (recastQueued && useDlnaCastStore.getState().castingDevice)
	} finally {
		recasting = false
	}
}

export async function skipWithDlna(action: 'next' | 'prev' | number) {
	if (typeof action === 'number') {
		await Orpheus.skipTo(action)
		return
	}
	if (action === 'next') {
		await Orpheus.skipToNext()
		return
	}
	await Orpheus.skipToPrevious()
}

export async function toggleDlnaOrLocal(isPlaying: boolean) {
	if (useDlnaCastStore.getState().castingDevice) {
		if (isPlaying) {
			await pauseDlnaCast()
			useDlnaCastStore.getState().setPlayback({
				playing: false,
				transportState: 'PAUSED_PLAYBACK',
			})
		} else {
			await resumeDlnaCast()
			useDlnaCastStore
				.getState()
				.setPlayback({ playing: true, transportState: 'PLAYING' })
		}
		return
	}
	if (isPlaying) {
		await Orpheus.pause()
	} else {
		await Orpheus.play()
	}
}

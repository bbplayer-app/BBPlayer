import { type Track as OrpheusTrack } from '@bbplayer/orpheus'
import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'

import { trackKeys } from '@/hooks/queries/db/track'
import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { queryClient } from '@/lib/config/queryClient'
import type { PlayerError } from '@/lib/errors/player'
import { createPlayerError } from '@/lib/errors/player'
import type { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import { enqueueTracks, startPlayback } from '@/lib/player/playbackSession'
import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'

import { toastAndLogError } from './error-handling'
import log, { flatErrorMessage } from './log'

const logger = log.extend('Utils.Player')

/**
 * 将内部 Track 类型转换为 Orpheus 的 Track 类型。
 * @param track - 内部 Track 对象。
 * @returns 一个 Result 对象，成功时包含 OrpheusTrack，失败时包含 Error。
 */
function convertToOrpheusTrack(
	track: Track,
): Result<OrpheusTrack, BilibiliApiError | PlayerError> {
	// logger.debug('转换 Track 为 OrpheusTrack', {
	// 	trackId: track.id,
	// 	title: track.title,
	// 	artist: track.artist,
	// })

	const url = getInternalPlayUri(track)

	// 如果没有有效的 URL，返回错误
	if (!url) {
		const errorMsg = '没有找到有效的音频流 URL'
		logger.warning('player.track.url_missing', {
			'track.id': track.id,
			'track.source': track.source,
		})

		return err(
			createPlayerError('AudioUrlNotFound', `${errorMsg}: ${track.id}`),
		)
	}

	const orpheusTrack: OrpheusTrack = {
		id: track.uniqueKey,
		url,
		title: track.title,
		artist: track.artist?.name,
		artwork: track.coverUrl ?? undefined,
		duration: track.duration,
	}

	// logger.debug('OrpheusTrack 转换完成', {
	// 	title: orpheusTrack.title,
	// 	id: orpheusTrack.id,
	// })
	return ok(orpheusTrack)
}

/**
 * 上报播放记录
 * 由于这只是一个非常边缘的功能，我们不关心它是否出错，所以失败时只写 log，不打扰用户
 */
async function reportPlaybackHistory(
	uniqueKey: string,
	position: number,
): Promise<void> {
	if (!useAppStore.getState().settings.sendPlayHistory) return

	if (!useAppStore.getState().hasBilibiliCookie()) return
	const trackResult = await trackService.getTrackByUniqueKey(uniqueKey)

	if (trackResult.isErr()) {
		logger.debug('playback.history.track_lookup_failed', {
			'track.unique_key': uniqueKey,
			'error.message': flatErrorMessage(trackResult.error),
		})

		return
	}

	const track = trackResult.value

	if (track.source !== 'bilibili') {
		return
	}

	let cid = track.bilibiliMetadata.cid

	if (!cid && !track.bilibiliMetadata.isMultiPage) {
		const videoPageResult = await bilibiliApi.getPageList({
			bvid: track.bilibiliMetadata.bvid,
		})

		if (videoPageResult.isErr()) {
			logger.debug('playback.history.video_lookup_failed', {
				'track.unique_key': uniqueKey,
				'bilibili.bvid': track.bilibiliMetadata.bvid,
				'error.message': flatErrorMessage(videoPageResult.error),
			})

			return
		}

		if (videoPageResult.value.length === 0) {
			logger.warning('playback.history.pages_missing', {
				'bilibili.bvid': track.bilibiliMetadata.bvid,
			})

			return
		}

		cid = videoPageResult.value[0].cid
	} else if (track.bilibiliMetadata.isMultiPage && !cid) {
		logger.warning('playback.history.cid_missing', {
			'bilibili.bvid': track.bilibiliMetadata.bvid,
		})

		return
	}

	logger.debug('playback.history.report_started', {
		'bilibili.bvid': track.bilibiliMetadata.bvid,
		'bilibili.cid': cid,
		'playback.position_seconds': position,
	})

	const result = await bilibiliApi.reportPlaybackHistory({
		bvid: track.bilibiliMetadata.bvid,
		cid: cid!,
		progress: position,
	})

	if (result.isErr()) {
		logger.warning(
			'playback.history.report_failed',
			{ 'bilibili.bvid': track.bilibiliMetadata.bvid, 'bilibili.cid': cid },
			result.error,
		)
	}

	return
}

/**
 *
 * @param playNow 是否立即播放
 * @param clearQueue 是否清空队列
 * @param startFromKey 从指定的 key 开始播放（并立即开始播放，无视 playNow）
 * @param playNext 是否插入到下一首播放
 * @returns
 */
async function addToQueue({
	tracks,
	playNow,
	clearQueue,
	startFromKey,
	playNext,
	playlistId,
}: {
	tracks: Track[]
	playNow: boolean
	clearQueue: boolean
	startFromKey?: string
	playNext: boolean
	playlistId?: number
}): Promise<boolean> {
	try {
		const orpheusTracks: OrpheusTrack[] = []

		for (const track of tracks) {
			const result = convertToOrpheusTrack(track)

			if (result.isOk()) orpheusTracks.push(result.value)
		}

		const submit = clearQueue ? startPlayback : enqueueTracks
		await submit({
			tracks: orpheusTracks,
			playNow,
			startFromKey,
			playNext,
			playlistId,
		})

		return true
	} catch (error) {
		toastAndLogError('添加到播放队列失败', error, 'Utils.Player')

		return false
	}
}

function getInternalPlayUri(track: Track) {
	if (track.source === 'bilibili') {
		return track.bilibiliMetadata.isMultiPage
			? `orpheus://bilibili?bvid=${track.bilibiliMetadata.bvid}&cid=${track.bilibiliMetadata.cid}&hires=0&dolby=0`
			: `orpheus://bilibili?bvid=${track.bilibiliMetadata.bvid}&hires=0&dolby=0`
	}

	if (track.source === 'local' && track.localMetadata) {
		return track.localMetadata.localPath
	}

	return undefined
}

async function finalizeAndRecordCurrentTrack(
	uniqueKey: string,
	realDuration: number,
	position: number,
) {
	try {
		const playedSeconds = Math.max(0, Math.floor(position))
		const duration = Math.max(1, Math.floor(realDuration))
		const effectivePlayed = Math.min(playedSeconds, duration)
		const threshold = Math.max(Math.floor(duration * 0.9), duration - 2)
		const completed = effectivePlayed >= threshold
		logger.info('playback.session.finalized', {
			'playback.played_seconds': playedSeconds,
			'playback.duration_seconds': duration,
			'playback.effective_played_seconds': effectivePlayed,
			'playback.threshold_seconds': threshold,
			'playback.completed': completed,
			'track.unique_key': uniqueKey,
		})

		const res = await trackService.addPlayRecordFromUniqueKey(uniqueKey, {
			startTime: Date.now() - playedSeconds * 1000,
			durationPlayed: effectivePlayed,
			completed,
		})

		if (res.isErr()) {
			logger.debug('playback.history.insert_failed', {
				'track.unique_key': uniqueKey,
				'error.message': flatErrorMessage(res.error),
			})

			return
		}

		logger.debug('playback.history.inserted', { 'track.unique_key': uniqueKey })

		void queryClient.invalidateQueries({
			queryKey: trackKeys.history(),
		})

		await reportPlaybackHistory(uniqueKey, effectivePlayed).catch((error) =>
			logger.error('playback.history.failed', {}, error),
		)
	} catch (error) {
		logger.debug('playback.history.insert_exception', {}, error)
	}
}

export {
	addToQueue,
	convertToOrpheusTrack,
	finalizeAndRecordCurrentTrack,
	getInternalPlayUri,
	reportPlaybackHistory,
}

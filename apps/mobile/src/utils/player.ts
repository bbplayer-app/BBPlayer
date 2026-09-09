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
		logger.warning(errorMsg, track)
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
 * 由于这只是一个非常边缘的功能，我们不关心他是否出错，所以发生报错时只写个 log，返回 void
 */
async function reportPlaybackHistory(
	uniqueKey: string,
	position: number,
): Promise<void> {
	if (!useAppStore.getState().settings.sendPlayHistory) return
	if (!useAppStore.getState().hasBilibiliCookie()) return
	const trackResult = await trackService.getTrackByUniqueKey(uniqueKey)
	if (trackResult.isErr()) {
		toastAndLogError('查询 track 失败：', trackResult.error, 'Utils.Player')
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
			toastAndLogError(
				'查询视频信息失败：',
				videoPageResult.error,
				'Utils.Player',
			)
			return
		}
		if (videoPageResult.value.length === 0) {
			logger.warning('视频无分 p 信息，无法上报播放记录', {
				bvid: track.bilibiliMetadata.bvid,
			})
			return
		}
		cid = videoPageResult.value[0].cid
	} else if (track.bilibiliMetadata.isMultiPage && !cid) {
		logger.warning('多 p 视频无法上报播放记录，不存在 cid', {
			bvid: track.bilibiliMetadata.bvid,
		})
		return
	}
	logger.debug('上报播放记录', {
		bvid: track.bilibiliMetadata.bvid,
		cid,
		position,
	})
	const result = await bilibiliApi.reportPlaybackHistory({
		bvid: track.bilibiliMetadata.bvid,
		cid: cid!,
		progress: position,
	})
	if (result.isErr()) {
		logger.warning('上报播放记录到 bilibili 失败', {
			params: {
				bvid: track.bilibiliMetadata.bvid,
				cid,
			},
			error: result.error,
		})
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
		logger.info('完成播放', { uniqueKey })
		logger.debug('完成播放标记', {
			playedSeconds,
			duration,
			effectivePlayed,
			threshold,
			completed,
			uniqueKey,
		})

		const res = await trackService.addPlayRecordFromUniqueKey(uniqueKey, {
			startTime: Date.now() - playedSeconds * 1000,
			durationPlayed: effectivePlayed,
			completed,
		})

		if (res.isErr()) {
			logger.debug('增加播放记录失败', {
				uniqueKey,
				message: flatErrorMessage(res.error),
			})
			return
		}
		logger.debug('增加播放记录成功', {
			uniqueKey,
		})

		void queryClient.invalidateQueries({
			queryKey: trackKeys.history(),
		})

		await reportPlaybackHistory(uniqueKey, effectivePlayed).catch((error) =>
			logger.error('上报播放历史失败', error),
		)
	} catch (error) {
		logger.debug('增加播放记录异常', error)
	}
}

export {
	addToQueue,
	convertToOrpheusTrack,
	finalizeAndRecordCurrentTrack,
	getInternalPlayUri,
	reportPlaybackHistory,
}

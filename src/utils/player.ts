import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { PlayerError } from '@/lib/errors/player'
import { createPlayerError } from '@/lib/errors/player'
import { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import { trackService } from '@/lib/services/trackService'
import type { BilibiliTrack, Track } from '@/types/core/media'
import { Orpheus, type Track as OrpheusTrack } from '@roitium/expo-orpheus'
import { File, Paths } from 'expo-file-system'
import { produce } from 'immer'
import { err, ok, ResultAsync, type Result } from 'neverthrow'
import { toastAndLogError } from './error-handling'
import log from './log'
import toast from './toast'

const logger = log.extend('Utils.Player')

// 音频流过期时间 120 分钟
const STREAM_EXPIRY_TIME = 120 * 60 * 1000

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

	let url = ''
	const volume = {
		measured_i: 0,
		target_i: 0,
	}
	if (track.source === 'bilibili') {
		url = track.bilibiliMetadata.cid
			? `orpheus://bilibili?bvid=${track.bilibiliMetadata.bvid}&cid=${track.bilibiliMetadata.cid}`
			: `orpheus://bilibili?bvid=${track.bilibiliMetadata.bvid}`
		// logger.debug('使用 B 站音频流 URL', {
		// 	url,
		// })
		// volume = {
		// 	measured_i:
		// 		track.bilibiliMetadata.bilibiliStreamUrl.volume?.measured_i ?? 0,
		// 	target_i: track.bilibiliMetadata.bilibiliStreamUrl.volume?.target_i ?? 0,
		// }
	} else if (track.source === 'local' && track.localMetadata) {
		url = track.localMetadata.localPath
		logger.debug('使用本地音频流 URL', { url })
	}

	// 如果没有有效的 URL，返回错误
	if (!url) {
		const errorMsg = '没有找到有效的音频流 URL'
		logger.warning(`${errorMsg}`, track)
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
		loudness: volume,
	}

	// logger.debug('OrpheusTrack 转换完成', {
	// 	title: orpheusTrack.title,
	// 	id: orpheusTrack.id,
	// })
	return ok(orpheusTrack)
}

/**
 * 检查 Bilibili 音频流是否过期。
 * @param track - 内部 Track 对象。
 * @returns 如果音频流不存在或已过期，则返回 true，否则返回 false。
 */
function checkBilibiliAudioExpiry(_track: Track): boolean {
	const now = Date.now()
	const track = _track as BilibiliTrack
	const isExpired =
		!track.bilibiliMetadata.bilibiliStreamUrl ||
		now - track.bilibiliMetadata.bilibiliStreamUrl.getTime > STREAM_EXPIRY_TIME
	logger.debug('检查 B 站音频流过期状态', {
		trackId: track.id,
		hasStream: !!track.bilibiliMetadata.bilibiliStreamUrl,
		// streamAge: track.bilibiliStreamUrl ? now - track.bilibiliStreamUrl.getTime : 'N/A',
		isExpired,
		// expiryTime: STREAM_EXPIRY_TIME,
	})
	return isExpired
}

interface LocalCheckResult {
	track: Track
	handledLocally: boolean
	needsUpdate: boolean
}

/**
 * - 如果 source === 'local'：直接 handledLocally = true
 * - 如果 source === 'bilibili' 且 trackDownloads.status === 'downloaded'：
 *    - 本地文件存在且与当前 streamUrl 匹配 -> handledLocally = true, needsUpdate = false
 *    - 本地文件存在但与当前 streamUrl 不同 -> 返回一个 updatedTrack（指向本地），handledLocally = true, needsUpdate = true
 *    - 本地文件不存在但 DB 标记为 downloaded -> 修正 DB 为 failed、清除 streamUrl，handledLocally = false, needsUpdate = true
 * - 其它情况：handledLocally = false, needsUpdate = false（继续远程检查/获取）
 */
async function tryUseLocalStream(
	track: Track,
): Promise<Result<LocalCheckResult, BilibiliApiError | PlayerError>> {
	logger.debug('尝试检查本地播放可用性', {
		trackId: track.id,
		source: track.source,
	})

	// 1) 真正的本地 source，直接返回（无需后续远程处理）
	if (track.source === 'local') {
		logger.debug('本地音频，无需更新流', { trackId: track.id })
		return ok({ track, handledLocally: true, needsUpdate: false })
	}

	// 2) 仅处理 bilibili 源的“已下载”情况；其它来源不在本函数内处理
	if (track.source !== 'bilibili') {
		logger.debug('非 B 站音源，跳过本地检查', {
			trackId: (track as Track).id,
			source: (track as Track).source,
		})
		return ok({ track, handledLocally: false, needsUpdate: false })
	}

	// source === 'bilibili'
	if (track.trackDownloads && track.trackDownloads.status === 'downloaded') {
		const file = new File(Paths.document, 'downloads', `${track.uniqueKey}.m4s`)

		// 本地文件存在 -> 优先使用本地
		if (file.exists) {
			logger.debug('已下载的音频，本地文件存在，尝试使用本地文件', {
				trackId: track.id,
				path: file.uri,
			})

			// 如果已经指向相同本地 uri，则无需修改
			if (track.bilibiliMetadata.bilibiliStreamUrl?.url === file.uri) {
				return ok({ track, handledLocally: true, needsUpdate: false })
			}

			// 否则把 track 更新为使用本地流（quality / getTime 保持原行为）
			const updatedTrack: Track = {
				...track,
				bilibiliMetadata: {
					...track.bilibiliMetadata,
					bilibiliStreamUrl: {
						url: file.uri,
						quality: 114514,
						getTime: Number.POSITIVE_INFINITY,
						type: 'local' as const,
					},
				},
			}

			logger.debug('将 track 的流切换为本地文件', {
				trackId: track.id,
				path: file.uri,
			})
			return ok({
				track: updatedTrack,
				handledLocally: true,
				needsUpdate: true,
			})
		} else {
			logger.warning(
				'数据库中将该音频标记为已下载，但本地文件不存在，移除数据库标记并尝试从远程获取流',
			)
			toast.error('本地文件不存在，移除数据库下载标记并尝试从网络播放')
			const result = await trackService.createOrUpdateTrackDownloadRecord({
				trackId: track.id,
				status: 'failed',
				fileSize: 0,
			})

			if (result.isErr()) {
				logger.error('删除数据库下载记录失败：', { error: result.error })
			}

			// 修改 track，保证能顺利进入下面的刷新流逻辑
			const updatedTrack = produce(track, (draft) => {
				draft.trackDownloads = {
					status: 'failed',
					fileSize: 0,
					trackId: track.id,
					downloadedAt: Date.now(),
				}
				draft.bilibiliMetadata.bilibiliStreamUrl = undefined
			})

			return ok({
				track: updatedTrack,
				handledLocally: false,
				needsUpdate: true,
			})
		}
	}

	// 没有下载记录，或不是已下载状态：让调用方继续走远程流的过期检查/获取
	return ok({ track, handledLocally: false, needsUpdate: false })
}

/**
 * 先调用 tryUseLocalStream 做本地检查；如果本地已处理完则直接返回；
 * 否则继续原来的 B 站流刷新逻辑（CID 获取 + getAudioStream 等）。
 */
async function checkAndUpdateAudioStream(
	track: Track,
): Promise<
	Result<{ track: Track; needsUpdate: boolean }, BilibiliApiError | PlayerError>
> {
	logger.debug('开始检查并更新音频流', {
		trackId: track.id,
		title: track.title,
	})

	// 先把本地播放检查逻辑剥离出去
	const localCheck = await tryUseLocalStream(track)
	if (localCheck.isErr()) {
		return err(localCheck.error)
	}

	const localValue = localCheck.value
	// 使用可能被更新过的 track 继续后续逻辑
	track = localValue.track

	// 若本地已经处理（包含 source === 'local' 情况）则直接返回
	if (localValue.handledLocally) {
		logger.debug('本地检查已处理音频（无需远端刷新）', {
			trackId: track.id,
			needsUpdate: localValue.needsUpdate,
		})
		return ok({ track, needsUpdate: localValue.needsUpdate })
	}

	return err(
		createPlayerError('UnknownSource', `未知的 Track source: ${track.source}`),
	)
}

function _checkIsRedirected(stream: {
	url: string
	quality: number
	getTime: number
	type: 'mp4' | 'dash' | 'local'
}): ResultAsync<
	{
		url: string
		quality: number
		getTime: number
		type: 'mp4' | 'dash' | 'local'
	},
	BilibiliApiError
> {
	const url = stream.url
	return ResultAsync.fromPromise(
		fetch(url, {
			method: 'GET',
			headers: {
				'User-Agent':
					'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BiliApp/6.66.0',
				Referer: 'https://www.bilibili.com',
			},
		}),
		(e) => {
			return new BilibiliApiError({
				message: e instanceof Error ? e.message : String(e),
				type: 'RequestFailed',
			})
		},
	).andThen((response) => {
		if (!response.ok) {
			return err(
				new BilibiliApiError({
					message: `测试链接是否被重定向失败: ${response.status} ${response.statusText}`,
					msgCode: response.status,
					type: 'RequestFailed',
				}),
			)
		}
		console.log(response.status)
		console.log(`raw: ${url}`)
		const redirectUrl = response.url // react native 不支持 redirect: 'manual'，所以在这里直接获取最终跳转到的 URL
		console.log('redirectUrl', redirectUrl)
		if (!redirectUrl) {
			return err(
				new BilibiliApiError({
					message: '未获取到测试链接的解析结果',
					msgCode: 0,
					rawData: null,
					type: 'ResponseFailed',
				}),
			)
		}
		return ok({
			...stream,
			url: redirectUrl,
		})
	})
}

/**
 * 上报播放记录
 * 由于这只是一个非常边缘的功能，我们不关心他是否出错，所以发生报错时只写个 log，返回 void
 */
async function reportPlaybackHistory(
	track: Track,
	position: number,
): Promise<void> {
	if (!useAppStore.getState().settings.sendPlayHistory) return
	if (!useAppStore.getState().hasBilibiliCookie()) return
	if (
		track.source !== 'bilibili' ||
		!track.bilibiliMetadata.cid ||
		!track.bilibiliMetadata.bvid
	)
		return
	logger.debug('上报播放记录', {
		bvid: track.bilibiliMetadata.bvid,
		cid: track.bilibiliMetadata.cid,
		position,
	})
	const result = await bilibiliApi.reportPlaybackHistory(
		track.bilibiliMetadata.bvid,
		track.bilibiliMetadata.cid,
		position,
	)
	if (result.isErr()) {
		logger.warning('上报播放记录到 bilibili 失败', {
			params: {
				bvid: track.bilibiliMetadata.bvid,
				cid: track.bilibiliMetadata.cid,
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
}: {
	tracks: Track[]
	playNow: boolean
	clearQueue: boolean
	startFromKey?: string
	playNext: boolean
}) {
	if (!tracks || tracks.length === 0) {
		return
	}
	if (playNext && tracks.length > 1) {
		toastAndLogError(
			'AddToQueueError',
			'只能将单曲插入到下一首播放，已取消本次操作。',
			'Utils.Player',
		)
		return
	}
	logger.debug('添加曲目到播放队列', {
		trackCount: tracks.length,
		playNow,
		clearQueue,
		startFromKey,
		playNext,
	})

	try {
		if (clearQueue) {
			await Orpheus.clear()
		}
		const orpheusTracks: OrpheusTrack[] = []
		for (const track of tracks) {
			const result = convertToOrpheusTrack(track)
			if (result.isOk()) {
				orpheusTracks.push(result.value)
			} else {
				logger.error('转换为 OrpheusTrack 失败，跳过该曲目', {
					trackId: track.id,
					error: result.error,
				})
			}
		}
		if (orpheusTracks.length === 0) {
			return
		}
		if (playNext) {
			// 前面已经做过长度检查，这里直接取第一个
			await Orpheus.playNext(orpheusTracks[0])
			if (playNow) {
				await Orpheus.play()
				return
			}
			return
		}
		await Orpheus.addToEnd(orpheusTracks, startFromKey)
		if (playNow && !startFromKey) {
			await Orpheus.play()
			return
		}
	} catch (e) {
		logger.error('添加到队列失败：', { error: e })
	}
}

Orpheus.addListener('onPlayerError', (error) => {
	logger.error('播放器错误事件：', { error })
	toast.error(`播放器发生错误: ${error.message || '未知错误'}`, {
		description: error.code,
	})
})

export {
	addToQueue,
	checkAndUpdateAudioStream,
	checkBilibiliAudioExpiry,
	convertToOrpheusTrack,
	reportPlaybackHistory,
}

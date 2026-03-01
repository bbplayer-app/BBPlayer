import { fetch as fetchNetInfo } from '@react-native-community/netinfo'
import * as Sentry from '@sentry/react-native'
import * as FileSystem from 'expo-file-system'
import { errAsync, okAsync, Result, ResultAsync } from 'neverthrow'

import { useAppStore } from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { kugouApi, type KugouApi } from '@/lib/api/kugou/api'
import { neteaseApi, type NeteaseApi } from '@/lib/api/netease/api'
import { qqMusicApi, type QQMusicApi } from '@/lib/api/qqmusic/api'
import type { CustomError } from '@/lib/errors'
import { FileSystemError, LyricNotFoundError } from '@/lib/errors'
import type { BilibiliTrack, Track } from '@/types/core/media'
import type {
	LyricFileData,
	LyricProviderResponseData,
	LyricSearchResult,
	ParsedLrc,
} from '@/types/player/lyrics'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import { isActuallyOffline } from '@/utils/network'

const logger = log.extend('Service.Lyric')
type oldLyricFileType =
	| ParsedLrc
	| (Omit<ParsedLrc, 'rawOriginalLyrics' | 'rawTranslatedLyrics'> & {
			raw: string
	  })

class LyricService {
	constructor(
		readonly neteaseApi: NeteaseApi,
		readonly qqMusicApi: QQMusicApi,
		readonly kugouApi: KugouApi,
	) {}

	private cleanKeyword(keyword: string): string {
		const priorityRegex = /《(.+?)》|「(.+?)」/
		const priorityMatch = priorityRegex.exec(keyword)

		if (priorityMatch) {
			logger.debug(
				'匹配到优先提取的标记，直接返回这段字符串作为 keyword：',
				priorityMatch[1],
				priorityMatch[2],
			)
			return priorityMatch[1] || priorityMatch[2]
		}

		const replacedKeyword = keyword.replace(/【.*?】|“.*?”/g, '').trim()
		const result = replacedKeyword.length > 0 ? replacedKeyword : keyword
		logger.debug('最终 keyword 清洗后：', result)

		return result
	}

	/**
	 * 从多个数据源中获取最佳匹配的歌词
	 * @param track
	 * @param preciseKeyword 在提供该项时，将直接使用这个关键词搜索
	 * @returns
	 */
	public getBestMatchedLyrics(
		track: Track,
		preciseKeyword?: string,
		source?: 'auto' | 'netease' | 'qqmusic' | 'kugou',
	) {
		const keyword = preciseKeyword ?? this.cleanKeyword(track.title)
		const durationMs = track.duration * 1000

		// Keep track of abort controllers for cancellation
		const controllers: AbortController[] = []

		const createProviderPromise = (
			apiCall: (
				signal: AbortSignal,
			) => ResultAsync<LyricProviderResponseData, Error | CustomError>,
			providerName: string,
		) => {
			const controller = new AbortController()
			controllers.push(controller)

			return apiCall(controller.signal)
				.map((res) => {
					logger.debug(`${providerName} returned lyrics`)
					// If one succeeds, abort others
					controllers.forEach((c) => {
						if (c !== controller) {
							c.abort()
						}
					})
					return res
				})
				.match(
					(v) => v,
					(e) => {
						throw e
					},
				)
		}

		const providers: Promise<LyricProviderResponseData>[] = []

		if (source === 'netease' || source === undefined || source === 'auto') {
			providers.push(
				createProviderPromise(
					(signal) =>
						this.neteaseApi.searchBestMatchedLyrics(
							keyword,
							durationMs,
							signal,
						),
					'Netease',
				),
			)
		}

		if (source === 'qqmusic' || source === undefined || source === 'auto') {
			providers.push(
				createProviderPromise(
					(signal) =>
						this.qqMusicApi.searchBestMatchedLyrics(
							keyword,
							durationMs,
							signal,
						),
					'QQMusic',
				),
			)
		}

		if (source === 'kugou' || source === undefined || source === 'auto') {
			providers.push(
				createProviderPromise(
					(signal) =>
						this.kugouApi.searchBestMatchedLyrics(keyword, durationMs, signal),
					'Kugou',
				),
			)
		}

		return ResultAsync.fromPromise(Promise.any(providers), (e) => {
			// All failed
			// e will be an AggregateError if using Promise.any
			const aggregateError = e as AggregateError
			const errors = Array.from(aggregateError.errors || [])
			const errorMessages = errors
				.map((err) => {
					return err instanceof Error ? err.message : String(err)
				})
				.join('; ')

			return new LyricNotFoundError(
				`All lyric providers failed (${errors.length} providers). ${errorMessages}`,
				{ cause: e },
			)
		})
	}

	/**
	 * 优先从本地缓存中获取歌词，如果没有则从多个数据源并行查找，返回最匹配的歌词并进行缓存。
	 * @param track
	 * @returns
	 */
	public smartFetchLyrics(
		track: Track,
	): ResultAsync<LyricFileData, CustomError> {
		const lyricFile = new FileSystem.File(
			FileSystem.Paths.document,
			'lyrics',
			`${track.uniqueKey.replaceAll('::', '--')}.json`,
		)

		const fetchFromNetwork = (): ResultAsync<LyricFileData, CustomError> => {
			// Bilibili 特殊处理
			if (
				track.source === 'bilibili' &&
				track.bilibiliMetadata.bvid &&
				track.bilibiliMetadata.cid
			) {
				return ResultAsync.fromSafePromise(
					this.getPreciseMusicNameOnBilibiliVideo(track.bilibiliMetadata),
				)
					.andThen((musicName) => {
						const lyricSource =
							useAppStore.getState().settings.lyricSource ?? 'auto'
						return this.getBestMatchedLyrics(track, musicName, lyricSource)
					})
					.andThen((lyrics) => this.processAndSaveLyrics(lyrics, track))
			}

			// 标准源处理
			const lyricSource = useAppStore.getState().settings.lyricSource ?? 'auto'
			return this.getBestMatchedLyrics(track, undefined, lyricSource).andThen(
				(lyrics) => this.processAndSaveLyrics(lyrics, track),
			)
		}

		// 先尝试本地获取
		return ResultAsync.fromPromise(
			(async () => {
				if (!lyricFile.exists) {
					throw new Error('Cache miss')
				}

				const content = await Sentry.startSpan(
					{ name: 'io:file:read', op: 'io' },
					() => lyricFile.text(),
				)

				const parsed = JSON.parse(content) as LyricFileData

				if (!parsed || typeof parsed.lrc !== 'string') {
					throw new Error('Invalid lyric format')
				}

				return parsed
			})(),
			(e) => {
				// 抛出什么错误都无所谓的，因为我们下面会用 orElse 处理它
				return e
			},
		).orElse(() => {
			return ResultAsync.fromSafePromise(fetchNetInfo()).andThen(
				(networkState) => {
					if (isActuallyOffline(networkState)) {
						return errAsync(
							new LyricNotFoundError('当前处于离线状态，无法获取网络歌词'),
						)
					}
					return fetchFromNetwork()
				},
			)
		})
	}

	// 统一处理网络返回的歌词并保存
	private processAndSaveLyrics(
		lyrics: LyricProviderResponseData,
		track: Track,
	): ResultAsync<LyricFileData, CustomError> {
		const lyricFileData: LyricFileData = {
			...lyrics,
			id: track.uniqueKey,
			updateTime: Date.now(),
		}
		logger.info('网络搜索歌词完成，正在写入缓存')
		return this.saveLyricsToFile(lyricFileData, track.uniqueKey)
	}

	public saveLyricsToFile(
		lyrics: LyricFileData,
		uniqueKey: string,
	): ResultAsync<LyricFileData, FileSystemError> {
		try {
			const lyricFile = new FileSystem.File(
				FileSystem.Paths.document,
				'lyrics',
				`${uniqueKey.replaceAll('::', '--')}.json`,
			)
			lyricFile.parentDirectory.create({
				intermediates: true,
				idempotent: true,
			})
			Sentry.startSpan({ name: 'io:file:write', op: 'io' }, () =>
				lyricFile.write(JSON.stringify(lyrics)),
			)
			return okAsync(lyrics)
		} catch (e) {
			return errAsync(
				new FileSystemError(`保存歌词文件失败`, {
					cause: e,
					data: { uniqueKey },
				}),
			)
		}
	}

	public fetchLyrics(
		item: LyricSearchResult[0],
		uniqueKey: string,
	): ResultAsync<LyricFileData, Error> {
		switch (item.source) {
			case 'netease':
				return this.neteaseApi
					.getLyrics(item.remoteId)
					.andThen((lyrics) => okAsync(this.neteaseApi.parseLyrics(lyrics)))
					.andThen((lyrics) => {
						return okAsync({
							...lyrics,
							id: uniqueKey,
							updateTime: Date.now(),
						} as LyricFileData)
					})
					.andThen((lyrics) => {
						return this.saveLyricsToFile(lyrics, uniqueKey)
					})
			case 'qqmusic':
				return this.qqMusicApi
					.getLyrics(item.remoteId)
					.andThen((lyrics) => okAsync(this.qqMusicApi.parseLyrics(lyrics)))
					.andThen((lyrics) => {
						return okAsync({
							...lyrics,
							id: uniqueKey,
							updateTime: Date.now(),
						} as LyricFileData)
					})
					.andThen((lyrics) => {
						return this.saveLyricsToFile(lyrics, uniqueKey)
					})
			case 'kugou':
				return this.kugouApi
					.getLyrics(item.remoteId)
					.andThen((lyrics) => okAsync(this.kugouApi.parseLyrics(lyrics)))
					.andThen((lyrics) => {
						return okAsync({
							...lyrics,
							id: uniqueKey,
							updateTime: Date.now(),
						} as LyricFileData)
					})
					.andThen((lyrics) => {
						return this.saveLyricsToFile(lyrics, uniqueKey)
					})
			default:
				return errAsync(new Error('未知歌曲源'))
		}
	}

	/**
	 * 迁移旧版歌词格式
	 * 优化：增加标记文件检测，避免每次重启都遍历目录
	 */
	public async migrateFromOldFormat() {
		const lyricsDir = new FileSystem.Directory(
			FileSystem.Paths.document,
			'lyrics',
		)
		const migrationMarker = new FileSystem.File(lyricsDir, '.migration_v2_done')

		try {
			if (!lyricsDir.exists) return

			// 1. 检查标记文件，如果存在说明已经迁移过了，直接跳过
			if (migrationMarker.exists) {
				return
			}

			logger.info('检测到未迁移的歌词缓存，开始执行迁移...')
			const lyricFiles = lyricsDir.list()

			for (const file of lyricFiles) {
				if (file instanceof FileSystem.Directory) continue
				// 跳过标记文件本身
				if (file.name.startsWith('.')) continue
				if (!file.name.endsWith('.json')) continue

				try {
					// oxlint-disable-next-line no-await-in-loop
					const content = await file.text()
					let parsed: oldLyricFileType | LyricFileData | ParsedLrc
					try {
						parsed = JSON.parse(content) as
							| oldLyricFileType
							| LyricFileData
							| ParsedLrc
					} catch {
						continue
					}

					// 检查是否已经是新格式 (包含 lrc 字段)
					if ('lrc' in parsed) continue

					// 还原 ID
					const uniqueKey = file.name
						.replace('.json', '')
						.replaceAll('--', '::')

					// 提取数据
					let newLrc = ''
					let newTlyric: string | undefined
					let oldOffset: number | undefined

					if ('raw' in parsed && typeof parsed.raw === 'string') {
						const parts = parsed.raw.split('\n\n')
						newLrc = parts[0]
						newTlyric = parts.length > 1 ? parts[1] : undefined
						// 旧的 raw 格式通常没有外层的 offset 字段，或者在 parsed 对象上
						oldOffset = parsed.offset
					} else if ('rawOriginalLyrics' in parsed) {
						newLrc = parsed.rawOriginalLyrics || ''
						newTlyric = parsed.rawTranslatedLyrics
						oldOffset = parsed.offset
					}

					if (!newLrc) continue

					const newLyricData: LyricFileData = {
						id: uniqueKey,
						updateTime: Date.now(),
						lrc: newLrc,
						tlyric: newTlyric,
						misc: {
							// 迁移用户手动设置的 offset
							userOffset: oldOffset,
						},
					}

					// oxlint-disable-next-line no-await-in-loop
					await this.saveLyricsToFile(newLyricData, uniqueKey)
				} catch (e) {
					logger.warning(`文件 ${file.name} 迁移失败`, e)
				}
			}

			migrationMarker.create()
			logger.info('歌词格式迁移完成')
		} catch (e) {
			toastAndLogError('迁移歌词格式失败', e, 'Service.Lyric')
		}
	}

	public async getPreciseMusicNameOnBilibiliVideo(
		metadata: BilibiliTrack['bilibiliMetadata'],
	) {
		if (!metadata.cid || !metadata.bvid) return undefined
		const result = await bilibiliApi
			.getWebPlayerInfo(metadata.bvid, metadata.cid)
			.andThen((res) => {
				if (!res.bgm_info) {
					return errAsync(new Error('没有获取到歌曲信息'))
				}
				const filteredResult = /《(.+?)》/.exec(res.bgm_info.music_title)
				logger.debug('从 bilibili 获取到的该视频中识别到的歌曲名', {
					music_title: res.bgm_info.music_title,
				})
				if (filteredResult?.[1]) {
					return okAsync(filteredResult[1])
				}
				return okAsync(res.bgm_info.music_title)
			})
		if (result.isErr()) {
			return undefined
		}
		return result.value
	}

	/**
	 * 清除所有已缓存的歌词
	 * @returns
	 */
	public clearAllLyrics(): Result<true, unknown> {
		const lyricsDir = new FileSystem.Directory(
			FileSystem.Paths.document,
			'lyrics',
		)

		return Result.fromThrowable(() => {
			if (!lyricsDir.exists) {
				logger.debug('歌词目录不存在，无需清理')
				return true as const
			}
			lyricsDir.delete()
			lyricsDir.create({
				intermediates: true,
				idempotent: true,
			})
			logger.info('歌词缓存已清理')
			return true as const
		})()
	}
}

const lyricService = new LyricService(neteaseApi, qqMusicApi, kugouApi)
export default lyricService

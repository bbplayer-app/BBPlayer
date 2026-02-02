import * as Sentry from '@sentry/react-native'
import * as FileSystem from 'expo-file-system'
import { errAsync, okAsync, Result, ResultAsync } from 'neverthrow'

import { useAppStore } from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { kugouApi, type KugouApi } from '@/lib/api/kugou/api'
import { neteaseApi, type NeteaseApi } from '@/lib/api/netease/api'
import { qqMusicApi, type QQMusicApi } from '@/lib/api/qqmusic/api'
import type { CustomError } from '@/lib/errors'
import {
	DataParsingError,
	FileSystemError,
	LyricNotFoundError,
} from '@/lib/errors'
import type { BilibiliTrack, Track } from '@/types/core/media'
import type { LyricSearchResult, ParsedLrc } from '@/types/player/lyrics'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'

const logger = log.extend('Service.Lyric')
type lyricFileType =
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
			) => ResultAsync<ParsedLrc, Error | CustomError>,
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

		const providers: Promise<ParsedLrc>[] = []

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
					return `${err instanceof Error ? err.message : String(err)}`
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
	public smartFetchLyrics(track: Track): ResultAsync<ParsedLrc, CustomError> {
		try {
			const lyricFile = new FileSystem.File(
				FileSystem.Paths.document,
				'lyrics',
				`${track.uniqueKey.replaceAll('::', '--')}.json`,
			)
			lyricFile.parentDirectory.create({
				intermediates: true,
				idempotent: true,
			})
			if (lyricFile.exists) {
				return ResultAsync.fromPromise(
					Sentry.startSpan({ name: 'io:file:read', op: 'io' }, () =>
						lyricFile.text(),
					),
					(e) =>
						new FileSystemError(`读取歌词缓存失败`, {
							cause: e,
							data: { filePath: lyricFile.uri },
						}),
				).andThen((content) => {
					try {
						return okAsync(JSON.parse(content) as ParsedLrc)
					} catch (e) {
						return errAsync(
							new DataParsingError('解析歌词缓存失败', { cause: e }),
						)
					}
				})
			}

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
					.andThen((lyrics) => {
						logger.info('自动搜索最佳匹配的歌词完成')
						Sentry.startSpan({ name: 'io:file:write', op: 'io' }, () =>
							lyricFile.write(JSON.stringify(lyrics)),
						)
						return okAsync(lyrics)
					})
			}

			const lyricSource = useAppStore.getState().settings.lyricSource ?? 'auto'

			return this.getBestMatchedLyrics(track, undefined, lyricSource).andThen(
				(lyrics) => {
					logger.info('自动搜索最佳匹配的歌词完成')
					Sentry.startSpan({ name: 'io:file:write', op: 'io' }, () =>
						lyricFile.write(JSON.stringify(lyrics)),
					)
					return okAsync(lyrics)
				},
			)
		} catch (e) {
			return errAsync(new FileSystemError('处理歌词文件失败', { cause: e }))
		}
	}

	public saveLyricsToFile(
		lyrics: ParsedLrc,

		uniqueKey: string,
	): ResultAsync<ParsedLrc, FileSystemError> {
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
	): ResultAsync<ParsedLrc | string, Error> {
		switch (item.source) {
			case 'netease':
				return this.neteaseApi
					.getLyrics(item.remoteId)
					.andThen((lyrics) => okAsync(this.neteaseApi.parseLyrics(lyrics)))
					.andThen((lyrics) => {
						return this.saveLyricsToFile(lyrics, uniqueKey)
					})
			case 'qqmusic':
				return this.qqMusicApi
					.getLyrics(item.remoteId)
					.andThen((lyrics) => okAsync(this.qqMusicApi.parseLyrics(lyrics)))
					.andThen((lyrics) => {
						return this.saveLyricsToFile(lyrics, uniqueKey)
					})
			case 'kugou':
				return this.kugouApi
					.getLyrics(item.remoteId)
					.andThen((lyrics) => okAsync(this.kugouApi.parseLyrics(lyrics)))
					.andThen((lyrics) => {
						return this.saveLyricsToFile(lyrics, uniqueKey)
					})
			default:
				return errAsync(new Error('未知歌曲源'))
		}
	}

	/**
	 * 迁移旧版歌词格式
	 */
	public async migrateFromOldFormat() {
		const lyricsDir = new FileSystem.Directory(
			FileSystem.Paths.document,
			'lyrics',
		)
		try {
			if (!lyricsDir.exists) {
				logger.debug('歌词缓存目录不存在，无需迁移')
				return
			}

			const lyricFiles = lyricsDir.list()

			for (const file of lyricFiles) {
				if (file instanceof FileSystem.Directory) continue
				const content = await file.text()
				const parsed = JSON.parse(content) as lyricFileType
				const finalLyric: ParsedLrc = {
					tags: parsed.tags,
					offset: parsed.offset,
					lyrics: parsed.lyrics,
					rawOriginalLyrics: '',
				}
				if ('raw' in parsed) {
					const trySplitIt = parsed.raw.split('\n\n')
					if (trySplitIt.length === 2) {
						finalLyric.rawOriginalLyrics = trySplitIt[0]
						finalLyric.rawTranslatedLyrics = trySplitIt[1]
					} else {
						finalLyric.rawOriginalLyrics = parsed.raw
					}
				} else {
					finalLyric.rawOriginalLyrics = parsed.rawOriginalLyrics
					finalLyric.rawTranslatedLyrics = parsed.rawTranslatedLyrics
				}

				await this.saveLyricsToFile(finalLyric, file.name.replace('.json', ''))
			}
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

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { neteaseApi } from '@/lib/api/netease/api'
import { DataParsingError, FileSystemError } from '@/lib/errors'
import type { NeteaseApiError } from '@/lib/errors/thirdparty/netease'
import type { BilibiliTrack, Track } from '@/types/core/media'
import type { LyricSearchResult, ParsedLrc } from '@/types/player/lyrics'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import { Context, Effect, Layer } from 'effect'
import * as FileSystem from 'expo-file-system'

const logger = log.extend('Service.Lyric')

type LyricFileType =
	| ParsedLrc
	| (Omit<ParsedLrc, 'rawOriginalLyrics' | 'rawTranslatedLyrics'> & {
			raw: string
	  })

export class LyricService extends Context.Tag('LyricService')<
	LyricService,
	{
		getBestMatchedLyrics: (
			track: Track,
			preciseKeyword?: string,
		) => Effect.Effect<
			ParsedLrc,
			FileSystemError | DataParsingError | NeteaseApiError
		>

		smartFetchLyrics: (
			track: Track,
		) => Effect.Effect<
			ParsedLrc,
			FileSystemError | DataParsingError | NeteaseApiError
		>

		saveLyricsToFile: (
			lyrics: ParsedLrc,
			uniqueKey: string,
		) => Effect.Effect<ParsedLrc, FileSystemError>

		fetchLyrics: (
			item: LyricSearchResult[0],
			uniqueKey: string,
		) => Effect.Effect<ParsedLrc, Error | FileSystemError>

		migrateFromOldFormat: () => Effect.Effect<void>

		getPreciseMusicNameOnBilibiliVideo: (
			metadata: BilibiliTrack['bilibiliMetadata'],
		) => Effect.Effect<string | undefined, Error>

		clearAllLyrics: () => Effect.Effect<true>
	}
>() {}

export const LyricServiceLive = Layer.effect(
	LyricService,
	// eslint-disable-next-line require-yield
	Effect.gen(function* () {
		const cleanKeyword = (keyword: string): string => {
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

		const getBestMatchedLyrics = (track: Track, preciseKeyword?: string) =>
			Effect.gen(function* () {
				const keyword = preciseKeyword ?? cleanKeyword(track.title)

				const searchEffect = neteaseApi.searchBestMatchedLyrics(
					keyword,
					track.duration * 1000,
				)

				const results = yield* Effect.all([searchEffect])

				// FIXME: fuck what's this???
				const randomIndex = Math.floor(Math.random() * results.length)
				return results[randomIndex]
			}).pipe(Effect.withSpan('LyricService.getBestMatchedLyrics'))

		const getPreciseMusicNameOnBilibiliVideo = (
			metadata: BilibiliTrack['bilibiliMetadata'],
		) =>
			Effect.gen(function* () {
				if (!metadata.cid || !metadata.bvid) return undefined

				const res = yield* bilibiliApi.getWebPlayerInfo(
					metadata.bvid,
					metadata.cid,
				)

				const bgm = res.bgm_info

				if (!bgm) {
					return yield* Effect.fail(new Error('没有获取到歌曲信息'))
				}

				const filteredResult = /《(.+?)》/.exec(bgm.music_title)

				yield* Effect.sync(() => {
					logger.debug('从 bilibili 获取到的该视频中识别到的歌曲名', {
						music_title: bgm.music_title,
					})
				})

				if (filteredResult?.[1]) {
					return filteredResult[1]
				}
				return bgm.music_title
			}).pipe(
				Effect.catchAll(() => Effect.succeed(undefined)),
				Effect.withSpan('LyricService.getPreciseMusicNameOnBilibiliVideo'),
			)

		const saveLyricsToFile = (lyrics: ParsedLrc, uniqueKey: string) =>
			Effect.gen(function* () {
				try {
					const lyricFile = new FileSystem.File(
						FileSystem.Paths.document,
						'lyrics',
						`${uniqueKey.replaceAll('::', '--')}.json`,
					)

					// 同步执行副作用，用 Effect.sync 包裹
					yield* Effect.sync(() => {
						lyricFile.parentDirectory.create({
							intermediates: true,
							idempotent: true,
						})
					})

					// 写入操作，原代码使用了 Sentry span，现在替换为 Effect span
					yield* Effect.try({
						try: () => lyricFile.write(JSON.stringify(lyrics)),
						catch: (e) =>
							new FileSystemError({
								message: `保存歌词文件失败`,
								cause: e,
								data: { uniqueKey },
							}),
					}).pipe(Effect.withSpan('io:file:write'))

					return lyrics
				} catch (e) {
					// 捕获 new FileSystem.File 可能抛出的同步错误
					return yield* new FileSystemError({
						message: `保存歌词文件失败 (Init)`,
						cause: e,
						data: { uniqueKey },
					})
				}
			}).pipe(Effect.withSpan('LyricService.saveLyricsToFile'))

		const smartFetchLyrics = (track: Track) =>
			Effect.gen(function* () {
				// 1. 尝试从本地缓存读取
				try {
					const lyricFile = new FileSystem.File(
						FileSystem.Paths.document,
						'lyrics',
						`${track.uniqueKey.replaceAll('::', '--')}.json`,
					)

					yield* Effect.sync(() => {
						lyricFile.parentDirectory.create({
							intermediates: true,
							idempotent: true,
						})
					})

					if (lyricFile.exists) {
						const content = yield* Effect.tryPromise({
							try: () => lyricFile.text(),
							catch: (e) =>
								new FileSystemError({
									message: `读取歌词缓存失败`,
									cause: e,
									data: { filePath: lyricFile.uri },
								}),
						}).pipe(Effect.withSpan('io:file:read'))

						return yield* Effect.try({
							try: () => JSON.parse(content) as ParsedLrc,
							catch: (e) =>
								new DataParsingError({
									message: `解析歌词文件失败`,
									cause: e,
									data: { filePath: lyricFile.uri },
								}),
						})
					}
				} catch (e) {
					return yield* Effect.fail(
						new FileSystemError({
							message: `读取歌词缓存失败 (Init)`,
							cause: e,
							data: { uniqueKey: track.uniqueKey },
						}),
					)
				}

				// 2. 本地没有，尝试 Bilibili 精确搜索
				if (
					track.source === 'bilibili' &&
					track.bilibiliMetadata.bvid &&
					track.bilibiliMetadata.cid
				) {
					const musicName = yield* getPreciseMusicNameOnBilibiliVideo(
						track.bilibiliMetadata,
					)

					// 如果获取到了精确歌名，或者没获取到（undefined），这里逻辑是串行的
					// 原逻辑: if Bilibili meta exists -> getPrecise -> (if success) getBestMatched -> save
					// 注意：原逻辑 result.isErr() 会导致 undefined，然后 undefined 传给 preciseKeyword 会导致 fallback 到 title
					// 这里的 musicName 可能是 undefined，符合原逻辑

					const lyrics = yield* getBestMatchedLyrics(track, musicName)

					yield* Effect.logInfo('自动搜索最佳匹配的歌词完成')

					// 这里需要手动构造 uniqueKey，因为 getBestMatchedLyrics 没传
					yield* saveLyricsToFile(lyrics, track.uniqueKey)
					return lyrics
				}

				// 3. 最后尝试默认搜索
				const lyrics = yield* getBestMatchedLyrics(track)
				yield* Effect.logInfo('自动搜索最佳匹配的歌词完成')
				yield* saveLyricsToFile(lyrics, track.uniqueKey)

				return lyrics
			}).pipe(Effect.withSpan('LyricService.smartFetchLyrics'))

		const fetchLyrics = (item: LyricSearchResult[0], uniqueKey: string) =>
			Effect.gen(function* () {
				switch (item.source) {
					case 'netease': {
						const rawLyrics = yield* neteaseApi.getLyrics(item.remoteId)
						// neteaseApi.parseLyrics 是同步纯函数，直接调用或用 sync 包裹
						const parsedLyrics = neteaseApi.parseLyrics(rawLyrics)
						return yield* saveLyricsToFile(parsedLyrics, uniqueKey)
					}
					default:
						return yield* Effect.fail(new Error('未知歌曲源'))
				}
			}).pipe(Effect.withSpan('LyricService.fetchLyrics'))

		const migrateFromOldFormat = () =>
			Effect.gen(function* () {
				const lyricsDir = new FileSystem.Directory(
					FileSystem.Paths.document,
					'lyrics',
				)

				const exists = yield* Effect.sync(() => lyricsDir.exists)
				if (!exists) {
					yield* Effect.logDebug('歌词缓存目录不存在，无需迁移')
					return
				}

				const lyricFiles = yield* Effect.sync(() => lyricsDir.list())

				for (const file of lyricFiles) {
					if (file instanceof FileSystem.Directory) continue

					const content = yield* Effect.tryPromise(() => file.text())
					const parsed = JSON.parse(content) as LyricFileType

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

					yield* saveLyricsToFile(finalLyric, file.name.replace('.json', ''))
				}
				yield* Effect.logInfo('歌词格式迁移完成')
			}).pipe(
				Effect.catchAll((e) =>
					Effect.sync(() => {
						// 保持原来的 UI 反馈逻辑
						toastAndLogError('迁移歌词格式失败', e, 'Service.Lyric')
					}),
				),
				Effect.withSpan('LyricService.migrateFromOldFormat'),
			)

		const clearAllLyrics = () =>
			Effect.gen(function* () {
				const lyricsDir = new FileSystem.Directory(
					FileSystem.Paths.document,
					'lyrics',
				)

				const exists = yield* Effect.sync(() => lyricsDir.exists)

				if (!exists) {
					yield* Effect.logDebug('歌词目录不存在，无需清理')
					return true
				}

				yield* Effect.sync(() => {
					lyricsDir.delete()
					lyricsDir.create({
						intermediates: true,
						idempotent: true,
					})
				})

				yield* Effect.logInfo('歌词缓存已清理')
				return true as const
			}).pipe(Effect.withSpan('LyricService.clearAllLyrics'))

		return {
			getBestMatchedLyrics,
			smartFetchLyrics,
			saveLyricsToFile,
			fetchLyrics,
			migrateFromOldFormat,
			getPreciseMusicNameOnBilibiliVideo,
			clearAllLyrics,
		}
	}),
)

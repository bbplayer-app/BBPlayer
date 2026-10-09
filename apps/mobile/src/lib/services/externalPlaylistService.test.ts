import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { QueryClient } from '@tanstack/react-query'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import type { StateStorage } from 'zustand/middleware'

import {
	BilibiliApiError,
	isBilibiliRateLimitError,
} from '@/lib/errors/thirdparty/bilibili'
import type { SqliteSyncExecutor } from '@/lib/services/externalImportJobService'
import type { BilibiliSearchVideo } from '@/types/apis/bilibili'
import type { GenericPlaylist, GenericTrack } from '@/types/external_playlist'

type SearchVideosParams = {
	keyword: string
	page: number
	skipCookie?: boolean
	signal?: AbortSignal
}

type SearchVideosReturn = ResultAsync<
	{ result: BilibiliSearchVideo[]; numPages: number },
	BilibiliApiError
>

type TestContext = {
	sqliteExecutor: SqliteSyncExecutor
	searchVideosMock: jest.Mock<
		(params: SearchVideosParams) => SearchVideosReturn
	>
	storageMap: Map<string, string>
	stateStorage: StateStorage
}

type GlobalWithTestContext = {
	bbplayerTestContext?: TestContext
}

function createNodeSqliteExecutor(
	enableForeignKeys = false,
): SqliteSyncExecutor {
	const rawDb = new DatabaseSync(':memory:')
	if (enableForeignKeys) {
		rawDb.exec('PRAGMA foreign_keys = ON;')
	} else {
		rawDb.exec('PRAGMA foreign_keys = OFF;')
	}
	return {
		execSync: (sql: string) => {
			rawDb.exec(sql)
		},
		getFirstSync: <T>(sql: string, params: (string | number | null)[] = []) => {
			const row = rawDb.prepare(sql).get(...params) as T | undefined
			return row ?? null
		},
		getAllSync: <T>(sql: string, params: (string | number | null)[] = []) => {
			return rawDb.prepare(sql).all(...params) as T[]
		},
		runSync: (sql: string, params: (string | number | null)[] = []) => {
			return rawDb.prepare(sql).run(...params)
		},
		withTransactionSync: (task: () => void) => {
			rawDb.exec('BEGIN;')
			try {
				task()
				rawDb.exec('COMMIT;')
			} catch (e) {
				rawDb.exec('ROLLBACK;')
				throw e
			}
		},
	}
}

function mockGetTestContext(): TestContext {
	const holder = globalThis as unknown as GlobalWithTestContext
	if (!holder.bbplayerTestContext) {
		const sqliteExecutor = createNodeSqliteExecutor()
		const map = new Map<string, string>()
		holder.bbplayerTestContext = {
			sqliteExecutor,
			searchVideosMock:
				jest.fn<(params: SearchVideosParams) => SearchVideosReturn>(),
			storageMap: map,
			stateStorage: {
				getItem: (name: string) => map.get(name) ?? null,
				setItem: (name: string, value: string) => {
					map.set(name, value)
				},
				removeItem: (name: string) => {
					map.delete(name)
				},
			},
		}
	}
	return holder.bbplayerTestContext
}

const {
	searchVideosMock,
	storageMap,
	stateStorage: mockStateStorage,
} = mockGetTestContext()

jest.mock('@/lib/db/db', () => ({
	__esModule: true,
	get expoDb() {
		return mockGetTestContext().sqliteExecutor
	},
	default: {},
}))

jest.mock('@/lib/api/bilibili/api', () => ({
	bilibiliApi: {
		searchVideos: (params: SearchVideosParams) =>
			mockGetTestContext().searchVideosMock(params),
	},
}))

jest.mock('@/lib/api/netease/api', () => ({
	neteaseApi: {
		getPlaylist: jest.fn(),
	},
}))

jest.mock('@/lib/api/qqmusic/api', () => ({
	qqMusicApi: {
		getPlaylist: jest.fn(),
	},
}))

jest.mock('@/lib/services/playlistOutService', () => ({
	playlistOutService: {
		resolvePlaylist: jest.fn(),
		getCachedPlaylist: jest.fn(() => errAsync(new Error('not in cache'))),
	},
}))

jest.mock('@/utils/log', () => ({
	__esModule: true,
	default: {
		extend: () => ({
			debug: jest.fn(),
			info: jest.fn(),
			warning: jest.fn(),
			error: jest.fn(),
		}),
	},
}))

jest.mock('@/utils/mmkv', () => ({
	get zustandStorage() {
		return mockGetTestContext().stateStorage
	},
	storage: {
		getString: (key: string) => mockGetTestContext().storageMap.get(key),
		set: (key: string, value: string) =>
			mockGetTestContext().storageMap.set(key, value),
		remove: (key: string) => mockGetTestContext().storageMap.delete(key),
	},
}))

jest.mock('@bbplayer/native', () => ({
	updateImportProgressNotification: jest.fn(() => true),
	cancelImportProgressNotification: jest.fn(() => true),
}))

import { shouldRetryBilibiliSearch } from '@/hooks/queries/bilibili/search'
import {
	createExternalPlaylistSyncStore,
	getProgressFromResults,
	reconcileSessionResults,
} from '@/hooks/stores/useExternalPlaylistSyncStore'
import {
	applyPlaylistViewModeToTrack,
	createImportItemId,
	createImportJobId,
	ExternalImportJobService,
	externalImportJobService,
	isJobWaitingConfirmation,
	LEGACY_SYNC_STORAGE_KEY,
	parseExternalPlaylistIdFromUniqueKey,
} from '@/lib/services/externalImportJobService'
import {
	buildAndroidNotificationPayload,
	buildImportDeepLinkUri,
	buildIosLiveActivityPayload,
	ExternalImportNotificationService,
} from '@/lib/services/externalImportNotificationService'
import {
	DEFAULT_REQUEST_DELAY_MS,
	externalPlaylistService,
	getMatchResultStatus,
	getTrackFingerprint,
	isMatchResultForTrack,
	type MatchResult,
} from '@/lib/services/externalPlaylistService'
import {
	ExternalPlaylistImportWorker,
	externalPlaylistImportWorker,
} from '@/lib/workers/ExternalPlaylistImportWorker'

const createTrack = (
	index: number,
	overrides?: Partial<GenericTrack>,
): GenericTrack => ({
	title: `Song ${index}`,
	artists: [`Artist ${index}`],
	album: `Album ${index}`,
	duration: 200_000,
	coverUrl: `https://example.com/cover-${index}.jpg`,
	...overrides,
})

const createPlaylistMetadata = (
	id: string,
	trackCount: number,
	overrides?: Partial<GenericPlaylist>,
): GenericPlaylist => ({
	id,
	title: `Playlist ${id}`,
	coverUrl: `https://example.com/playlist-${id}.jpg`,
	description: `Description for ${id}`,
	trackCount,
	author: {
		name: 'Creator',
		id: 100,
	},
	platform: 'netease',
	...overrides,
})

const createBilibiliVideo = (
	index: number,
	overrides?: Partial<BilibiliSearchVideo>,
): BilibiliSearchVideo =>
	({
		type: 'video',
		id: index,
		author: `UP ${index}`,
		mid: 1000 + index,
		typeid: 130,
		typename: '音乐综合',
		arcurl: `https://www.bilibili.com/video/BV10000${index}`,
		aid: index,
		bvid: `BV10000${index}`,
		title: `Song ${index} - Artist ${index}`,
		description: '',
		pic: `https://example.com/pic-${index}.jpg`,
		play: 1000,
		video_review: 10,
		favorites: 10,
		tag: '',
		review: 10,
		pubdate: 0,
		senddate: 0,
		duration: '3:20',
		badgepay: false,
		hit_columns: [],
		view_type: '',
		is_pay: 0,
		is_union_video: 0,
		rec_tags: null,
		new_rec_tags: [],
		rank_score: 100,
		...overrides,
	}) as BilibiliSearchVideo

describe('Stage 1: ExternalPlaylistService & Bilibili risk control circuit breaker', () => {
	beforeEach(() => {
		storageMap.clear()
		externalImportJobService.clearAllJobsForTesting()
		jest.clearAllMocks()
	})

	it('uses conservative default request interval', () => {
		expect(DEFAULT_REQUEST_DELAY_MS).toBeGreaterThanOrEqual(2500)
		expect(DEFAULT_REQUEST_DELAY_MS).toBeLessThanOrEqual(3000)
	})

	it('distinguishes matched, unmatched, and ordinary network/timeout errors while continuing normal matching', async () => {
		const tracks = [
			createTrack(0, { title: '晴天', artists: ['周杰伦'], duration: 269_000 }),
			createTrack(1, {
				title: '冷门无结果曲',
				artists: ['未知'],
				duration: 180_000,
			}),
			createTrack(2, {
				title: '网络波动曲',
				artists: ['周杰伦'],
				duration: 240_000,
			}),
			createTrack(3, { title: '夜曲', artists: ['周杰伦'], duration: 226_000 }),
		]

		searchVideosMock
			.mockImplementationOnce(() =>
				okAsync({
					result: [
						createBilibiliVideo(0, {
							bvid: 'BV1Qingtian',
							title: '晴天 - 周杰伦',
							duration: '4:29',
						}),
					],
					numPages: 1,
				}),
			)
			.mockImplementationOnce(() =>
				okAsync({
					// Duration mismatch > 20s -> no suitable video
					result: [
						createBilibiliVideo(1, {
							bvid: 'BV1WrongDuration',
							title: '某长达10分钟的视频',
							duration: '10:00',
						}),
					],
					numPages: 1,
				}),
			)
			.mockImplementationOnce(() =>
				errAsync(
					new BilibiliApiError({
						message: '请求失败: Network request failed',
						type: 'RequestFailed',
					}),
				),
			)
			.mockImplementationOnce(() =>
				okAsync({
					result: [
						createBilibiliVideo(3, {
							bvid: 'BV1Yequ',
							title: '夜曲 - 周杰伦',
							duration: '3:46',
						}),
					],
					numPages: 1,
				}),
			)

		const progressRecords: Array<{ index: number; result: MatchResult }> = []
		const res = await externalPlaylistService.matchExternalPlaylist(
			tracks,
			(_current, _total, result, trackIndex) => {
				progressRecords.push({ index: trackIndex, result })
			},
			{ requestDelayMs: 0 },
		)

		expect(res.isOk()).toBe(true)
		expect(searchVideosMock).toHaveBeenCalledTimes(4)
		expect(progressRecords).toHaveLength(4)

		// Index 0: matched
		expect(progressRecords[0]?.result.status).toBe('matched')
		expect(progressRecords[0]?.result.matchedVideo?.bvid).toBe('BV1Qingtian')

		// Index 1: normal unmatched (not error)
		expect(progressRecords[1]?.result.status).toBe('unmatched')
		expect(progressRecords[1]?.result.matchedVideo).toBeNull()
		expect(progressRecords[1]?.result.errorType).toBeUndefined()

		// Index 2: ordinary network error (NOT permanently marked as unmatched)
		expect(progressRecords[2]?.result.status).toBe('error')
		expect(progressRecords[2]?.result.errorType).toBe('network')
		expect(progressRecords[2]?.result.matchedVideo).toBeNull()

		// Index 3: matched after previous unmatched and network error
		expect(progressRecords[3]?.result.status).toBe('matched')
		expect(progressRecords[3]?.result.matchedVideo?.bvid).toBe('BV1Yequ')
	})

	it('marks per-request timeout as error with timeout errorType instead of unmatched', async () => {
		const tracks = [createTrack(0), createTrack(1)]

		searchVideosMock
			.mockImplementationOnce(({ signal }: { signal?: AbortSignal }) =>
				ResultAsync.fromPromise(
					new Promise((_resolve, reject) => {
						signal?.addEventListener(
							'abort',
							() => {
								const abortErr = new Error('Aborted')
								abortErr.name = 'AbortError'
								reject(abortErr)
							},
							{ once: true },
						)
					}),
					(e) =>
						new BilibiliApiError({
							message: '请求被取消',
							type: 'RequestAborted',
							cause: e,
						}),
				),
			)
			.mockImplementationOnce(() =>
				okAsync({
					result: [createBilibiliVideo(1)],
					numPages: 1,
				}),
			)

		const progressRecords: MatchResult[] = []
		const res = await externalPlaylistService.matchExternalPlaylist(
			tracks,
			(_c, _t, result) => {
				progressRecords.push(result)
			},
			{ requestDelayMs: 0, searchTimeoutMs: 20 },
		)

		expect(res.isOk()).toBe(true)
		expect(progressRecords[0]?.status).toBe('error')
		expect(progressRecords[0]?.errorType).toBe('timeout')
		expect(progressRecords[1]?.status).toBe('matched')
	})

	it.each([
		[
			'Bilibili 412',
			new BilibiliApiError({
				message: '请求 bilibili API 失败: 412 Precondition Failed',
				msgCode: 412,
				type: 'RequestFailed',
			}),
		],
		[
			'Bilibili -412 code',
			new BilibiliApiError({
				message: '请求被拦截',
				msgCode: -412,
				type: 'ResponseFailed',
			}),
		],
		[
			'HTTP 429',
			new BilibiliApiError({
				message: '请求 bilibili API 失败: 429 Too Many Requests',
				msgCode: 429,
				type: 'RequestFailed',
			}),
		],
	])(
		'circuit-breaks immediately on %s without requesting subsequent tracks or marking current track as unmatched',
		async (_label, rateLimitError) => {
			const tracks = Array.from({ length: 6 }, (_, i) => createTrack(i))
			const store = createExternalPlaylistSyncStore(mockStateStorage)
			store.getState().setSessionKey('netease:1001', tracks)

			searchVideosMock
				.mockImplementationOnce(() =>
					okAsync({
						result: [createBilibiliVideo(0, { bvid: 'BV1Track0' })],
						numPages: 1,
					}),
				)
				.mockImplementationOnce(() =>
					okAsync({
						result: [],
						numPages: 0,
					}),
				)
				.mockImplementationOnce(() => errAsync(rateLimitError))
				.mockImplementation(() =>
					okAsync({
						result: [createBilibiliVideo(99, { bvid: 'BV1ShouldNotCall' })],
						numPages: 1,
					}),
				)

			const res = await externalPlaylistService.matchExternalPlaylist(
				tracks,
				(_current, _total, matchResult, trackIndex) => {
					store.getState().setResult(trackIndex, matchResult)
				},
				{ requestDelayMs: 0 },
			)

			// 1. matchExternalPlaylist stops with rate-limit error
			expect(res.isErr()).toBe(true)
			if (res.isErr()) {
				expect(isBilibiliRateLimitError(res.error)).toBe(true)
			}

			// 2. Subsequent tracks (3, 4, 5) are NEVER requested
			expect(searchVideosMock).toHaveBeenCalledTimes(3)

			// 3. Previously completed results (0 and 1) are preserved
			const state = store.getState()
			expect(state.results[0]?.status).toBe('matched')
			expect(state.results[0]?.matchedVideo?.bvid).toBe('BV1Track0')
			expect(state.results[1]?.status).toBe('unmatched')

			// 4. Current track (2) that triggered rate limit is marked rate_limited, NOT unmatched
			expect(state.results[2]?.status).toBe('rate_limited')
			expect(state.results[2]?.status).not.toBe('unmatched')
			expect(state.results[3]).toBeUndefined()

			// 5. Store is marked isRateLimited and progress only counts completed items (2 / 6)
			expect(state.isRateLimited).toBe(true)
			expect(state.progress).toBeCloseTo(2 / 6)
		},
	)

	it('handles 100 tracks pause at 35 and resume without re-processing completed tracks, plus page exit and app restart recovery', async () => {
		const tracks = Array.from({ length: 100 }, (_, i) => createTrack(i))
		const sessionKey = 'netease:playlist_100'
		const store = createExternalPlaylistSyncStore(mockStateStorage)
		store.getState().setSessionKey(sessionKey, tracks)

		const abortController = new AbortController()

		searchVideosMock.mockImplementation(({ keyword }: { keyword: string }) => {
			const match = keyword.match(/Song (\d+)/)
			const idx = match ? Number(match[1]) : 0
			// Make every 5th song unmatched, others matched
			const videos =
				idx % 5 === 0
					? []
					: [createBilibiliVideo(idx, { bvid: `BV1Song${idx}` })]
			return okAsync({ result: videos, numPages: 1 })
		})

		// First run: pause right after 35 tracks are processed
		const firstRunResult = await externalPlaylistService.matchExternalPlaylist(
			tracks,
			(current, _total, matchResult, trackIndex) => {
				store.getState().setResult(trackIndex, matchResult)
				if (current === 35) {
					abortController.abort()
				}
			},
			{
				signal: abortController.signal,
				requestDelayMs: 0,
			},
		)

		expect(firstRunResult.isErr()).toBe(true)
		if (firstRunResult.isErr()) {
			expect(firstRunResult.error.message).toBe('Aborted')
		}
		expect(searchVideosMock).toHaveBeenCalledTimes(35)
		expect(Object.keys(store.getState().results)).toHaveLength(35)
		expect(store.getState().progress).toBeCloseTo(35 / 100)

		// Simulate App kill & restart: create a brand new store instance reading from persistent SQLite job
		const restartedStore = createExternalPlaylistSyncStore(mockStateStorage)
		restartedStore.getState().setSessionKey(sessionKey, tracks)

		expect(Object.keys(restartedStore.getState().results)).toHaveLength(35)
		expect(restartedStore.getState().progress).toBeCloseTo(35 / 100)
		expect(restartedStore.getState().results[0]?.status).toBe('unmatched')
		expect(restartedStore.getState().results[1]?.matchedVideo?.bvid).toBe(
			'BV1Song1',
		)

		// Compute remaining pending indexes (35..99)
		const restoredResults = restartedStore.getState().results
		const pendingIndexes = tracks
			.map((track, idx) => {
				const r = restoredResults[idx]
				const valid = isMatchResultForTrack(r, track) ? r : undefined
				const status = getMatchResultStatus(valid)
				return status === 'pending' || status === 'rate_limited' ? idx : -1
			})
			.filter((idx) => idx >= 0)

		expect(pendingIndexes).toHaveLength(65)
		expect(pendingIndexes[0]).toBe(35)
		expect(pendingIndexes[64]).toBe(99)

		searchVideosMock.mockClear()

		// Resume remaining 65 tracks
		const secondRunResult = await externalPlaylistService.matchExternalPlaylist(
			tracks,
			(_current, _total, matchResult, trackIndex) => {
				restartedStore.getState().setResult(trackIndex, matchResult)
			},
			{
				trackIndexes: pendingIndexes,
				requestDelayMs: 0,
			},
		)

		expect(secondRunResult.isOk()).toBe(true)
		// Only the remaining 65 tracks were requested!
		expect(searchVideosMock).toHaveBeenCalledTimes(65)
		expect(Object.keys(restartedStore.getState().results)).toHaveLength(100)
		expect(restartedStore.getState().progress).toBeCloseTo(1)
	})

	it('prevents old BVID from being silently applied to a different song when external playlist order changes', () => {
		const trackQingtian = createTrack(0, {
			title: '晴天',
			artists: ['周杰伦'],
			album: '叶惠美',
			duration: 269_000,
		})
		const trackYequ = createTrack(1, {
			title: '夜曲',
			artists: ['周杰伦'],
			album: '十一月的萧邦',
			duration: 226_000,
		})
		const trackQilixiang = createTrack(2, {
			title: '七里香',
			artists: ['周杰伦'],
			album: '七里香',
			duration: 299_000,
		})

		const sessionKey = 'netease:reorder_test'
		const store = createExternalPlaylistSyncStore(mockStateStorage)
		store.getState().setSessionKey(sessionKey, [trackQingtian, trackYequ])

		// Initially index 0 is 晴天 matched to BV1Qingtian
		store.getState().setResult(0, {
			track: trackQingtian,
			matchedVideo: createBilibiliVideo(0, {
				bvid: 'BV1Qingtian',
				title: '晴天 - 周杰伦',
			}),
			status: 'matched',
			trackFingerprint: getTrackFingerprint(trackQingtian),
		})

		// Case A: Playlist order swaps so index 0 = 夜曲, index 1 = 晴天
		const swappedTracks = [trackYequ, trackQingtian]
		store.getState().setSessionKey(sessionKey, swappedTracks)

		const swappedResults = store.getState().results
		// Index 0 (夜曲) MUST NOT receive 晴天's BV1Qingtian!
		expect(swappedResults[0]).toBeUndefined()
		// Index 1 (晴天) preserves its matched result by fingerprint
		expect(swappedResults[1]?.matchedVideo?.bvid).toBe('BV1Qingtian')
		expect(isMatchResultForTrack(swappedResults[1], trackQingtian)).toBe(true)
		expect(isMatchResultForTrack(swappedResults[1], trackYequ)).toBe(false)

		// Case B: 晴天 is removed from the playlist and replaced by [夜曲, 七里香]
		const replacedTracks = [trackYequ, trackQilixiang]
		const reconciled = reconcileSessionResults(swappedResults, replacedTracks)
		expect(reconciled[0]).toBeUndefined()
		expect(reconciled[1]).toBeUndefined()
		expect(getProgressFromResults(reconciled, replacedTracks.length)).toBe(0)
	})

	it('does not trigger React Query extra retries on 412 / 429 in manual search while allowing retries for transient network errors', async () => {
		const rateLimit412 = new BilibiliApiError({
			message: '请求 bilibili API 失败: 412 Precondition Failed',
			msgCode: 412,
			type: 'RequestFailed',
		})
		const rateLimit429 = new BilibiliApiError({
			message: '请求 bilibili API 失败: 429 Too Many Requests',
			msgCode: 429,
			type: 'RequestFailed',
		})
		const transientNetworkError = new BilibiliApiError({
			message: '请求失败: Network request failed',
			type: 'RequestFailed',
		})

		expect(shouldRetryBilibiliSearch(0, rateLimit412)).toBe(false)
		expect(shouldRetryBilibiliSearch(0, rateLimit429)).toBe(false)
		expect(shouldRetryBilibiliSearch(0, transientNetworkError)).toBe(true)
		expect(shouldRetryBilibiliSearch(1, transientNetworkError)).toBe(true)
		expect(shouldRetryBilibiliSearch(2, transientNetworkError)).toBe(false)

		// Verify with real TanStack QueryClient that 412 only executes queryFn once (no extra 2 retries)
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: 2,
					retryDelay: 0,
				},
			},
		})

		const queryFn412 = jest.fn(async () => {
			throw rateLimit412
		})

		await expect(
			queryClient.fetchQuery({
				queryKey: ['bilibili', 'search', 'results', '晴天'],
				queryFn: queryFn412,
				retry: shouldRetryBilibiliSearch,
			}),
		).rejects.toThrow(rateLimit412)

		expect(queryFn412).toHaveBeenCalledTimes(1)

		// Whereas transient network error retries 2 additional times (total 3 calls)
		const queryFnNetwork = jest.fn(async () => {
			throw transientNetworkError
		})

		await expect(
			queryClient.fetchQuery({
				queryKey: ['bilibili', 'search', 'results', '夜曲'],
				queryFn: queryFnNetwork,
				retry: shouldRetryBilibiliSearch,
			}),
		).rejects.toThrow(transientNetworkError)

		expect(queryFnNetwork).toHaveBeenCalledTimes(3)
	})
})

describe('Stage 2: Persistent Import Job & Import Item model', () => {
	beforeEach(() => {
		storageMap.clear()
		externalImportJobService.clearAllJobsForTesting()
		jest.clearAllMocks()
	})

	it('creates an import job with stable jobId, playlist metadata, and stable itemId per track independent of array index', () => {
		const tracks = [
			createTrack(0, {
				title: '晴天',
				artists: ['周杰伦'],
				album: '叶惠美',
				duration: 269_000,
			}),
			createTrack(1, {
				title: '夜曲',
				artists: ['周杰伦'],
				album: '十一月的萧邦',
				duration: 226_000,
			}),
			// Duplicate song in the same playlist should receive distinct occurrence ordinal
			createTrack(2, {
				title: '晴天',
				artists: ['周杰伦'],
				album: '叶惠美',
				duration: 269_000,
			}),
		]
		const playlistMeta = createPlaylistMetadata('88888', tracks.length, {
			title: '周杰伦精选',
		})

		const snapshot = externalImportJobService.createOrResumeJob({
			source: 'netease',
			sourcePlaylistId: '88888',
			tracks,
			playlistMetadata: playlistMeta,
			legacyStorage: mockStateStorage,
		})

		const expectedJobId = createImportJobId('netease', '88888')
		expect(snapshot.job.jobId).toBe('import:netease:88888')
		expect(snapshot.job.jobId).toBe(expectedJobId)
		expect(snapshot.job.source).toBe('netease')
		expect(snapshot.job.sourcePlaylistId).toBe('88888')
		expect(snapshot.job.playlistMetadata.title).toBe('周杰伦精选')
		expect(snapshot.job.totalCount).toBe(3)
		expect(snapshot.job.processedCount).toBe(0)
		expect(snapshot.job.matchedCount).toBe(0)
		expect(snapshot.job.unmatchedCount).toBe(0)
		expect(snapshot.job.errorCount).toBe(0)
		expect(snapshot.job.rateLimitedCount).toBe(0)
		expect(snapshot.job.status).toBe('pending')
		expect(snapshot.job.lastProcessedAt).toBeNull()

		expect(snapshot.items).toHaveLength(3)
		const fpQingtian = getTrackFingerprint(tracks[0])
		const fpYequ = getTrackFingerprint(tracks[1])

		expect(snapshot.items[0]?.itemId).toBe(
			createImportItemId(expectedJobId, fpQingtian, 0),
		)
		expect(snapshot.items[1]?.itemId).toBe(
			createImportItemId(expectedJobId, fpYequ, 0),
		)
		expect(snapshot.items[2]?.itemId).toBe(
			createImportItemId(expectedJobId, fpQingtian, 1),
		)
		// Item IDs do not depend on originalIndex (0, 1, 2)
		expect(snapshot.items[1]?.itemId).not.toContain('::1')
	})

	it('accurately tracks matched, unmatched, error, and rate_limited statistics across pause, resume, page unmount, and app restart', () => {
		const tracks = Array.from({ length: 5 }, (_, i) => createTrack(i))
		const playlistMeta = createPlaylistMetadata('2002', tracks.length)
		const sessionKey = 'qq:2002'

		// 1. Mount page store 1 and start matching
		const pageStore1 = createExternalPlaylistSyncStore(mockStateStorage)
		pageStore1.getState().setSessionKey(sessionKey, tracks, playlistMeta)

		expect(pageStore1.getState().currentJobId).toBe('import:qq:2002')
		expect(pageStore1.getState().jobStatus).toBe('pending')

		pageStore1.getState().setSyncing(true)
		expect(pageStore1.getState().jobStatus).toBe('running')

		// Track 0: matched
		pageStore1.getState().setResult(0, {
			track: tracks[0],
			matchedVideo: createBilibiliVideo(0, { bvid: 'BV1Matched0' }),
			status: 'matched',
		})
		// Track 1: unmatched
		pageStore1.getState().setResult(1, {
			track: tracks[1],
			matchedVideo: null,
			status: 'unmatched',
		})
		// Track 2: network error
		pageStore1.getState().setResult(2, {
			track: tracks[2],
			matchedVideo: null,
			status: 'error',
			errorType: 'network',
			errorMessage: 'Network request failed',
		})
		// Track 3: rate_limited (412)
		pageStore1.getState().setResult(3, {
			track: tracks[3],
			matchedVideo: null,
			status: 'rate_limited',
			errorType: 'rate_limited',
			errorMessage: '412 Precondition Failed',
		})
		pageStore1.getState().setSyncing(false)

		expect(pageStore1.getState().jobStatus).toBe('rate_limited')
		expect(pageStore1.getState().matchedCount).toBe(1)
		expect(pageStore1.getState().unmatchedCount).toBe(1)
		expect(pageStore1.getState().errorCount).toBe(1)
		expect(pageStore1.getState().rateLimitedCount).toBe(1)
		expect(pageStore1.getState().processedCount).toBe(2)
		expect(pageStore1.getState().job?.lastProcessedAt).not.toBeNull()

		// 2. Simulate page Store 1 unmount and App restart with a brand new store instance
		const pageStore2 = createExternalPlaylistSyncStore(mockStateStorage)
		pageStore2.getState().setSessionKey(sessionKey, tracks, playlistMeta)

		const restoredState = pageStore2.getState()
		expect(restoredState.currentJobId).toBe('import:qq:2002')
		expect(restoredState.jobStatus).toBe('rate_limited')
		expect(restoredState.isRateLimited).toBe(true)
		expect(restoredState.matchedCount).toBe(1)
		expect(restoredState.unmatchedCount).toBe(1)
		expect(restoredState.errorCount).toBe(1)
		expect(restoredState.rateLimitedCount).toBe(1)
		expect(restoredState.processedCount).toBe(2)

		// 3. Resume matching from pageStore2 and finish remaining tracks (2, 3, 4)
		pageStore2.getState().setSyncing(true)
		expect(pageStore2.getState().jobStatus).toBe('running')
		expect(pageStore2.getState().rateLimitedCount).toBe(0)

		pageStore2.getState().setResult(2, {
			track: tracks[2],
			matchedVideo: createBilibiliVideo(2, { bvid: 'BV1Matched2' }),
			status: 'matched',
		})
		pageStore2.getState().setResult(3, {
			track: tracks[3],
			matchedVideo: createBilibiliVideo(3, { bvid: 'BV1Matched3' }),
			status: 'matched',
		})
		pageStore2.getState().setResult(4, {
			track: tracks[4],
			matchedVideo: null,
			status: 'unmatched',
		})
		pageStore2.getState().setSyncing(false)

		const finalState = pageStore2.getState()
		expect(finalState.jobStatus).toBe('completed')
		expect(finalState.matchedCount).toBe(3)
		expect(finalState.unmatchedCount).toBe(2)
		expect(finalState.errorCount).toBe(0)
		expect(finalState.rateLimitedCount).toBe(0)
		expect(finalState.processedCount).toBe(5)
		expect(finalState.progress).toBe(1)
	})

	it('never leaves a fake running status after an unexpected App crash or force-kill', () => {
		const tracks = [createTrack(0), createTrack(1), createTrack(2)]
		const snapshot = externalImportJobService.createOrResumeJob({
			source: 'netease',
			sourcePlaylistId: 'crash_test',
			tracks,
			legacyStorage: mockStateStorage,
		})

		// Job starts running and completes 1 item before App is force-killed
		externalImportJobService.updateJobStatus(snapshot.job.jobId, 'running')
		externalImportJobService.updateItemResult(snapshot.job.jobId, 0, {
			track: tracks[0],
			matchedVideo: createBilibiliVideo(0, { bvid: 'BV1CrashSurvivor' }),
			status: 'matched',
		})

		const beforeCrash = externalImportJobService.getJobSnapshot(
			snapshot.job.jobId,
		)
		expect(beforeCrash?.job.status).toBe('running')

		// On next App launch, recoverStuckJobs() runs
		const recoveredCount = externalImportJobService.recoverStuckJobs()
		expect(recoveredCount).toBe(1)

		const afterRestart = externalImportJobService.getJobSnapshot(
			snapshot.job.jobId,
		)
		expect(afterRestart?.job.status).toBe('paused')
		expect(afterRestart?.job.matchedCount).toBe(1)
		expect(afterRestart?.job.processedCount).toBe(1)
		expect(afterRestart?.items[0]?.matchedVideo?.bvid).toBe('BV1CrashSurvivor')
	})

	it('preserves unfinished job business state when page Store unmounts mid-run', () => {
		const tracks = [createTrack(0), createTrack(1), createTrack(2)]
		const pageStore = createExternalPlaylistSyncStore(mockStateStorage)
		pageStore.getState().setSessionKey('netease:unmount_test', tracks)
		pageStore.getState().setSyncing(true)

		pageStore.getState().setResult(0, {
			track: tracks[0],
			matchedVideo: createBilibiliVideo(0, { bvid: 'BV1SavedBeforeUnmount' }),
			status: 'matched',
		})

		// Simulate external-sync.tsx unmount cleanup: abort + setSyncing(false)
		pageStore.getState().setSyncing(false)

		const persisted = externalImportJobService.getJobSnapshot(
			'import:netease:unmount_test',
		)
		expect(persisted).not.toBeNull()
		expect(persisted?.job.status).toBe('paused')
		expect(persisted?.job.matchedCount).toBe(1)
		expect(persisted?.items[0]?.matchedVideo?.bvid).toBe(
			'BV1SavedBeforeUnmount',
		)
		expect(persisted?.items[1]?.status).toBe('pending')
	})

	it('migrates verifiable legacy MMKV session once, ignores corrupted/unverifiable entries, and prevents mis-associating reordered songs', () => {
		const trackA = createTrack(0, {
			title: '晴天',
			artists: ['周杰伦'],
			album: '叶惠美',
			duration: 269_000,
		})
		const trackB = createTrack(1, {
			title: '夜曲',
			artists: ['周杰伦'],
			album: '十一月的萧邦',
			duration: 226_000,
		})
		const trackC = createTrack(2, {
			title: '稻香',
			artists: ['周杰伦'],
			album: '魔杰座',
			duration: 223_000,
		})

		// Seed legacy MMKV storage where:
		// - index 0 was 晴天 (matched to BV1LegacyQingtian)
		// - index 1 was corrupted / missing track metadata (unverifiable, MUST be ignored!)
		// - another session 'qq:other' also exists and should remain untouched
		storageMap.set(
			LEGACY_SYNC_STORAGE_KEY,
			JSON.stringify({
				state: {
					sessions: {
						'netease:legacy_1': {
							results: {
								0: {
									track: trackA,
									matchedVideo: createBilibiliVideo(0, {
										bvid: 'BV1LegacyQingtian',
										title: '晴天 - 周杰伦',
									}),
								},
								1: {
									// Unverifiable legacy record without valid track object
									matchedVideo: createBilibiliVideo(1, {
										bvid: 'BV1Corrupted',
									}),
								},
							},
							isRateLimited: false,
							updatedAt: 1700000123000,
						},
						'qq:other_session': {
							results: {},
							updatedAt: 1700000999000,
						},
					},
				},
				version: 0,
			}),
		)

		// Now load the playlist where order has changed to [夜曲, 晴天, 稻香]
		const currentTracks = [trackB, trackA, trackC]
		const store = createExternalPlaylistSyncStore(mockStateStorage)
		store.getState().setSessionKey('netease:legacy_1', currentTracks)

		const state = store.getState()
		expect(state.currentJobId).toBe('import:netease:legacy_1')
		expect(state.jobStatus).toBe('paused')
		expect(state.matchedCount).toBe(1)
		expect(state.processedCount).toBe(1)

		// Index 0 is now 夜曲 -> MUST NOT receive 晴天's BV1LegacyQingtian or corrupted index 1!
		expect(state.results[0]).toBeUndefined()
		expect(state.items[0]?.status).toBe('pending')

		// Index 1 is now 晴天 -> receives migrated BV1LegacyQingtian by fingerprint!
		expect(state.results[1]?.matchedVideo?.bvid).toBe('BV1LegacyQingtian')
		expect(state.items[1]?.status).toBe('matched')
		expect(state.items[1]?.originalIndex).toBe(1)

		// Index 2 (稻香) is pending
		expect(state.results[2]).toBeUndefined()
		expect(state.items[2]?.status).toBe('pending')

		// Legacy MMKV entry 'netease:legacy_1' was cleaned up after one-time migration, while 'qq:other_session' remains
		const remainingRaw = storageMap.get(LEGACY_SYNC_STORAGE_KEY)
		expect(remainingRaw).toBeDefined()
		const remainingParsed = JSON.parse(remainingRaw!)
		expect(remainingParsed.state.sessions['netease:legacy_1']).toBeUndefined()
		expect(remainingParsed.state.sessions['qq:other_session']).toBeDefined()
	})

	it('applies Drizzle SQL migration 0023_external_import_jobs.sql cleanly on an existing SQLite database', () => {
		const freshSqlite = createNodeSqliteExecutor(true)
		const migrationPath = path.resolve(
			__dirname,
			'../../../drizzle/0023_external_import_jobs.sql',
		)
		const migrationSql = fs.readFileSync(migrationPath, 'utf8')
		const statements = migrationSql
			.split('--> statement-breakpoint')
			.map((s) => s.trim())
			.filter(Boolean)

		for (const stmt of statements) {
			freshSqlite.execSync(stmt)
		}

		const customJobService = new ExternalImportJobService(() => freshSqlite)
		const tracks = [createTrack(0), createTrack(1)]
		const snapshot = customJobService.createOrResumeJob({
			source: 'playlistout',
			sourcePlaylistId: 'mig_test',
			tracks,
			legacyStorage: mockStateStorage,
		})

		expect(snapshot.job.jobId).toBe('import:playlistout:mig_test')
		expect(snapshot.items).toHaveLength(2)

		// Verify ON DELETE CASCADE when deleting job row directly
		freshSqlite.runSync(`DELETE FROM external_import_jobs WHERE job_id = ?`, [
			snapshot.job.jobId,
		])
		const remainingItems = freshSqlite.getAllSync(
			`SELECT * FROM external_import_items WHERE job_id = ?`,
			[snapshot.job.jobId],
		)
		expect(remainingItems).toHaveLength(0)
	})
})

describe('Stage 3: Decoupled ExternalPlaylistImportWorker & Background Execution', () => {
	beforeEach(() => {
		externalPlaylistImportWorker.resetForTesting()
		storageMap.clear()
		externalImportJobService.clearAllJobsForTesting()
		jest.clearAllMocks()
	})

	it('continues matching in the background when external-sync page unmounts and restores live progress on re-entry', async () => {
		const tracks = [createTrack(0), createTrack(1), createTrack(2)]
		const playlistMeta = createPlaylistMetadata('stage3_bg', tracks.length)
		const sessionKey = 'netease:stage3_bg'

		let releaseSecondTrack!: () => void
		const secondTrackBlocked = new Promise<void>((resolve) => {
			releaseSecondTrack = resolve
		})

		searchVideosMock.mockImplementation(({ keyword }) => {
			const idx = tracks.findIndex((t) => keyword.includes(t.title))
			if (idx === 1) {
				return ResultAsync.fromSafePromise(secondTrackBlocked).andThen(() =>
					okAsync({
						result: [createBilibiliVideo(1, { bvid: 'BV1BgTrack1' })],
						numPages: 1,
					}),
				)
			}
			return okAsync({
				result: [
					createBilibiliVideo(idx >= 0 ? idx : 0, {
						bvid: `BV1BgTrack${idx >= 0 ? idx : 0}`,
					}),
				],
				numPages: 1,
			})
		})

		// 1. User opens external-sync page (pageStore1) and starts matching
		const pageStore1 = createExternalPlaylistSyncStore(mockStateStorage)
		pageStore1.getState().setSessionKey(sessionKey, tracks, playlistMeta)

		const runPromise = pageStore1.getState().startOrResumeMatching({
			requestDelayMs: 5,
		})

		// Wait briefly for track 0 to complete and worker to enter track 1
		await new Promise((r) => setTimeout(r, 25))

		expect(
			externalPlaylistImportWorker.isJobRunning('import:netease:stage3_bg'),
		).toBe(true)
		expect(pageStore1.getState().syncing).toBe(true)
		expect(pageStore1.getState().matchedCount).toBe(1)

		// 2. User navigates back to Home / other playlist / plays music -> pageStore1 unmounts
		pageStore1.getState().unbindWorkerEvents()

		// Unmounting pageStore1 MUST NOT abort the worker!
		expect(
			externalPlaylistImportWorker.isJobRunning('import:netease:stage3_bg'),
		).toBe(true)

		// 3. User re-enters external-sync page (pageStore2) while worker is still running in the background
		const pageStore2 = createExternalPlaylistSyncStore(mockStateStorage)
		pageStore2.getState().setSessionKey(sessionKey, tracks, playlistMeta)

		expect(pageStore2.getState().syncing).toBe(true)
		expect(pageStore2.getState().jobStatus).toBe('running')
		expect(pageStore2.getState().matchedCount).toBe(1)

		// 4. Unblock track 1 so the worker finishes track 1 and track 2
		releaseSecondTrack()
		await runPromise

		expect(
			externalPlaylistImportWorker.isJobRunning('import:netease:stage3_bg'),
		).toBe(false)
		expect(pageStore2.getState().syncing).toBe(false)
		expect(pageStore2.getState().jobStatus).toBe('completed')
		expect(pageStore2.getState().matchedCount).toBe(3)
		expect(pageStore2.getState().processedCount).toBe(3)
		expect(pageStore2.getState().progress).toBe(1)
		expect(pageStore2.getState().results[0]?.matchedVideo?.bvid).toBe(
			'BV1BgTrack0',
		)
		expect(pageStore2.getState().results[1]?.matchedVideo?.bvid).toBe(
			'BV1BgTrack1',
		)
		expect(pageStore2.getState().results[2]?.matchedVideo?.bvid).toBe(
			'BV1BgTrack2',
		)

		pageStore2.getState().unbindWorkerEvents()
	})

	it('supports explicit pause and resumes only remaining unfinished items without re-requesting completed items', async () => {
		const tracks = [
			createTrack(0),
			createTrack(1),
			createTrack(2),
			createTrack(3),
		]
		const playlistMeta = createPlaylistMetadata('stage3_pause', tracks.length)
		const sessionKey = 'qq:stage3_pause'

		const pageStore = createExternalPlaylistSyncStore(mockStateStorage)
		pageStore.getState().setSessionKey(sessionKey, tracks, playlistMeta)

		searchVideosMock.mockImplementation(({ keyword }) => {
			const idx = tracks.findIndex((t) => keyword.includes(t.title))
			// After track 1 (second item) is requested, pause after it resolves
			if (idx === 1) {
				setTimeout(() => {
					pageStore.getState().pauseMatching()
				}, 5)
			}
			return okAsync({
				result: [createBilibiliVideo(idx, { bvid: `BV1Pause${idx}` })],
				numPages: 1,
			})
		})

		await pageStore.getState().startOrResumeMatching({
			requestDelayMs: 40,
		})

		expect(
			externalPlaylistImportWorker.isJobRunning('import:qq:stage3_pause'),
		).toBe(false)
		expect(pageStore.getState().syncing).toBe(false)
		expect(pageStore.getState().jobStatus).toBe('paused')
		expect(pageStore.getState().matchedCount).toBe(2)
		expect(searchVideosMock).toHaveBeenCalledTimes(2)

		// Now resume matching: only tracks 2 and 3 should be requested
		searchVideosMock.mockClear()
		await pageStore.getState().startOrResumeMatching({
			requestDelayMs: 5,
		})

		expect(searchVideosMock).toHaveBeenCalledTimes(2)
		expect(pageStore.getState().jobStatus).toBe('completed')
		expect(pageStore.getState().matchedCount).toBe(4)
		expect(pageStore.getState().progress).toBe(1)

		pageStore.getState().unbindWorkerEvents()
	})

	it('prevents duplicate starts of the same job and pauses an active job when starting a different job (single-task concurrency)', async () => {
		const tracksA = [createTrack(0), createTrack(1), createTrack(2)]
		const tracksB = [createTrack(10), createTrack(11)]

		const jobSnapA = externalImportJobService.createOrResumeJob({
			source: 'netease',
			sourcePlaylistId: 'job_a',
			tracks: tracksA,
			legacyStorage: mockStateStorage,
		})
		const jobSnapB = externalImportJobService.createOrResumeJob({
			source: 'qq',
			sourcePlaylistId: 'job_b',
			tracks: tracksB,
			legacyStorage: mockStateStorage,
		})

		let resolveSlowRequestA!: () => void
		const slowRequestA = new Promise<void>((resolve) => {
			resolveSlowRequestA = resolve
		})

		searchVideosMock.mockImplementation(({ keyword, signal }) => {
			if (keyword.includes('Song 0')) {
				return ResultAsync.fromSafePromise(
					new Promise<void>((resolve) => {
						const onAbort = () => resolve()
						signal?.addEventListener('abort', onAbort, { once: true })
						void slowRequestA.then(() => {
							signal?.removeEventListener('abort', onAbort)
							resolve()
						})
					}),
				).andThen(() =>
					okAsync({
						result: [createBilibiliVideo(0, { bvid: 'BV1JobA0' })],
						numPages: 1,
					}),
				)
			}
			const idx = tracksB.findIndex((t) => keyword.includes(t.title))
			return okAsync({
				result: [
					createBilibiliVideo(idx >= 0 ? 10 + idx : 10, {
						bvid: `BV1JobB${idx >= 0 ? idx : 0}`,
					}),
				],
				numPages: 1,
			})
		})

		// Start Job A
		const promiseA1 = externalPlaylistImportWorker.start(jobSnapA.job.jobId, {
			requestDelayMs: 5,
		})

		await new Promise((r) => setTimeout(r, 15))
		expect(externalPlaylistImportWorker.isJobRunning(jobSnapA.job.jobId)).toBe(
			true,
		)

		// Duplicate start of Job A must reuse the existing run and not trigger a second searchVideos call
		const promiseA2 = externalPlaylistImportWorker.start(jobSnapA.job.jobId, {
			requestDelayMs: 5,
		})
		expect(searchVideosMock).toHaveBeenCalledTimes(1)

		// Starting Job B while Job A is running must automatically pause Job A first
		const outcomeB = await externalPlaylistImportWorker.start(
			jobSnapB.job.jobId,
			{
				requestDelayMs: 5,
			},
		)
		resolveSlowRequestA()
		await Promise.all([promiseA1, promiseA2])

		const snapshotA = externalImportJobService.getJobSnapshot(
			jobSnapA.job.jobId,
		)
		expect(snapshotA?.job.status).toBe('paused')
		expect(outcomeB.status).toBe('completed')
		expect(outcomeB.snapshot?.job.matchedCount).toBe(2)
	})

	it('immediately circuit-breaks the worker on 412 / 429 rate-limit and never auto-restarts', async () => {
		const tracks = [createTrack(0), createTrack(1), createTrack(2)]
		const pageStore = createExternalPlaylistSyncStore(mockStateStorage)
		pageStore.getState().setSessionKey('netease:stage3_412', tracks)

		searchVideosMock.mockImplementation(({ keyword }) => {
			if (keyword.toLowerCase().startsWith('song 1')) {
				return errAsync(
					new BilibiliApiError({
						message: '请求 bilibili API 失败: 412 Precondition Failed',
						msgCode: 412,
						type: 'RequestFailed',
					}),
				)
			}
			return okAsync({
				result: [createBilibiliVideo(0, { bvid: 'BV1Before412' })],
				numPages: 1,
			})
		})

		await pageStore.getState().startOrResumeMatching({
			requestDelayMs: 5,
		})

		expect(
			externalPlaylistImportWorker.isJobRunning('import:netease:stage3_412'),
		).toBe(false)
		expect(pageStore.getState().syncing).toBe(false)
		expect(pageStore.getState().isRateLimited).toBe(true)
		expect(pageStore.getState().jobStatus).toBe('rate_limited')
		expect(pageStore.getState().matchedCount).toBe(1)
		expect(pageStore.getState().rateLimitedCount).toBe(1)
		// Song 2 was never requested
		expect(searchVideosMock).toHaveBeenCalledTimes(2)
		expect(pageStore.getState().items[2]?.status).toBe('pending')

		pageStore.getState().unbindWorkerEvents()
	})

	it('recovers stale running jobs after simulated process death via externalPlaylistImportWorker.recoverStuckJobs()', () => {
		const customWorker = new ExternalPlaylistImportWorker()
		const tracks = [createTrack(0), createTrack(1)]
		const snap = externalImportJobService.createOrResumeJob({
			source: 'netease',
			sourcePlaylistId: 'killed_job',
			tracks,
			legacyStorage: mockStateStorage,
		})
		externalImportJobService.updateJobStatus(snap.job.jobId, 'running')

		expect(customWorker.isJobRunning(snap.job.jobId)).toBe(false)
		const recovered = customWorker.recoverStuckJobs()
		expect(recovered).toBe(1)

		const afterRecovery = externalImportJobService.getJobSnapshot(
			snap.job.jobId,
		)
		expect(afterRecovery?.job.status).toBe('paused')
	})
})

describe('Stage 4: System Background Execution & Progress Notification Adapter', () => {
	beforeEach(() => {
		searchVideosMock.mockReset()
		storageMap.clear()
		externalImportJobService.clearAllJobsForTesting()
	})

	it('builds Android notification and iOS Live Activity payloads for running, paused, rate_limited, and completed states', () => {
		const tracks = [createTrack(0), createTrack(1), createTrack(2)]
		const snap = externalImportJobService.createOrResumeJob({
			source: 'netease',
			sourcePlaylistId: 'notif_test',
			playlistMetadata: {
				title: '测试歌单',
				description: 'desc',
				coverUrl: null,
			},
			tracks,
			legacyStorage: mockStateStorage,
		})

		externalImportJobService.updateItemResult(snap.job.jobId, 0, {
			track: tracks[0],
			matchedVideo: createBilibiliVideo(0),
			status: 'matched',
		})
		externalImportJobService.updateJobStatus(snap.job.jobId, 'running')
		const runningSnapshot = externalImportJobService.getJobSnapshot(
			snap.job.jobId,
		)!

		const runningEvent = {
			type: 'progress' as const,
			jobId: snap.job.jobId,
			snapshot: runningSnapshot,
			currentTrackTitle: 'Song 1 - Artist 1',
			etaSeconds: 4,
		}

		const androidRunning = buildAndroidNotificationPayload(runningEvent)
		expect(androidRunning).not.toBeNull()
		expect(androidRunning?.title).toContain('正在匹配《测试歌单》')
		expect(androidRunning?.body).toContain('1 / 3 · 33%')
		expect(androidRunning?.subText).toContain('当前：Song 1 - Artist 1')
		expect(androidRunning?.ongoing).toBe(true)
		expect(androidRunning?.deepLinkUri).toBe(
			buildImportDeepLinkUri('netease', 'notif_test'),
		)

		const iosRunning = buildIosLiveActivityPayload(
			runningSnapshot,
			'Song 1 - Artist 1',
		)
		expect(iosRunning?.compactLeadingText).toBe('BB')
		expect(iosRunning?.compactTrailingText).toBe('1/3')
		expect(iosRunning?.statusMessage).toBe('正在匹配：Song 1 - Artist 1')

		// Rate limited state
		externalImportJobService.updateItemResult(snap.job.jobId, 1, {
			track: tracks[1],
			matchedVideo: null,
			status: 'rate_limited',
			errorType: 'rate_limited',
			errorMessage: '412 Precondition Failed',
		})
		externalImportJobService.updateJobStatus(snap.job.jobId, 'rate_limited')
		const rateLimitedSnapshot = externalImportJobService.getJobSnapshot(
			snap.job.jobId,
		)!
		const rateLimitedEvent = {
			type: 'rate_limited' as const,
			jobId: snap.job.jobId,
			snapshot: rateLimitedSnapshot,
			currentTrackTitle: null,
			etaSeconds: null,
		}
		const androidRateLimited = buildAndroidNotificationPayload(rateLimitedEvent)
		expect(androidRateLimited?.title).toContain('歌单匹配已暂停')
		expect(androidRateLimited?.body).toContain('Bilibili 请求暂时受限')
		expect(androidRateLimited?.ongoing).toBe(false)

		const iosRateLimited = buildIosLiveActivityPayload(
			rateLimitedSnapshot,
			null,
		)
		expect(iosRateLimited?.statusMessage).toContain('请求受限，已暂停保护进度')
	})

	it('updates notifications on worker progress/completion and pauses gracefully on iOS background expiration', async () => {
		const androidCalls: string[] = []
		const iosCalls: string[] = []
		let cancelledCount = 0

		const mockAdapter = {
			updateAndroidNotification: (opts: { title: string; status: string }) => {
				androidCalls.push(`${opts.status}:${opts.title}`)
				return true
			},
			cancelAndroidNotification: () => {
				cancelledCount++
				return true
			},
			updateIosLiveActivity: (
				payload: { status: string; progressText: string } | null,
			) => {
				iosCalls.push(
					payload ? `${payload.status}:${payload.progressText}` : 'null',
				)
			},
		}

		const notifSvc = new ExternalImportNotificationService(
			externalPlaylistImportWorker,
			mockAdapter,
		)
		notifSvc.startListening()

		const tracks = [createTrack(0), createTrack(1), createTrack(2)]
		const snap = externalImportJobService.createOrResumeJob({
			source: 'qq',
			sourcePlaylistId: 'notif_worker',
			tracks,
			legacyStorage: mockStateStorage,
		})

		searchVideosMock.mockImplementation(({ keyword }) => {
			const idx = tracks.findIndex((t) => keyword.includes(t.title))
			return okAsync({
				result: [createBilibiliVideo(idx >= 0 ? idx : 0)],
				numPages: 1,
			})
		})

		await externalPlaylistImportWorker.start(snap.job.jobId, {
			requestDelayMs: 5,
		})

		expect(androidCalls.some((c) => c.startsWith('running:'))).toBe(true)
		expect(androidCalls.some((c) => c.startsWith('completed:'))).toBe(true)
		expect(iosCalls.some((c) => c.startsWith('completed:'))).toBe(true)

		// Cancelled event clears notification
		externalPlaylistImportWorker.cancel(snap.job.jobId)
		expect(cancelledCount).toBe(1)
		notifSvc.stopListening()
	})
})

describe('Stage 5: Draft Importing Playlist in Library List', () => {
	beforeEach(() => {
		searchVideosMock.mockReset()
		storageMap.clear()
		externalImportJobService.clearAllJobsForTesting()
	})

	it('lists unconfirmed jobs in listActiveDraftJobs, marks completed-unconfirmed jobs as waiting confirmation, and hides confirmed or deleted jobs', async () => {
		const tracks = [createTrack(0), createTrack(1)]
		const draft = externalImportJobService.createOrResumeJob({
			source: 'netease',
			sourcePlaylistId: 'draft_1',
			playlistMetadata: {
				title: '导入中的网易云歌单',
				description: '草稿测试',
				coverUrl: 'https://example.com/draft.jpg',
			},
			tracks,
			legacyStorage: mockStateStorage,
		})

		let activeDrafts = externalImportJobService.listActiveDraftJobs()
		expect(activeDrafts).toHaveLength(1)
		expect(activeDrafts[0]?.jobId).toBe(draft.job.jobId)
		expect(
			activeDrafts[0] ? isJobWaitingConfirmation(activeDrafts[0]) : true,
		).toBe(false)

		// Finish matching all items without saving to formal playlist yet
		searchVideosMock.mockImplementation(({ keyword }) => {
			const idx = tracks.findIndex((t) => keyword.includes(t.title))
			return okAsync({
				result: [createBilibiliVideo(idx >= 0 ? idx : 0)],
				numPages: 1,
			})
		})

		await externalPlaylistImportWorker.start(draft.job.jobId, {
			requestDelayMs: 5,
		})

		activeDrafts = externalImportJobService.listActiveDraftJobs()
		expect(activeDrafts).toHaveLength(1)
		expect(activeDrafts[0]?.status).toBe('completed')
		expect(activeDrafts[0]?.savedPlaylistId).toBeNull()
		expect(
			activeDrafts[0] ? isJobWaitingConfirmation(activeDrafts[0]) : false,
		).toBe(true)

		// Confirming the draft (saving to formal local playlist #42) removes it from active drafts
		externalImportJobService.markJobConfirmed(draft.job.jobId, 42)
		activeDrafts = externalImportJobService.listActiveDraftJobs()
		expect(activeDrafts).toHaveLength(0)

		const confirmedSnap = externalImportJobService.getJobSnapshot(
			draft.job.jobId,
		)
		expect(confirmedSnap?.job.savedPlaylistId).toBe(42)
		expect(isJobWaitingConfirmation(confirmedSnap!.job)).toBe(false)

		// Creating another draft and deleting it removes both the job and its items
		const draft2 = externalImportJobService.createOrResumeJob({
			source: 'local_json',
			sourcePlaylistId: 'draft_2',
			tracks,
			legacyStorage: mockStateStorage,
		})
		expect(externalImportJobService.listActiveDraftJobs()).toHaveLength(1)
		externalImportJobService.deleteJob(draft2.job.jobId)
		expect(externalImportJobService.listActiveDraftJobs()).toHaveLength(0)
		expect(externalImportJobService.getJobSnapshot(draft2.job.jobId)).toBeNull()
	})

	it('restores local_json playlist data from SQLite Import Job snapshot when memory cache is empty after cold start', async () => {
		const tracks = [createTrack(0), createTrack(1)]
		externalImportJobService.createOrResumeJob({
			source: 'local_json',
			sourcePlaylistId: 'local_json_cold_start',
			playlistMetadata: {
				title: 'JSON 离线草稿歌单',
				description: '从 SQLite 恢复',
				coverUrl: null,
			},
			tracks,
			legacyStorage: mockStateStorage,
		})

		const res = await externalPlaylistService.fetchExternalPlaylist(
			'local_json_cold_start',
			'local_json',
		)
		expect(res.isOk()).toBe(true)
		if (res.isOk()) {
			expect(res.value.playlist.title).toBe('JSON 离线草稿歌单')
			expect(res.value.tracks).toHaveLength(2)
			expect(res.value.tracks[0]?.title).toBe('Song 0')
		}
	})
})

describe('Stage 6: Formal Playlist Post-Save Rematch & Manual Match', () => {
	beforeEach(() => {
		searchVideosMock.mockReset()
		storageMap.clear()
		externalImportJobService.clearAllJobsForTesting()
	})

	it('persists external track mappings for formal playlists and updates single track match in-place without changing original track metadata or order', () => {
		const tracks = [
			createTrack(0, {
				title: 'Original Song A',
				artists: ['Original Artist A'],
			}),
			createTrack(1, {
				title: 'Original Song B',
				artists: ['Original Artist B'],
			}),
			createTrack(2, {
				title: 'Original Song C',
				artists: ['Original Artist C'],
			}),
		]
		const playlistId = 100

		externalImportJobService.upsertTrackMappings([
			{
				trackId: 1001,
				playlistId,
				externalSource: 'netease',
				externalPlaylistId: 'pl_100',
				originalIndex: 0,
				originalTrack: tracks[0],
				matchStatus: 'matched',
				matchedVideo: createBilibiliVideo(0, { bvid: 'BV1MatchedA' }),
			},
			{
				trackId: 1002,
				playlistId,
				externalSource: 'netease',
				externalPlaylistId: 'pl_100',
				originalIndex: 1,
				originalTrack: tracks[1],
				matchStatus: 'unmatched',
				matchedVideo: null,
			},
			{
				trackId: 1003,
				playlistId,
				externalSource: 'netease',
				externalPlaylistId: 'pl_100',
				originalIndex: 2,
				originalTrack: tracks[2],
				matchStatus: 'error',
				matchedVideo: null,
				errorType: 'network',
				errorMessage: 'Network timeout',
			},
		])

		const mappings =
			externalImportJobService.getPlaylistTrackMappings(playlistId)
		expect(mappings).toHaveLength(3)
		expect(mappings.map((m) => m.trackId)).toEqual([1001, 1002, 1003])
		expect(mappings[1]?.matchStatus).toBe('unmatched')
		expect(mappings[1]?.originalTrackTitle).toBe('Original Song B')

		// Manually match track 1002 in-place
		const manualVideo = createBilibiliVideo(1, {
			bvid: 'BV1ManualB',
			title: 'B站手动匹配视频 B',
			author: 'UP主B',
		})
		const updated = externalImportJobService.updateTrackMatchInPlace(1002, {
			track: tracks[1],
			matchedVideo: manualVideo,
			status: 'matched',
		})

		expect(updated?.matchStatus).toBe('matched')
		expect(updated?.matchedBvid).toBe('BV1ManualB')
		// Original track metadata and index must remain untouched!
		expect(updated?.originalTrackTitle).toBe('Original Song B')
		expect(updated?.originalArtists).toEqual(['Original Artist B'])
		expect(updated?.originalIndex).toBe(1)

		// If an already-matched track (1001) encounters a transient error during re-match, its previous matchedBvid is preserved
		const afterFailedRematch = externalImportJobService.updateTrackMatchInPlace(
			1001,
			{
				track: tracks[0],
				matchedVideo: null,
				status: 'error',
				errorType: 'network',
				errorMessage: 'Temporary error',
			},
		)
		expect(afterFailedRematch?.matchedBvid).toBe('BV1MatchedA')
		expect(afterFailedRematch?.matchedVideo?.bvid).toBe('BV1MatchedA')
	})

	it('supports batch rematching unfinished or failed tracks in a formal playlist and circuit-breaks on 412/429 rate-limit', async () => {
		const tracks = [
			createTrack(0),
			createTrack(1),
			createTrack(2),
			createTrack(3),
		]
		const playlistId = 200

		externalImportJobService.upsertTrackMappings([
			{
				trackId: 2001,
				playlistId,
				externalSource: 'qq',
				externalPlaylistId: 'pl_200',
				originalIndex: 0,
				originalTrack: tracks[0],
				matchStatus: 'matched',
				matchedVideo: createBilibiliVideo(0, { bvid: 'BV1Already0' }),
			},
			{
				trackId: 2002,
				playlistId,
				externalSource: 'qq',
				externalPlaylistId: 'pl_200',
				originalIndex: 1,
				originalTrack: tracks[1],
				matchStatus: 'unmatched',
				matchedVideo: null,
			},
			{
				trackId: 2003,
				playlistId,
				externalSource: 'qq',
				externalPlaylistId: 'pl_200',
				originalIndex: 2,
				originalTrack: tracks[2],
				matchStatus: 'error',
				matchedVideo: null,
				errorType: 'network',
				errorMessage: 'Timeout',
			},
			{
				trackId: 2004,
				playlistId,
				externalSource: 'qq',
				externalPlaylistId: 'pl_200',
				originalIndex: 3,
				originalTrack: tracks[3],
				matchStatus: 'rate_limited',
				matchedVideo: null,
				errorType: 'rate_limited',
				errorMessage: '412',
			},
		])

		// 1) mode: 'failed' only retries error (2003) and rate_limited (2004), skipping matched (2001) and unmatched (2002)
		searchVideosMock.mockImplementation(({ keyword }) => {
			if (keyword.includes('Song 3')) {
				return errAsync(
					new BilibiliApiError({
						message: '412 Precondition Failed',
						msgCode: 412,
						type: 'RequestFailed',
					}),
				)
			}
			return okAsync({
				result: [createBilibiliVideo(2, { bvid: 'BV1Retried2' })],
				numPages: 1,
			})
		})

		const failedRun = await externalPlaylistImportWorker.rematchPlaylistTracks(
			playlistId,
			{
				mode: 'failed',
				requestDelayMs: 5,
			},
		)

		expect(failedRun.total).toBe(2)
		expect(failedRun.processed).toBe(1)
		expect(failedRun.matched).toBe(1)
		expect(failedRun.rateLimited).toBe(1)
		expect(failedRun.status).toBe('rate_limited')
		expect(externalImportJobService.getTrackMapping(2003)?.matchStatus).toBe(
			'matched',
		)
		expect(externalImportJobService.getTrackMapping(2003)?.matchedBvid).toBe(
			'BV1Retried2',
		)
		expect(externalImportJobService.getTrackMapping(2004)?.matchStatus).toBe(
			'rate_limited',
		)

		// 2) mode: 'unfinished' processes remaining unmatched (2002) and rate_limited (2004)
		searchVideosMock.mockReset()
		searchVideosMock.mockImplementation(({ keyword }) => {
			const idx = tracks.findIndex((t) => keyword.includes(t.title))
			return okAsync({
				result: [
					createBilibiliVideo(idx >= 0 ? idx : 1, {
						bvid: `BV1Fixed${idx}`,
					}),
				],
				numPages: 1,
			})
		})

		const unfinishedRun =
			await externalPlaylistImportWorker.rematchPlaylistTracks(playlistId, {
				mode: 'unfinished',
				requestDelayMs: 5,
			})

		expect(unfinishedRun.total).toBe(2)
		expect(unfinishedRun.matched).toBe(2)
		expect(unfinishedRun.status).toBe('completed')

		const finalMappings =
			externalImportJobService.getPlaylistTrackMappings(playlistId)
		expect(finalMappings.every((m) => m.matchStatus === 'matched')).toBe(true)
	})

	it('toggles Original vs Bilibili view mode per playlist and transforms list/playback track metadata accordingly', () => {
		const playlistA = 701
		const playlistB = 702

		expect(externalImportJobService.getPlaylistViewMode(playlistA)).toBe(
			'original',
		)
		expect(externalImportJobService.getPlaylistViewMode(playlistB)).toBe(
			'original',
		)

		const origTrack = createTrack(0, {
			title: '晴天',
			artists: ['周杰伦'],
			duration: 269000,
			coverUrl: 'https://orig.example.com/qingtian.jpg',
		})
		const matchedVideo = createBilibiliVideo(0, {
			bvid: 'BV1QingtianBili',
			title: '<em class="keyword">晴天</em> - 周杰伦【4K Hi-Res】',
			author: '周杰伦音乐台',
			mid: 998877,
			pic: '//i0.hdslb.com/bfs/archive/bili_qingtian.jpg',
			duration: '04:35',
		})

		const mapping = externalImportJobService.upsertTrackMapping({
			trackId: 3001,
			playlistId: playlistA,
			externalSource: 'qq',
			externalPlaylistId: 'qq_701',
			originalIndex: 0,
			originalTrack: origTrack,
			matchStatus: 'matched',
			matchedVideo,
		})

		const internalTrack = {
			id: 3001,
			uniqueKey: `external::${playlistA}::0::fp_qingtian`,
			title: '晴天',
			artist: {
				id: 11,
				name: '周杰伦',
				remoteId: null,
				source: 'bilibili' as const,
				createdAt: new Date(1700000000000),
				updatedAt: new Date(1700000000000),
			},
			coverUrl: 'https://orig.example.com/qingtian.jpg',
			duration: 269,
			createdAt: new Date(1700000000000),
			updatedAt: new Date(1700000000000),
			source: 'bilibili' as const,
			playHistory: [],
			bilibiliMetadata: {
				bvid: 'BV1QingtianBili',
				cid: null,
				isMultiPage: false,
				videoIsValid: true,
				mainTrackTitle: '音源: 晴天 - 周杰伦【4K Hi-Res】 · UP: 周杰伦音乐台',
			},
		}

		expect(parseExternalPlaylistIdFromUniqueKey(internalTrack.uniqueKey)).toBe(
			playlistA,
		)

		// Default Original Mode: preserves original song title, artist, cover, and mainTrackTitle
		const resolvedInOriginal =
			externalImportJobService.resolveTrackForPlayback(internalTrack)
		expect(resolvedInOriginal.title).toBe('晴天')
		expect(resolvedInOriginal.artist?.name).toBe('周杰伦')
		expect(resolvedInOriginal.coverUrl).toBe(
			'https://orig.example.com/qingtian.jpg',
		)
		expect(resolvedInOriginal.source).toBe('bilibili')
		if (resolvedInOriginal.source === 'bilibili') {
			expect(resolvedInOriginal.bilibiliMetadata.mainTrackTitle).toContain(
				'音源:',
			)
		}

		// Toggle playlistA to Bilibili Mode -> playlistB remains in Original Mode
		const modeAfterToggle =
			externalImportJobService.togglePlaylistViewMode(playlistA)
		expect(modeAfterToggle).toBe('bilibili')
		expect(externalImportJobService.getPlaylistViewMode(playlistA)).toBe(
			'bilibili',
		)
		expect(externalImportJobService.getPlaylistViewMode(playlistB)).toBe(
			'original',
		)

		// In Bilibili Mode: switches to Bilibili video title, UP主, Bilibili cover, Bilibili duration, and clears mainTrackTitle
		const resolvedInBili =
			externalImportJobService.resolveTrackForPlayback(internalTrack)
		expect(resolvedInBili.title).toBe('晴天 - 周杰伦【4K Hi-Res】')
		expect(resolvedInBili.artist?.name).toBe('周杰伦音乐台')
		expect(resolvedInBili.artist?.remoteId).toBe('998877')
		expect(resolvedInBili.coverUrl).toBe(
			'https://i0.hdslb.com/bfs/archive/bili_qingtian.jpg',
		)
		expect(resolvedInBili.duration).toBe(275) // 04:35 = 275s
		expect(resolvedInBili.source).toBe('bilibili')
		if (resolvedInBili.source === 'bilibili') {
			expect(resolvedInBili.bilibiliMetadata.mainTrackTitle).toBeNull()
		}

		// Unmatched track in Bilibili Mode stays untouched so user can still see and match it
		const unmatchedTrack = {
			...internalTrack,
			id: 3002,
			uniqueKey: `external::${playlistA}::1::fp_unmatched`,
			bilibiliMetadata: {
				...internalTrack.bilibiliMetadata,
				bvid: '',
				mainTrackTitle: '[未匹配音源] 点击手动匹配',
			},
		}
		const resolvedUnmatched = applyPlaylistViewModeToTrack(
			unmatchedTrack,
			'bilibili',
			null,
		)
		expect(resolvedUnmatched.title).toBe('晴天')
		expect(resolvedUnmatched.source).toBe('bilibili')
		if (resolvedUnmatched.source === 'bilibili') {
			expect(resolvedUnmatched.bilibiliMetadata.bvid).toBe('')
		}

		// Toggle playlistA back to Original Mode -> restores original metadata
		const modeBackToOriginal =
			externalImportJobService.togglePlaylistViewMode(playlistA)
		expect(modeBackToOriginal).toBe('original')
		const restored = applyPlaylistViewModeToTrack(
			internalTrack,
			modeBackToOriginal,
			mapping,
		)
		expect(restored.title).toBe('晴天')
		expect(restored.artist?.name).toBe('周杰伦')
		expect(restored.coverUrl).toBe('https://orig.example.com/qingtian.jpg')
	})

	it('cleans up associated import jobs, items and cache when deleting a local playlist, so re-importing starts fresh', () => {
		const source = 'netease'
		const sourcePlaylistId = 'del_and_reimport_test'
		const tracks = [createTrack(0), createTrack(1)]
		const playlistId = 9999

		// 1. Initial import and match
		const snapshot1 = externalImportJobService.createOrResumeJob({
			source,
			sourcePlaylistId,
			tracks,
			legacyStorage: mockStateStorage,
		})
		expect(snapshot1.job.status).toBe('pending')

		// Match track 0
		externalImportJobService.updateItemResult(snapshot1.job.jobId, 0, {
			track: tracks[0],
			matchedVideo: createBilibiliVideo(0, { bvid: 'BV1OldDeleted' }),
			status: 'matched',
		})

		// Confirm and save to local playlist 9999
		externalImportJobService.markJobConfirmed(snapshot1.job.jobId, playlistId)
		externalImportJobService.upsertTrackMapping({
			trackId: 10001,
			playlistId,
			externalSource: source,
			externalPlaylistId: sourcePlaylistId,
			originalTrack: tracks[0],
			matchStatus: 'matched',
			matchedVideo: createBilibiliVideo(0, { bvid: 'BV1OldDeleted' }),
		})

		// Verify job is marked confirmed with saved_playlist_id
		const confirmedSnapshot = externalImportJobService.getJobSnapshot(
			snapshot1.job.jobId,
		)
		expect(confirmedSnapshot?.job.savedPlaylistId).toBe(playlistId)
		expect(
			externalImportJobService.getPlaylistTrackMappings(playlistId),
		).toHaveLength(1)

		// 2. User deletes playlist 9999
		externalImportJobService.deleteJobsForPlaylist(playlistId, mockStateStorage)

		// Verify job, items, and mappings are completely gone
		expect(
			externalImportJobService.getJobSnapshot(snapshot1.job.jobId),
		).toBeNull()
		expect(
			externalImportJobService.getPlaylistTrackMappings(playlistId),
		).toHaveLength(0)

		// 3. User re-imports the same playlist
		const snapshot2 = externalImportJobService.createOrResumeJob({
			source,
			sourcePlaylistId,
			tracks,
			legacyStorage: mockStateStorage,
		})

		// MUST be clean and fresh with 0 old matched data and savedPlaylistId = null
		expect(snapshot2.job.savedPlaylistId).toBeNull()
		expect(snapshot2.job.status).toBe('pending')
		expect(snapshot2.job.matchedCount).toBe(0)
		expect(snapshot2.items[0]?.status).toBe('pending')
		expect(snapshot2.items[0]?.matchedVideo).toBeNull()
	})
})

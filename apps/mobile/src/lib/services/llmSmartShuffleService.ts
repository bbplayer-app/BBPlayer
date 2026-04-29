import { inArray, sql } from 'drizzle-orm'
import {
	err,
	errAsync,
	ok,
	okAsync,
	ResultAsync,
	type Result,
} from 'neverthrow'

import useAppStore from '@/hooks/stores/useAppStore'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { llmCredentialService } from '@/lib/services/llmCredentialService'
import {
	LLM_PREFERENCE_SYSTEM_PROMPT,
	LLM_QUEUE_SORT_SYSTEM_PROMPT,
	LLM_TAG_INDEX_SYSTEM_PROMPT,
	buildPreferencePrompt,
	buildSmartQueueSortPrompt,
	buildTrackTagIndexPrompt,
} from '@/lib/services/llmSmartShufflePrompts'
import type { TrackSortPromptItem } from '@/lib/services/llmSmartShufflePrompts'
import { playlistService } from '@/lib/services/playlistService'
import type { Playlist, Track } from '@/types/core/media'
import type {
	SmartQueueOptions,
	SmartShufflePreference,
	TrackIndexContext,
	TrackLlmTags,
	TrackTagIndex,
} from '@/types/services/llmSmartShuffle'
import log from '@/utils/log'

const logger = log.extend('Service.LlmSmartShuffle')

const MAX_LLM_SORT_TRACKS_PER_PAYLOAD = 200
const MAX_LLM_SORT_PAYLOAD_BYTES = 200 * 1024
const DEFAULT_LLM_REQUEST_TIMEOUT_MS = 30_000

const EMPTY_TAGS: TrackLlmTags = {
	language: [],
	vocalType: [],
	genre: [],
	mood: [],
	scene: [],
	timePreference: [],
}

function createEmptyTags(): TrackLlmTags {
	return {
		language: [],
		vocalType: [],
		genre: [],
		mood: [],
		scene: [],
		timePreference: [],
	}
}

const DEFAULT_PREFERENCE: SmartShufflePreference = {
	preferredTags: [],
	downrankTags: [],
	timeBias: 'balanced',
	explorationLevel: 'balanced',
	repeatAvoidance: true,
	temporary: false,
}

interface OpenAIChatCompletionResponse {
	choices?: {
		message?: {
			content?: string
		}
	}[]
}

interface TrackLlmTagRow {
	trackId: number
	tags: TrackLlmTags
	confidence: number
	reason: string | null
}

function normalizeBaseUrl(baseUrl: string) {
	return baseUrl.trim().replace(/\/+$/, '')
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.trim())
		.filter(Boolean)
}

function normalizeTags(value: unknown): TrackLlmTags {
	if (!value || typeof value !== 'object') return createEmptyTags()
	const tags = value as Partial<Record<keyof TrackLlmTags, unknown>>
	return {
		language: asStringArray(tags.language),
		vocalType: asStringArray(tags.vocalType),
		genre: asStringArray(tags.genre),
		mood: asStringArray(tags.mood),
		scene: asStringArray(tags.scene),
		timePreference: asStringArray(tags.timePreference),
	}
}

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error))
}

function getLlmRequestTimeoutMs() {
	const configuredTimeout = Number(
		process.env.EXPO_PUBLIC_LLM_REQUEST_TIMEOUT_MS,
	)
	return Number.isFinite(configuredTimeout) && configuredTimeout > 0
		? configuredTimeout
		: DEFAULT_LLM_REQUEST_TIMEOUT_MS
}

function toLlmRequestError(error: unknown, timeoutMs: number): Error {
	const requestError = toError(error)
	if (requestError.name === 'AbortError') {
		return new Error(`LLM API 请求超时：${timeoutMs}ms`)
	}
	return requestError
}

function parseJsonObject<T>(content: string): Result<T, Error> {
	try {
		return ok(JSON.parse(content) as T)
	} catch {
		const match = content.match(/\{[\s\S]*\}/)
		if (!match) return err(new Error('LLM 没有返回 JSON 对象'))

		try {
			return ok(JSON.parse(match[0]) as T)
		} catch (fallbackError) {
			return err(
				new Error(
					`LLM 返回的 JSON 对象无效：${toError(fallbackError).message}`,
				),
			)
		}
	}
}

function allTags(tags: TrackLlmTags) {
	return [
		...tags.language,
		...tags.vocalType,
		...tags.genre,
		...tags.mood,
		...tags.scene,
		...tags.timePreference,
	].map((tag) => tag.toLowerCase())
}

type TrackLlmTagCategory = keyof TrackLlmTags

interface LocalTitleTagRule {
	category: TrackLlmTagCategory
	tag: string
	pattern: RegExp
}

const LOCAL_TITLE_TAG_RULES: LocalTitleTagRule[] = [
	{
		category: 'language',
		tag: '中文',
		pattern:
			/中文|国语|华语|普通话|中配|洛天依|乐正绫|言和|星尘|心华|诗岸|海伊|苍穹|赤羽|墨清弦|徵羽摩柯|乐正龙牙|五维介质|ace虚拟歌姬/i,
	},
	{
		category: 'language',
		tag: '日文',
		pattern:
			/日语|日文|日本語|j-?pop|anime|アニメ|初音|镜音|鏡音|巡音|重音|miku|rin|len|luka|teto|gumi|kafu|可不/i,
	},
	{
		category: 'language',
		tag: '英文',
		pattern: /英文|英语|欧美|\b(english|eng|en|us|uk)\b/i,
	},
	{
		category: 'vocalType',
		tag: '中V',
		pattern:
			/中v|中文vocaloid|洛天依|乐正绫|言和|星尘|心华|诗岸|海伊|苍穹|赤羽|墨清弦|徵羽摩柯|乐正龙牙|五维介质|ace虚拟歌姬/i,
	},
	{
		category: 'vocalType',
		tag: '日V',
		pattern:
			/日v|初音|镜音|鏡音|巡音|重音|miku|rin|len|luka|teto|gumi|kafu|可不|flower|ia\b/i,
	},
	{
		category: 'vocalType',
		tag: 'Vocaloid',
		pattern:
			/vocaloid|术力口|ボカロ|初音|镜音|鏡音|巡音|重音|miku|rin|len|luka|teto|gumi|kafu|可不|flower|ia\b/i,
	},
	{
		category: 'vocalType',
		tag: '翻唱',
		pattern: /翻唱|cover|歌ってみた|试唱|remake/i,
	},
	{
		category: 'vocalType',
		tag: '合唱',
		pattern: /合唱|对唱|chorus|duet|feat\.?|ft\./i,
	},
	{
		category: 'vocalType',
		tag: '纯音乐',
		pattern: /纯音乐|instrumental|伴奏|off vocal|karaoke|\bbgm\b/i,
	},
	{ category: 'genre', tag: '古风', pattern: /古风|古韵|戏腔/i },
	{
		category: 'genre',
		tag: '国风',
		pattern: /国风|中国风|民乐|笛子|古筝|二胡/i,
	},
	{
		category: 'genre',
		tag: '电子',
		pattern:
			/电音|电子|edm|future bass|dubstep|synthwave|trance|house|techno|hardstyle/i,
	},
	{
		category: 'genre',
		tag: '摇滚',
		pattern: /摇滚|rock|punk|alternative|后摇|post-?rock/i,
	},
	{ category: 'genre', tag: '金属', pattern: /金属|metal|metalcore/i },
	{
		category: 'genre',
		tag: '流行',
		pattern: /流行|pop|j-?pop|k-?pop|city pop/i,
	},
	{ category: 'genre', tag: '说唱', pattern: /说唱|rap|hip-?hop|trap/i },
	{ category: 'genre', tag: '爵士', pattern: /爵士|jazz|swing|blues/i },
	{ category: 'genre', tag: '民谣', pattern: /民谣|folk|acoustic|吉他弹唱/i },
	{ category: 'genre', tag: '钢琴', pattern: /钢琴|piano/i },
	{ category: 'genre', tag: '交响', pattern: /交响|管弦|orchestra|symphony/i },
	{ category: 'genre', tag: 'Lo-fi', pattern: /lo-?fi|chillhop/i },
	{
		category: 'genre',
		tag: 'ACG',
		pattern: /acg|anime|アニメ|二次元|番剧|op\b|ed\b/i,
	},
	{
		category: 'genre',
		tag: '游戏音乐',
		pattern: /游戏|game|ost|原声|soundtrack/i,
	},
	{
		category: 'mood',
		tag: '治愈',
		pattern: /治愈|疗愈|healing|放松|舒缓|安心/i,
	},
	{ category: 'mood', tag: '温柔', pattern: /温柔|柔和|轻柔|soft|gentle/i },
	{ category: 'mood', tag: '安静', pattern: /安静|静谧|宁静|quiet|calm/i },
	{ category: 'mood', tag: '燃', pattern: /燃|热血|高燃|战斗|battle|激昂/i },
	{
		category: 'mood',
		tag: '高能',
		pattern: /高能|炸裂|爆裂|狂气|hardcore|high energy/i,
	},
	{ category: 'mood', tag: '悲伤', pattern: /悲伤|伤感|失恋|泪|sad|cry/i },
	{ category: 'mood', tag: '致郁', pattern: /致郁|压抑|抑郁|黑暗|dark/i },
	{ category: 'mood', tag: '甜', pattern: /甜|甜蜜|恋爱|love|可爱|萌/i },
	{
		category: 'mood',
		tag: '梦幻',
		pattern: /梦幻|空灵|幻想|fantasy|ethereal/i,
	},
	{ category: 'mood', tag: '怀旧', pattern: /怀旧|复古|retro|nostalgic/i },
	{ category: 'mood', tag: '史诗', pattern: /史诗|epic|恢弘|宏大/i },
	{
		category: 'scene',
		tag: '夜晚',
		pattern: /夜|夜晚|深夜|午夜|晚安|moon|night/i,
	},
	{ category: 'scene', tag: '睡前', pattern: /睡前|助眠|催眠|入眠|sleep|眠/i },
	{ category: 'scene', tag: '学习', pattern: /学习|自习|专注|study|focus/i },
	{
		category: 'scene',
		tag: '工作',
		pattern: /工作|办公|效率|work|coding|编程/i,
	},
	{ category: 'scene', tag: '通勤', pattern: /通勤|地铁|公交|路上|commute/i },
	{
		category: 'scene',
		tag: '运动',
		pattern: /运动|健身|跑步|workout|running/i,
	},
	{ category: 'scene', tag: '驾驶', pattern: /驾驶|开车|车载|drive|driving/i },
	{ category: 'scene', tag: '雨天', pattern: /雨|雨天|rain/i },
	{ category: 'scene', tag: '派对', pattern: /派对|party|club|蹦迪/i },
	{
		category: 'timePreference',
		tag: '经典老歌',
		pattern: /经典|老歌|回忆|怀旧|80s|90s|00s|昭和|平成/i,
	},
	{
		category: 'timePreference',
		tag: '新歌',
		pattern: /新歌|新曲|新作|202[3-9]|20[3-9]\d/i,
	},
]

function addLocalTag(
	tags: TrackLlmTags,
	category: TrackLlmTagCategory,
	tag: string,
) {
	const values = tags[category]
	if (!values.includes(tag)) values.push(tag)
}

function getLocalTitleTags(track: Track): TrackLlmTags {
	const text = `${track.title} ${track.artist?.name ?? ''}`.toLowerCase()
	const tags = createEmptyTags()

	for (const rule of LOCAL_TITLE_TAG_RULES) {
		if (rule.pattern.test(text)) {
			addLocalTag(tags, rule.category, rule.tag)
		}
	}

	return tags
}

function parsePreferenceLocally(prompt: string): SmartShufflePreference {
	const value = prompt.toLowerCase()
	const preferredTags: string[] = []
	const downrankTags: string[] = []

	if (/中v|中文v|洛天依|乐正绫|言和/.test(value)) preferredTags.push('中V')
	if (/vocaloid|术力口|初音|miku/.test(value)) preferredTags.push('Vocaloid')
	if (/最近|新收藏|刚收藏|新加/.test(value)) preferredTags.push('最近新增')
	if (/老歌|老收藏|回顾/.test(value)) preferredTags.push('老收藏')
	if (/燃|热血|快/.test(value)) preferredTags.push('燃')
	if (/治愈|安静|放松|睡/.test(value)) preferredTags.push('治愈')
	if (/学习|工作/.test(value)) preferredTags.push('工作')
	if (/别太吵|少听吵|不吵/.test(value)) downrankTags.push('吵闹', '燃')
	if (/少重复|别重复|不重复/.test(value)) {
		return { ...DEFAULT_PREFERENCE, preferredTags, downrankTags }
	}

	return {
		...DEFAULT_PREFERENCE,
		preferredTags,
		downrankTags,
		timeBias: /最近|新收藏|刚收藏|新加/.test(value)
			? 'recent'
			: /老歌|老收藏|回顾/.test(value)
				? 'old'
				: 'balanced',
		explorationLevel: /冷门|探索|随机一点/.test(value)
			? 'exploratory'
			: 'balanced',
	}
}

function stableShuffle<T>(items: T[]) {
	const array = [...items]
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const temp = array[i]
		array[i] = array[j]
		array[j] = temp
	}
	return array
}

function asNumberArray(value: unknown): number[] {
	if (!Array.isArray(value)) return []
	return value
		.map((item) => Number(item))
		.filter((item) => Number.isInteger(item))
}

function extractOrderedTrackIds(response: {
	orderedTrackIds?: unknown
	trackIds?: unknown
	tracks?: unknown
}) {
	const direct = asNumberArray(response.orderedTrackIds)
	if (direct.length > 0) return direct

	const trackIds = asNumberArray(response.trackIds)
	if (trackIds.length > 0) return trackIds

	if (!Array.isArray(response.tracks)) return []
	return response.tracks
		.map((item) => {
			if (typeof item === 'number' || typeof item === 'string')
				return Number(item)
			if (!item || typeof item !== 'object') return NaN
			return Number((item as Record<string, unknown>).trackId)
		})
		.filter((item) => Number.isInteger(item))
}

function getTrackTags(
	track: Track,
	tagsByTrackId: Map<number, TrackLlmTagRow>,
) {
	return tagsByTrackId.get(track.id)?.tags ?? getLocalTitleTags(track)
}

function utf8ByteLength(value: string) {
	let length = 0
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i)
		if (code < 0x80) {
			length += 1
		} else if (code < 0x800) {
			length += 2
		} else if (code >= 0xd800 && code <= 0xdbff) {
			length += 4
			i += 1
		} else {
			length += 3
		}
	}
	return length
}

export class LlmSmartShuffleService {
	private isConfigured() {
		const settings = useAppStore.getState().settings
		return (
			settings.enableLlmTagging &&
			settings.allowLlmMetadataUpload &&
			settings.llmBaseUrl.trim().length > 0 &&
			settings.llmModel.trim().length > 0
		)
	}

	private callJson<T>(system: string, user: string): ResultAsync<T, Error> {
		const settings = useAppStore.getState().settings
		const url = `${normalizeBaseUrl(settings.llmBaseUrl)}/chat/completions`
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}
		const timeoutMs = getLlmRequestTimeoutMs()

		return ResultAsync.fromPromise(
			(async () => {
				await llmCredentialService.migrateFromPlainSettings()
				const apiKey = await llmCredentialService.getApiKey()
				if (apiKey) {
					headers.Authorization = `Bearer ${apiKey}`
				}

				const controller = new AbortController()
				const timeout = setTimeout(() => controller.abort(), timeoutMs)
				try {
					return await fetch(url, {
						method: 'POST',
						headers,
						signal: controller.signal,
						body: JSON.stringify({
							model: settings.llmModel.trim(),
							temperature: 0.1,
							response_format: { type: 'json_object' },
							messages: [
								{ role: 'system', content: system },
								{ role: 'user', content: user },
							],
						}),
					})
				} finally {
					clearTimeout(timeout)
				}
			})(),
			(error) => toLlmRequestError(error, timeoutMs),
		)
			.andThen((response) => {
				if (!response.ok) {
					return errAsync(new Error(`LLM API 请求失败：${response.status}`))
				}
				return ResultAsync.fromPromise(
					response.json() as Promise<OpenAIChatCompletionResponse>,
					toError,
				)
			})
			.andThen((data) => {
				const content = data.choices?.[0]?.message?.content
				if (!content) {
					return errAsync(new Error('LLM API 没有返回内容'))
				}
				const parsed = parseJsonObject<T>(content)
				return parsed.isOk() ? okAsync(parsed.value) : errAsync(parsed.error)
			})
	}

	indexTracks(contexts: TrackIndexContext[]): ResultAsync<void, Error> {
		if (!this.isConfigured() || contexts.length === 0) return okAsync(undefined)

		let result = okAsync<void, Error>(undefined)
		for (let i = 0; i < contexts.length; i += 25) {
			const batch = contexts.slice(i, i + 25)
			result = result.andThen(() => this.indexTrackBatch(batch))
		}
		return result
	}

	private indexTrackBatch(
		contexts: TrackIndexContext[],
	): ResultAsync<void, Error> {
		const settings = useAppStore.getState().settings

		return this.callJson<{ tracks?: unknown[] }>(
			LLM_TAG_INDEX_SYSTEM_PROMPT,
			buildTrackTagIndexPrompt(contexts, EMPTY_TAGS),
		)
			.map((response) =>
				(response.tracks ?? [])
					.map((item) => {
						if (!item || typeof item !== 'object') return null
						const row = item as Record<string, unknown>
						const trackId = Number(row.trackId)
						if (!Number.isFinite(trackId)) return null
						const index: TrackTagIndex = {
							trackId,
							tags: normalizeTags(row.tags),
							confidence:
								typeof row.confidence === 'number'
									? Math.max(0, Math.min(1, row.confidence))
									: 0,
						}
						if (typeof row.reason === 'string') index.reason = row.reason
						return index
					})
					.filter((item): item is TrackTagIndex => item !== null),
			)
			.andThen((indexes) => {
				if (indexes.length === 0) return okAsync(undefined)

				const contextById = new Map(
					contexts.map((item) => [item.track.id, item]),
				)
				const values = indexes.flatMap((index) => {
					const context = contextById.get(index.trackId)
					if (!context) return []

					return {
						trackId: context.track.id,
						tags: index.tags,
						confidence: index.confidence,
						reason: index.reason,
						model: settings.llmModel.trim(),
						sourceType: context.sourceType,
						sourceId: context.sourceId,
						sourceSyncedAt: context.sourceSyncedAt,
						indexedAt: new Date(),
					}
				})
				if (values.length === 0) return okAsync(undefined)

				return ResultAsync.fromPromise(
					db
						.insert(schema.trackLlmTags)
						.values(values)
						.onConflictDoUpdate({
							target: schema.trackLlmTags.trackId,
							set: {
								tags: sql`excluded.tags`,
								confidence: sql`excluded.confidence`,
								reason: sql`excluded.reason`,
								model: sql`excluded.model`,
								sourceType: sql`excluded.source_type`,
								sourceId: sql`excluded.source_id`,
								sourceSyncedAt: sql`excluded.source_synced_at`,
								indexedAt: new Date(),
							},
						}),
					toError,
				).map(() => undefined)
			})
	}

	indexPlaylistTracks(
		playlistId: number,
		options?: {
			sourceType?: Playlist['type']
			sourceId?: string
			sourceSyncedAt?: Date
		},
	): ResultAsync<void, Error> {
		return ResultAsync.fromPromise(
			playlistService.getPlaylistTracks(playlistId),
			toError,
		)
			.andThen((tracksResult) => {
				if (tracksResult.isErr()) {
					return errAsync(toError(tracksResult.error))
				}
				return this.indexTracks(
					tracksResult.value.map((track) => ({
						track,
						sourceType: options?.sourceType,
						sourceId: options?.sourceId,
						sourceSyncedAt: options?.sourceSyncedAt,
					})),
				)
			})
			.mapErr((error) => {
				logger.warning('LLM 标签索引失败', { error })
				return error
			})
	}

	parsePreference(prompt: string): ResultAsync<SmartShufflePreference, Error> {
		const trimmed = prompt.trim()
		if (!trimmed || !this.isConfigured()) {
			return okAsync(parsePreferenceLocally(trimmed))
		}

		return this.callJson<Partial<SmartShufflePreference>>(
			LLM_PREFERENCE_SYSTEM_PROMPT,
			buildPreferencePrompt(trimmed, DEFAULT_PREFERENCE),
		)
			.map((response) => ({
				preferredTags: asStringArray(response.preferredTags),
				downrankTags: asStringArray(response.downrankTags),
				timeBias:
					response.timeBias === 'recent' ||
					response.timeBias === 'old' ||
					response.timeBias === 'balanced'
						? response.timeBias
						: 'balanced',
				explorationLevel:
					response.explorationLevel === 'conservative' ||
					response.explorationLevel === 'balanced' ||
					response.explorationLevel === 'exploratory'
						? response.explorationLevel
						: 'balanced',
				repeatAvoidance: response.repeatAvoidance ?? true,
				temporary: response.temporary ?? true,
			}))
			.orElse((error) => {
				logger.warning('LLM 解析偏好失败，使用本地关键词规则', { error })
				return okAsync(parsePreferenceLocally(trimmed))
			})
	}

	createSmartQueue(
		tracks: Track[],
		options?: SmartQueueOptions,
	): ResultAsync<Track[], Error> {
		if (tracks.length <= 1) return okAsync(tracks)

		const prompt =
			options?.prompt?.trim() || options?.defaultPreference?.trim() || ''
		return this.parsePreference(prompt).andThen((preference) =>
			ResultAsync.fromPromise(
				db.query.trackLlmTags.findMany({
					where: inArray(
						schema.trackLlmTags.trackId,
						tracks.map((track) => track.id),
					),
				}),
				toError,
			).andThen((tagRows) => {
				const tagsByTrackId = new Map<number, TrackLlmTagRow>(
					tagRows.map((row) => [row.trackId, row]),
				)
				return this.createLlmSortedQueue(
					tracks,
					prompt,
					preference,
					tagsByTrackId,
				).map(
					(llmSortedQueue) =>
						llmSortedQueue ??
						this.createLocalScoredQueue(tracks, preference, tagsByTrackId),
				)
			}),
		)
	}

	private createLlmSortedQueue(
		tracks: Track[],
		prompt: string,
		preference: SmartShufflePreference,
		tagsByTrackId: Map<number, TrackLlmTagRow>,
	): ResultAsync<Track[] | null, Error> {
		if (!this.isConfigured()) return okAsync(null)

		const fallbackOrder = this.createLocalScoredQueue(
			tracks,
			preference,
			tagsByTrackId,
		)
		const items = tracks.map((track) =>
			this.createSortPromptItem(track, tagsByTrackId),
		)
		const chunks = this.createSortPayloadChunks(prompt, preference, items)
		return ResultAsync.fromPromise(
			Promise.all(
				chunks.map(async (chunk, index) => {
					const chunkOrderResult = await this.callJson<{
						orderedTrackIds?: unknown
						trackIds?: unknown
						tracks?: unknown
					}>(
						LLM_QUEUE_SORT_SYSTEM_PROMPT,
						buildSmartQueueSortPrompt({
							userPreference: prompt,
							preference,
							items: chunk,
							chunkIndex: index + 1,
							chunkCount: chunks.length,
						}),
					).map((response) => {
						const chunkTrackIds = new Set(chunk.map((item) => item.track.id))
						const chunkFallback = fallbackOrder.filter((track) =>
							chunkTrackIds.has(track.id),
						)
						return this.mergeLlmOrderWithFallback(
							chunk.map((item) => item.track),
							extractOrderedTrackIds(response),
							chunkFallback,
						)
					})
					if (chunkOrderResult.isErr()) {
						logger.warning('LLM 排序分片失败', {
							error: chunkOrderResult.error,
							chunkIndex: index + 1,
						})
						return err(chunkOrderResult.error)
					}
					return ok(chunkOrderResult.value)
				}),
			),
			toError,
		).andThen((chunkOrderResults) => {
			const failedChunk = chunkOrderResults.find((result) => result.isErr())
			if (failedChunk?.isErr()) {
				logger.warning('LLM 直接排序失败，使用本地标签打分', {
					error: failedChunk.error,
				})
				return okAsync(null)
			}
			const chunkOrders: (Track[] | null)[] = []
			for (const result of chunkOrderResults) {
				if (result.isErr()) return okAsync(null)
				chunkOrders.push(result.value)
			}
			if (chunkOrders.some((chunk) => chunk === null)) return okAsync(null)

			const orderedTrackIds =
				chunkOrders.length === 1
					? (chunkOrders[0]?.map((track) => track.id) ?? [])
					: this.mergeChunkOrders(
							chunkOrders.filter((chunk): chunk is Track[] => chunk !== null),
							fallbackOrder,
						).map((track) => track.id)

			return okAsync(
				this.mergeLlmOrderWithFallback(tracks, orderedTrackIds, fallbackOrder),
			)
		})
	}

	private createSortPromptItem(
		track: Track,
		tagsByTrackId: Map<number, TrackLlmTagRow>,
	): TrackSortPromptItem {
		const row = tagsByTrackId.get(track.id)
		return {
			track,
			tags: getTrackTags(track, tagsByTrackId),
			confidence: row?.confidence,
			reason: row?.reason,
		}
	}

	private createSortPayloadChunks(
		prompt: string,
		preference: SmartShufflePreference,
		items: TrackSortPromptItem[],
	) {
		const chunks: TrackSortPromptItem[][] = []
		let current: TrackSortPromptItem[] = []

		for (const item of items) {
			const candidate = [...current, item]
			const payloadBytes = utf8ByteLength(
				buildSmartQueueSortPrompt({
					userPreference: prompt,
					preference,
					items: candidate,
				}),
			)
			const shouldSplit =
				candidate.length > MAX_LLM_SORT_TRACKS_PER_PAYLOAD ||
				payloadBytes > MAX_LLM_SORT_PAYLOAD_BYTES

			if (shouldSplit && current.length > 0) {
				chunks.push(current)
				current = [item]
				continue
			}

			current = candidate
		}

		if (current.length > 0) chunks.push(current)
		if (chunks.length > 1) {
			logger.info('LLM 排序 payload 已按上下文限制分片', {
				chunkCount: chunks.length,
				totalTracks: items.length,
			})
		}
		return chunks
	}

	private mergeChunkOrders(chunkOrders: Track[][], fallbackOrder: Track[]) {
		const fallbackRank = new Map(
			fallbackOrder.map((track, index) => [track.id, index]),
		)
		const queues = [...chunkOrders].sort((left, right) => {
			const leftRank =
				fallbackRank.get(left[0]?.id ?? -1) ?? Number.MAX_SAFE_INTEGER
			const rightRank =
				fallbackRank.get(right[0]?.id ?? -1) ?? Number.MAX_SAFE_INTEGER
			return leftRank - rightRank
		})
		const merged: Track[] = []
		let hasRemaining = true

		while (hasRemaining) {
			hasRemaining = false
			queues.sort((left, right) => {
				const leftRank =
					fallbackRank.get(left[0]?.id ?? -1) ?? Number.MAX_SAFE_INTEGER
				const rightRank =
					fallbackRank.get(right[0]?.id ?? -1) ?? Number.MAX_SAFE_INTEGER
				return leftRank - rightRank
			})

			for (const queue of queues) {
				const next = queue.shift()
				if (!next) continue
				merged.push(next)
				hasRemaining = true
			}
		}

		return merged
	}

	private mergeLlmOrderWithFallback(
		tracks: Track[],
		orderedTrackIds: number[],
		fallbackOrder: Track[],
	) {
		if (orderedTrackIds.length === 0) {
			return fallbackOrder.length > 0 ? fallbackOrder : null
		}

		const tracksById = new Map(tracks.map((track) => [track.id, track]))
		const seen = new Set<number>()
		const sorted: Track[] = []

		for (const trackId of orderedTrackIds) {
			const track = tracksById.get(trackId)
			if (!track || seen.has(trackId)) continue
			seen.add(trackId)
			sorted.push(track)
		}

		for (const track of fallbackOrder) {
			if (seen.has(track.id)) continue
			seen.add(track.id)
			sorted.push(track)
		}

		return sorted.length > 0 ? sorted : null
	}

	private createLocalScoredQueue(
		tracks: Track[],
		preference: SmartShufflePreference,
		tagsByTrackId: Map<number, TrackLlmTagRow>,
	): Track[] {
		const now = Date.now()
		const preferredTags = preference.preferredTags.map((tag) =>
			tag.toLowerCase(),
		)
		const downrankTags = preference.downrankTags.map((tag) => tag.toLowerCase())

		return stableShuffle(tracks)
			.map((track) => {
				const row = tagsByTrackId.get(track.id)
				const tags = getTrackTags(track, tagsByTrackId)
				const trackTags = allTags(tags)
				let score = 1

				for (const tag of preferredTags) {
					if (trackTags.some((item) => item.includes(tag))) score += 3
				}
				for (const tag of downrankTags) {
					if (trackTags.some((item) => item.includes(tag))) score -= 2
				}

				const firstSeenAgeDays = Math.max(
					0,
					(now - track.createdAt.getTime()) / 86_400_000,
				)
				if (preference.timeBias === 'recent') {
					score += Math.max(0, 4 - firstSeenAgeDays / 7)
				} else if (preference.timeBias === 'old') {
					score += Math.min(4, firstSeenAgeDays / 30)
				}

				if (preference.explorationLevel === 'exploratory') {
					score += Math.random() * 3
				} else if (preference.explorationLevel === 'conservative') {
					score += row?.confidence ?? 0
				} else {
					score += Math.random()
				}

				return { track, score }
			})
			.sort((a, b) => b.score - a.score)
			.map((item) => item.track)
	}
}

export const llmSmartShuffleService = new LlmSmartShuffleService()

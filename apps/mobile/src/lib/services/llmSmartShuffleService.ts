import { inArray, sql } from 'drizzle-orm'

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

function parseJsonObject<T>(content: string): T {
	try {
		return JSON.parse(content) as T
	} catch {
		const match = content.match(/\{[\s\S]*\}/)
		if (!match) throw new Error('LLM 没有返回 JSON 对象')
		return JSON.parse(match[0]) as T
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

function getLocalTitleTags(track: Track): TrackLlmTags {
	const text = `${track.title} ${track.artist?.name ?? ''}`.toLowerCase()
	const tags = createEmptyTags()

	if (/中v|中文vocaloid|洛天依|乐正绫|言和|星尘|心华/.test(text)) {
		tags.language.push('中文')
		tags.vocalType.push('中V')
	}
	if (/vocaloid|初音|miku|镜音|巡音|gumi/.test(text)) {
		tags.vocalType.push('Vocaloid')
	}
	if (/日v|日语|jpop|jp|初音|miku/.test(text)) {
		tags.language.push('日文')
	}
	if (/古风|国风/.test(text)) tags.genre.push('古风')
	if (/电音|电子|edm|remix/.test(text)) tags.genre.push('电子')
	if (/摇滚|rock/.test(text)) tags.genre.push('摇滚')
	if (/治愈|安静|温柔|轻/.test(text)) tags.mood.push('治愈')
	if (/燃|热血|快|high/.test(text)) tags.mood.push('燃')
	if (/夜|晚安|睡/.test(text)) tags.scene.push('夜晚')

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

	private async callJson<T>(system: string, user: string): Promise<T> {
		const settings = useAppStore.getState().settings
		const url = `${normalizeBaseUrl(settings.llmBaseUrl)}/chat/completions`
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}
		await llmCredentialService.migrateFromPlainSettings()
		const apiKey = await llmCredentialService.getApiKey()
		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`
		}

		const response = await fetch(url, {
			method: 'POST',
			headers,
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

		if (!response.ok) {
			throw new Error(`LLM API 请求失败：${response.status}`)
		}

		const data = (await response.json()) as OpenAIChatCompletionResponse
		const content = data.choices?.[0]?.message?.content
		if (!content) {
			throw new Error('LLM API 没有返回内容')
		}
		return parseJsonObject<T>(content)
	}

	async indexTracks(contexts: TrackIndexContext[]) {
		if (!this.isConfigured() || contexts.length === 0) return
		for (let i = 0; i < contexts.length; i += 25) {
			await this.indexTrackBatch(contexts.slice(i, i + 25))
		}
	}

	private async indexTrackBatch(contexts: TrackIndexContext[]) {
		const settings = useAppStore.getState().settings

		const response = await this.callJson<{ tracks?: unknown[] }>(
			LLM_TAG_INDEX_SYSTEM_PROMPT,
			buildTrackTagIndexPrompt(contexts, EMPTY_TAGS),
		)

		const indexes = (response.tracks ?? [])
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
			.filter((item): item is TrackTagIndex => item !== null)

		if (indexes.length === 0) return

		const contextById = new Map(contexts.map((item) => [item.track.id, item]))
		await db
			.insert(schema.trackLlmTags)
			.values(
				indexes.map((index) => {
					const context = contextById.get(index.trackId)
					return {
						trackId: index.trackId,
						tags: index.tags,
						confidence: index.confidence,
						reason: index.reason,
						model: settings.llmModel.trim(),
						sourceType: context?.sourceType,
						sourceId: context?.sourceId,
						sourceSyncedAt: context?.sourceSyncedAt,
						indexedAt: new Date(),
					}
				}),
			)
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
			})
	}

	async indexPlaylistTracks(
		playlistId: number,
		options?: {
			sourceType?: Playlist['type']
			sourceId?: string
			sourceSyncedAt?: Date
		},
	) {
		try {
			const tracksResult = await playlistService.getPlaylistTracks(playlistId)
			if (tracksResult.isErr()) {
				logger.warning('获取歌单歌曲用于 LLM 索引失败', tracksResult.error)
				return
			}
			await this.indexTracks(
				tracksResult.value.map((track) => ({
					track,
					sourceType: options?.sourceType,
					sourceId: options?.sourceId,
					sourceSyncedAt: options?.sourceSyncedAt,
				})),
			)
		} catch (error) {
			logger.warning('LLM 标签索引失败', { error })
		}
	}

	async parsePreference(prompt: string): Promise<SmartShufflePreference> {
		const trimmed = prompt.trim()
		if (!trimmed || !this.isConfigured()) {
			return parsePreferenceLocally(trimmed)
		}

		try {
			const response = await this.callJson<Partial<SmartShufflePreference>>(
				LLM_PREFERENCE_SYSTEM_PROMPT,
				buildPreferencePrompt(trimmed, DEFAULT_PREFERENCE),
			)
			return {
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
			}
		} catch (error) {
			logger.warning('LLM 解析偏好失败，使用本地关键词规则', { error })
			return parsePreferenceLocally(trimmed)
		}
	}

	async createSmartQueue(
		tracks: Track[],
		options?: SmartQueueOptions,
	): Promise<Track[]> {
		if (tracks.length <= 1) return tracks

		const prompt =
			options?.prompt?.trim() || options?.defaultPreference?.trim() || ''
		const preference = await this.parsePreference(prompt)
		const tagRows = await db.query.trackLlmTags.findMany({
			where: inArray(
				schema.trackLlmTags.trackId,
				tracks.map((track) => track.id),
			),
		})
		const tagsByTrackId = new Map<number, TrackLlmTagRow>(
			tagRows.map((row) => [row.trackId, row]),
		)

		const llmSortedQueue = await this.createLlmSortedQueue(
			tracks,
			prompt,
			preference,
			tagsByTrackId,
		)
		if (llmSortedQueue) return llmSortedQueue

		return this.createLocalScoredQueue(tracks, preference, tagsByTrackId)
	}

	private async createLlmSortedQueue(
		tracks: Track[],
		prompt: string,
		preference: SmartShufflePreference,
		tagsByTrackId: Map<number, TrackLlmTagRow>,
	) {
		if (!this.isConfigured()) return null

		try {
			const fallbackOrder = this.createLocalScoredQueue(
				tracks,
				preference,
				tagsByTrackId,
			)
			const items = tracks.map((track) =>
				this.createSortPromptItem(track, tagsByTrackId),
			)
			const chunks = this.createSortPayloadChunks(prompt, preference, items)
			const chunkOrders = await Promise.all(
				chunks.map(async (chunk, index) => {
					const response = await this.callJson<{
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
					)
					const chunkTrackIds = new Set(chunk.map((item) => item.track.id))
					const chunkFallback = fallbackOrder.filter((track) =>
						chunkTrackIds.has(track.id),
					)
					return this.mergeLlmOrderWithFallback(
						chunk.map((item) => item.track),
						extractOrderedTrackIds(response),
						chunkFallback,
					)
				}),
			)

			if (chunkOrders.some((chunk) => chunk === null)) return null

			const orderedTrackIds =
				chunkOrders.length === 1
					? (chunkOrders[0]?.map((track) => track.id) ?? [])
					: this.mergeChunkOrders(
							chunkOrders.filter((chunk): chunk is Track[] => chunk !== null),
							fallbackOrder,
						).map((track) => track.id)

			return this.mergeLlmOrderWithFallback(
				tracks,
				orderedTrackIds,
				fallbackOrder,
			)
		} catch (error) {
			logger.warning('LLM 直接排序失败，使用本地标签打分', { error })
			return null
		}
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

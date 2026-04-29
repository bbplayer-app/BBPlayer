import type { Track } from '@/types/core/media'
import type {
	SmartShufflePreference,
	TrackLlmTags,
} from '@/types/services/llmSmartShuffle'

export const LLM_TAG_INDEX_SYSTEM_PROMPT =
	'你是 BBPlayer 的本地曲库标签索引器。只返回 JSON。不要返回自然语言说明。'

export const LLM_PREFERENCE_SYSTEM_PROMPT =
	'你是 BBPlayer 的听歌取向解析器。只返回 JSON，不要解释。'

export const LLM_QUEUE_SORT_SYSTEM_PROMPT =
	'你是 BBPlayer 的音乐队列排序器。只返回 JSON，不要解释。'

export const LLM_QUEUE_SORT_PAYLOAD_STRATEGY =
	'排序任务优先使用整份歌单的单个 JSON payload；当歌单超过 200 首或单个 payload 超过 200KB 时，按断点拆成多个 JSON payload 分别排序，最后在客户端合并完整队列。'

export interface TrackSortPromptItem {
	track: Track
	tags: TrackLlmTags
	confidence?: number
	reason?: string | null
}

export function buildTrackTagIndexPrompt(
	contexts: {
		track: Track
		sourceType?: string
		sourceId?: string
		sourceSyncedAt?: Date
	}[],
	emptyTags: TrackLlmTags,
) {
	return JSON.stringify({
		task: '根据 Bilibili 音频标题和基础元数据生成结构化听歌标签。',
		outputSchema: {
			tracks: [
				{
					trackId: 'number',
					tags: emptyTags,
					confidence: '0 到 1',
					reason: '简短中文原因',
				},
			],
		},
		rules: [
			'不要臆造敏感信息。',
			'优先识别语种、Vocaloid/中V/日V、风格、情绪、场景。',
			'无法判断的字段返回空数组。',
		],
		tracks: contexts.map(({ track, sourceType, sourceId, sourceSyncedAt }) => ({
			trackId: track.id,
			title: track.title,
			artist: track.artist?.name,
			source: track.source,
			sourceType,
			sourceId,
			sourceSyncedAt: sourceSyncedAt?.toISOString(),
			firstSeenAt: track.createdAt.toISOString(),
		})),
	})
}

export function buildPreferencePrompt(
	userPreference: string,
	defaultPreference: SmartShufflePreference,
) {
	return JSON.stringify({
		task: '把用户的自然语言听歌取向转换成结构化偏好。',
		userPreference,
		outputSchema: defaultPreference,
	})
}

export function buildSmartQueueSortPrompt(input: {
	userPreference: string
	preference: SmartShufflePreference
	items: TrackSortPromptItem[]
	chunkIndex?: number
	chunkCount?: number
}) {
	return JSON.stringify({
		version: 2,
		task: '根据用户听歌取向，把本次播放队列中的所有歌曲排成一个适合连续播放的顺序。',
		payloadStrategy: LLM_QUEUE_SORT_PAYLOAD_STRATEGY,
		chunk: {
			index: input.chunkIndex ?? 1,
			count: input.chunkCount ?? 1,
			note:
				input.chunkCount && input.chunkCount > 1
					? '这是大歌单的一个分片，请只排序本分片内歌曲。客户端会合并所有分片。'
					: '这是完整歌单。',
		},
		userPreference: input.userPreference || '未填写，按均衡智能随机排序',
		parsedPreference: input.preference,
		outputSchema: {
			orderedTrackIds: ['number，必须只使用输入 items 中的 trackId'],
			reason: '简短中文说明',
		},
		rules: [
			'必须返回所有输入 trackId，不能新增、遗漏或重复。',
			'优先满足 userPreference 和 parsedPreference。',
			'相同歌手、相似风格或相似情绪的歌曲尽量错开，避免连续堆叠。',
			'高 confidence 的标签更可信；低 confidence 的标签仅作弱参考。',
			'不要按原列表机械排序，也不要按标题字母排序。',
			'只返回 JSON 对象，不要 Markdown。',
		],
		items: input.items.map(({ track, tags, confidence, reason }) => {
			const base = {
				trackId: track.id,
				source: track.source,
				music: {
					title: track.title,
					artists: track.artist?.name ? [track.artist.name] : [],
					duration: track.duration,
					id: track.uniqueKey,
				},
				indexedTags: tags,
				tagConfidence: confidence ?? 0,
				tagReason: reason ?? undefined,
				firstSeenAt: track.createdAt.toISOString(),
			}

			if (track.source !== 'bilibili') return base

			return {
				...base,
				bilibili: {
					bv: track.bilibiliMetadata.bvid,
					title: track.bilibiliMetadata.mainTrackTitle ?? track.title,
					song: track.title,
					duration: track.duration,
				},
			}
		}),
	})
}

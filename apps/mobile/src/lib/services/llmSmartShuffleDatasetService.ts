import { inArray } from 'drizzle-orm'
import * as FileSystem from 'expo-file-system'

import useAppStore from '@/hooks/stores/useAppStore'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { playlistService } from '@/lib/services/playlistService'
import type { Playlist, Track } from '@/types/core/media'
import type { TrackLlmTags } from '@/types/services/llmSmartShuffle'
import log from '@/utils/log'

const logger = log.extend('Service.LlmSmartShuffleDataset')

const MAX_DATASET_TRACKS_PER_FILE = 200
const MAX_DATASET_FILE_BYTES = 200 * 1024

interface DatasetSource {
	type: 'bilibili_favorite' | 'bilibili_collection' | 'bilibili_multi_page'
	id: number | string
	title?: string | null
	count?: number | null
	playlistId: number
	syncedAt: string
}

interface DatasetItem {
	trackId: number
	uniqueKey: string
	source: Track['source']
	music: {
		title: string
		artists: string[]
		duration: number
		id: string
	}
	bilibili?: {
		bv: string
		title: string
		song: string
		duration: number
	}
	indexedTags?: TrackLlmTags
	tagConfidence?: number
	tagReason?: string | null
	firstSeenAt: string
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

function sanitizeFilePart(value: string) {
	return value.replace(/[^\w.-]+/g, '_').slice(0, 80)
}

function buildDatasetPayload(source: DatasetSource, items: DatasetItem[]) {
	return JSON.stringify({
		version: 2,
		purpose: 'llm_smart_shuffle_dataset',
		source,
		defaultPreference: useAppStore.getState().settings.llmDefaultPreference,
		items,
	})
}

function chunkDatasetItems(source: DatasetSource, items: DatasetItem[]) {
	const chunks: DatasetItem[][] = []
	let current: DatasetItem[] = []

	for (const item of items) {
		const candidate = [...current, item]
		const payloadBytes = utf8ByteLength(buildDatasetPayload(source, candidate))
		const shouldSplit =
			candidate.length > MAX_DATASET_TRACKS_PER_FILE ||
			payloadBytes > MAX_DATASET_FILE_BYTES

		if (shouldSplit && current.length > 0) {
			chunks.push(current)
			current = [item]
			continue
		}

		current = candidate
	}

	if (current.length > 0) chunks.push(current)
	return chunks
}

function toDatasetItem(
	track: Track,
	tagRow?: typeof schema.trackLlmTags.$inferSelect,
): DatasetItem {
	const base: DatasetItem = {
		trackId: track.id,
		uniqueKey: track.uniqueKey,
		source: track.source,
		music: {
			title: track.title,
			artists: track.artist?.name ? [track.artist.name] : [],
			duration: track.duration,
			id: track.uniqueKey,
		},
		indexedTags: tagRow?.tags,
		tagConfidence: tagRow?.confidence,
		tagReason: tagRow?.reason,
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
}

export const llmSmartShuffleDatasetService = {
	async writePlaylistDatasetFiles(
		playlistId: number,
		source: {
			type: Playlist['type']
			sourceId: string | number
			title?: string | null
			count?: number | null
		},
	) {
		const tracksResult = await playlistService.getPlaylistTracks(playlistId)
		if (tracksResult.isErr()) throw tracksResult.error

		const tracks = tracksResult.value
		const tagRows =
			tracks.length > 0
				? await db.query.trackLlmTags.findMany({
						where: inArray(
							schema.trackLlmTags.trackId,
							tracks.map((track) => track.id),
						),
					})
				: []
		const tagsByTrackId = new Map(tagRows.map((row) => [row.trackId, row]))
		const datasetSource: DatasetSource = {
			type:
				source.type === 'favorite'
					? 'bilibili_favorite'
					: source.type === 'collection'
						? 'bilibili_collection'
						: 'bilibili_multi_page',
			id: source.sourceId,
			title: source.title,
			count: source.count ?? tracks.length,
			playlistId,
			syncedAt: new Date().toISOString(),
		}
		const items = tracks.map((track) =>
			toDatasetItem(track, tagsByTrackId.get(track.id)),
		)
		const chunks = chunkDatasetItems(datasetSource, items)
		const datasetDir = new FileSystem.Directory(
			FileSystem.Paths.document,
			'llm-datasets',
		)
		datasetDir.create({ intermediates: true, idempotent: true })

		const prefix = `${datasetSource.type}-${sanitizeFilePart(String(datasetSource.id))}`
		for (const entry of datasetDir.list()) {
			if (entry instanceof FileSystem.File && entry.name.startsWith(prefix)) {
				entry.delete()
			}
		}

		const files: string[] = []
		chunks.forEach((chunk, index) => {
			const file = new FileSystem.File(
				datasetDir,
				`${prefix}.part-${String(index + 1).padStart(3, '0')}.json`,
			)
			file.write(
				buildDatasetPayload(
					{
						...datasetSource,
						count: items.length,
					},
					chunk,
				),
			)
			files.push(file.uri)
		})

		logger.info('已写入 LLM 排序数据集 JSON', {
			playlistId,
			fileCount: files.length,
			trackCount: items.length,
		})
		return files
	},
}

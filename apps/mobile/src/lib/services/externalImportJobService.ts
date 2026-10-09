import type { StateStorage } from 'zustand/middleware'

import {
	type ExternalPlaylistSource,
	getMatchResultFingerprint,
	getMatchResultStatus,
	getTrackFingerprint,
	isMatchResultForTrack,
	type MatchErrorType,
	type MatchResult,
	type MatchResultStatus,
} from '@/lib/services/externalPlaylistService'
import type { BilibiliSearchVideo } from '@/types/apis/bilibili'
import type { Track } from '@/types/core/media'
import type { GenericPlaylist, GenericTrack } from '@/types/external_playlist'
import log from '@/utils/log'
import { zustandStorage } from '@/utils/mmkv'

const logger = log.extend('Services.ExternalImportJob')

export const LEGACY_SYNC_STORAGE_KEY = 'external-playlist-sync-storage'
export const PLAYLIST_VIEW_MODES_STORAGE_KEY = 'external-playlist-view-modes'

export type ExternalPlaylistViewMode = 'original' | 'bilibili'

export type ImportJobStatus =
	| 'pending'
	| 'running'
	| 'paused'
	| 'rate_limited'
	| 'completed_waiting_confirmation'
	| 'completed'
	| 'cancelled'
	| 'failed'

export interface ImportJob {
	jobId: string
	source: ExternalPlaylistSource
	sourcePlaylistId: string
	playlistMetadata: GenericPlaylist
	totalCount: number
	processedCount: number
	matchedCount: number
	unmatchedCount: number
	errorCount: number
	rateLimitedCount: number
	status: ImportJobStatus
	savedPlaylistId: number | null
	createdAt: number
	updatedAt: number
	lastProcessedAt: number | null
}

export interface ImportItem {
	itemId: string
	jobId: string
	fingerprint: string
	originalIndex: number
	originalTrack: GenericTrack
	status: MatchResultStatus
	matchedVideo: BilibiliSearchVideo | null
	errorType?: MatchErrorType
	errorMessage?: string
	updatedAt: number
}

export interface ImportJobSnapshot {
	job: ImportJob
	items: ImportItem[]
}

export interface ImportJobStats {
	totalCount: number
	processedCount: number
	matchedCount: number
	unmatchedCount: number
	errorCount: number
	rateLimitedCount: number
	pendingCount: number
}

export type ExternalTrackMatchStatus =
	| 'matched'
	| 'unmatched'
	| 'pending'
	| 'error'
	| 'rate_limited'

export interface ExternalTrackMappingRecord {
	trackId: number
	playlistId: number
	jobId: string | null
	itemId: string | null
	externalSource: ExternalPlaylistSource
	externalPlaylistId: string
	originalIndex: number
	fingerprint: string
	originalTrackTitle: string
	originalTranslatedTitle: string | null
	originalArtists: string[]
	originalAlbum: string
	originalDuration: number
	originalCoverUrl: string | null
	originalTrack: GenericTrack
	matchStatus: ExternalTrackMatchStatus
	matchedBvid: string | null
	matchedVideo: BilibiliSearchVideo | null
	errorType: MatchErrorType | null
	errorMessage: string | null
	createdAt: number
	updatedAt: number
}

export interface UpsertExternalTrackMappingInput {
	trackId: number
	playlistId: number
	jobId?: string | null
	itemId?: string | null
	externalSource: ExternalPlaylistSource
	externalPlaylistId: string
	originalIndex?: number
	originalTrack: GenericTrack
	matchStatus: ExternalTrackMatchStatus
	matchedVideo?: BilibiliSearchVideo | null
	errorType?: MatchErrorType | null
	errorMessage?: string | null
}

export function isJobWaitingConfirmation(job: ImportJob): boolean {
	return (
		(job.status === 'completed' ||
			job.status === 'completed_waiting_confirmation') &&
		job.savedPlaylistId === null
	)
}

export function mappingToGenericTrack(
	mapping: Pick<
		ExternalTrackMappingRecord,
		| 'originalTrackTitle'
		| 'originalTranslatedTitle'
		| 'originalArtists'
		| 'originalAlbum'
		| 'originalDuration'
		| 'originalCoverUrl'
	>,
): GenericTrack {
	return {
		title: mapping.originalTrackTitle,
		...(mapping.originalTranslatedTitle
			? { translatedTitle: mapping.originalTranslatedTitle }
			: {}),
		artists: mapping.originalArtists,
		album: mapping.originalAlbum,
		duration: mapping.originalDuration,
		coverUrl: mapping.originalCoverUrl ?? undefined,
	}
}

export function parseMatchedVideoDurationSeconds(
	duration: string | number | null | undefined,
): number {
	if (typeof duration === 'number' && Number.isFinite(duration)) {
		return Math.max(0, Math.floor(duration))
	}
	if (typeof duration !== 'string' || !duration.trim()) {
		return 0
	}
	const trimmed = duration.trim()
	if (/^\d+$/.test(trimmed)) {
		return Math.max(0, Number(trimmed))
	}
	const parts = trimmed.split(':').map((part) => Number(part))
	if (parts.some((n) => !Number.isFinite(n) || n < 0)) {
		return 0
	}
	if (parts.length === 2) {
		return parts[0] * 60 + parts[1]
	}
	if (parts.length === 3) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2]
	}
	return 0
}

export function parseExternalPlaylistIdFromUniqueKey(
	uniqueKey: string | null | undefined,
): number | null {
	if (!uniqueKey || !uniqueKey.startsWith('external::')) {
		return null
	}
	const parts = uniqueKey.split('::')
	if (parts.length < 2) {
		return null
	}
	const parsed = Number(parts[1])
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function applyPlaylistViewModeToTrack(
	track: Track,
	mode: ExternalPlaylistViewMode,
	mapping?: ExternalTrackMappingRecord | null,
): Track {
	if (
		mode !== 'bilibili' ||
		track.source !== 'bilibili' ||
		!track.bilibiliMetadata.bvid
	) {
		return track
	}

	const matchedVideo = mapping?.matchedVideo ?? null
	const rawMainTitle = track.bilibiliMetadata.mainTrackTitle?.trim() ?? ''

	let biliTitle = ''
	let biliAuthor = ''
	let biliMid: string | null = null
	let biliPic: string | null = null
	let biliDurationSec = 0

	if (matchedVideo) {
		biliTitle = matchedVideo.title.replace(/<em[^>]*>|<\/em>/g, '').trim()
		biliAuthor = matchedVideo.author?.trim() ?? ''
		biliMid = matchedVideo.mid ? String(matchedVideo.mid) : null
		if (matchedVideo.pic) {
			biliPic = matchedVideo.pic.startsWith('//')
				? `https:${matchedVideo.pic}`
				: matchedVideo.pic
		}
		biliDurationSec = parseMatchedVideoDurationSeconds(matchedVideo.duration)
	}

	if ((!biliTitle || !biliAuthor) && rawMainTitle.startsWith('音源:')) {
		const withoutPrefix = rawMainTitle.replace(/^音源:\s*/, '')
		const upMarker = ' · UP: '
		const upIdx = withoutPrefix.lastIndexOf(upMarker)
		if (!biliTitle) {
			biliTitle = (
				upIdx !== -1 ? withoutPrefix.slice(0, upIdx) : withoutPrefix
			).trim()
		}
		if (!biliAuthor && upIdx !== -1) {
			biliAuthor = withoutPrefix.slice(upIdx + upMarker.length).trim()
		}
	}

	return {
		...track,
		title: biliTitle || track.title,
		artist: biliAuthor
			? {
					id: track.artist?.id ?? 0,
					name: biliAuthor,
					remoteId: biliMid ?? track.artist?.remoteId ?? null,
					source: 'bilibili',
					createdAt: track.artist?.createdAt ?? track.createdAt,
					updatedAt: track.artist?.updatedAt ?? track.updatedAt,
				}
			: track.artist,
		coverUrl: biliPic || track.coverUrl,
		duration: biliDurationSec > 0 ? biliDurationSec : track.duration,
		bilibiliMetadata: {
			...track.bilibiliMetadata,
			mainTrackTitle: null,
		},
	}
}

export interface SqliteSyncExecutor {
	execSync(source: string): void
	// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
	getFirstSync<T>(source: string, params?: (string | number | null)[]): T | null
	getAllSync<T>(source: string, params?: (string | number | null)[]): T[]
	runSync(source: string, params?: (string | number | null)[]): unknown
	withTransactionSync(task: () => void): void
}

const VALID_SOURCES = new Set<ExternalPlaylistSource>([
	'netease',
	'qq',
	'playlistout',
	'local_json',
])

export function createImportJobId(
	source: ExternalPlaylistSource,
	sourcePlaylistId: string,
): string {
	return `import:${source}:${sourcePlaylistId.trim()}`
}

export function parseSessionKeyToJobIdentity(sessionKey: string): {
	jobId: string
	source: ExternalPlaylistSource
	sourcePlaylistId: string
	legacySessionKey: string
} {
	const trimmed = sessionKey.trim()
	const withoutPrefix = trimmed.startsWith('import:')
		? trimmed.slice('import:'.length)
		: trimmed
	const colonIndex = withoutPrefix.indexOf(':')
	if (colonIndex <= 0) {
		const fallbackId = withoutPrefix || 'unknown'
		return {
			jobId: createImportJobId('netease', fallbackId),
			source: 'netease',
			sourcePlaylistId: fallbackId,
			legacySessionKey: `netease:${fallbackId}`,
		}
	}

	const rawSource = withoutPrefix.slice(0, colonIndex) as ExternalPlaylistSource
	const source: ExternalPlaylistSource = VALID_SOURCES.has(rawSource)
		? rawSource
		: 'netease'
	const sourcePlaylistId =
		withoutPrefix.slice(colonIndex + 1).trim() || 'unknown'
	return {
		jobId: createImportJobId(source, sourcePlaylistId),
		source,
		sourcePlaylistId,
		legacySessionKey: `${source}:${sourcePlaylistId}`,
	}
}

export function createImportItemId(
	jobId: string,
	fingerprint: string,
	occurrenceIndex = 0,
): string {
	return `${jobId}::${fingerprint}#${occurrenceIndex}`
}

export function computeImportJobStats(
	items: Pick<ImportItem, 'status'>[],
	explicitTotalCount?: number,
): ImportJobStats {
	let matchedCount = 0
	let unmatchedCount = 0
	let errorCount = 0
	let rateLimitedCount = 0
	let pendingCount = 0

	for (const item of items) {
		switch (item.status) {
			case 'matched':
				matchedCount++
				break
			case 'unmatched':
				unmatchedCount++
				break
			case 'error':
				errorCount++
				break
			case 'rate_limited':
				rateLimitedCount++
				break
			default:
				pendingCount++
				break
		}
	}

	const totalCount = explicitTotalCount ?? items.length
	const processedCount = matchedCount + unmatchedCount

	return {
		totalCount,
		processedCount,
		matchedCount,
		unmatchedCount,
		errorCount,
		rateLimitedCount,
		pendingCount,
	}
}

export function isVerifiableLegacyMatchResult(
	candidate: unknown,
): candidate is MatchResult {
	if (!candidate || typeof candidate !== 'object') return false
	const record = candidate as Record<string, unknown>
	if (!record.track || typeof record.track !== 'object') return false
	const track = record.track as Record<string, unknown>
	if (typeof track.title !== 'string' || !track.title.trim()) return false
	if (!Array.isArray(track.artists)) return false
	if (typeof track.duration !== 'number' || !Number.isFinite(track.duration)) {
		return false
	}
	return true
}

export function reconcileSessionResults(
	savedResults: Record<number, MatchResult>,
	tracks: GenericTrack[],
): Record<number, MatchResult> {
	const reconciled: Record<number, MatchResult> = {}
	const consumedIndices = new Set<number>()

	// 1. First pass: keep results at the same index if track fingerprint still matches
	for (let i = 0; i < tracks.length; i++) {
		const track = tracks[i]
		const existing = savedResults[i]
		if (
			track &&
			isVerifiableLegacyMatchResult(existing) &&
			isMatchResultForTrack(existing, track)
		) {
			reconciled[i] = {
				...existing,
				track,
				trackFingerprint: getTrackFingerprint(track),
				status: getMatchResultStatus(existing),
			}
			consumedIndices.add(i)
		}
	}

	// 2. Second pass: collect remaining unconsumed verifiable saved results by fingerprint
	const unconsumedByFingerprint = new Map<string, MatchResult[]>()
	for (const [key, res] of Object.entries(savedResults)) {
		const idx = Number(key)
		if (consumedIndices.has(idx) || !isVerifiableLegacyMatchResult(res)) {
			continue
		}
		const fp = getMatchResultFingerprint(res)
		const list = unconsumedByFingerprint.get(fp)
		if (list) {
			list.push(res)
		} else {
			unconsumedByFingerprint.set(fp, [res])
		}
	}

	// 3. Re-associate tracks whose order changed if fingerprint matches
	for (let i = 0; i < tracks.length; i++) {
		if (reconciled[i]) continue
		const track = tracks[i]
		if (!track) continue
		const fp = getTrackFingerprint(track)
		const candidates = unconsumedByFingerprint.get(fp)
		const matched = candidates?.shift()
		if (matched) {
			reconciled[i] = {
				...matched,
				track,
				trackFingerprint: fp,
				status: getMatchResultStatus(matched),
			}
		}
	}

	return reconciled
}

export function buildDefaultPlaylistMetadata(
	source: ExternalPlaylistSource,
	sourcePlaylistId: string,
	trackCount: number,
): GenericPlaylist {
	return {
		id: sourcePlaylistId,
		title: `外部歌单 ${sourcePlaylistId}`,
		coverUrl: '',
		description: '',
		trackCount,
		author: {
			name: '',
		},
		platform: source === 'qq' ? 'qqmusic' : source,
	}
}

export function itemToMatchResult(item: ImportItem): MatchResult {
	return {
		track: item.originalTrack,
		matchedVideo: item.matchedVideo,
		status: item.status,
		trackFingerprint: item.fingerprint,
		...(item.errorType ? { errorType: item.errorType } : {}),
		...(item.errorMessage ? { errorMessage: item.errorMessage } : {}),
	}
}

export function itemsToResultsRecord(
	items: ImportItem[],
): Record<number, MatchResult> {
	const results: Record<number, MatchResult> = {}
	for (const item of items) {
		if (item.status !== 'pending') {
			results[item.originalIndex] = itemToMatchResult(item)
		}
	}
	return results
}

type DbJobRow = {
	job_id: string
	source: ExternalPlaylistSource
	source_playlist_id: string
	playlist_metadata: string
	total_count: number
	processed_count: number
	matched_count: number
	unmatched_count: number
	error_count: number
	status: ImportJobStatus
	saved_playlist_id: number | null
	created_at: number
	updated_at: number
	last_processed_at: number | null
}

type DbItemRow = {
	item_id: string
	job_id: string
	fingerprint: string
	original_index: number
	original_track: string
	status: MatchResultStatus
	matched_video: string | null
	error_type: MatchErrorType | null
	error_message: string | null
	updated_at: number
}

type DbTrackMappingRow = {
	track_id: number
	playlist_id: number
	job_id: string | null
	item_id: string | null
	source: ExternalPlaylistSource
	source_playlist_id: string
	source_track_id: string | null
	original_index: number
	track_fingerprint: string
	original_title: string
	original_translated_title: string | null
	original_artists_json: string
	original_album: string
	original_duration: number
	original_cover_url: string | null
	match_status: ExternalTrackMatchStatus
	matched_bvid: string | null
	matched_cid: number | null
	matched_title: string | null
	matched_author: string | null
	matched_mid: number | null
	matched_pic: string | null
	matched_duration: string | null
	matched_video_json: string | null
	error_type: MatchErrorType | null
	error_message: string | null
	created_at: number
	updated_at: number
}

const ENSURE_IMPORT_JOB_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS \`external_import_jobs\` (
	\`job_id\` text PRIMARY KEY NOT NULL,
	\`source\` text NOT NULL,
	\`source_playlist_id\` text NOT NULL,
	\`playlist_metadata\` text NOT NULL,
	\`total_count\` integer DEFAULT 0 NOT NULL,
	\`processed_count\` integer DEFAULT 0 NOT NULL,
	\`matched_count\` integer DEFAULT 0 NOT NULL,
	\`unmatched_count\` integer DEFAULT 0 NOT NULL,
	\`error_count\` integer DEFAULT 0 NOT NULL,
	\`status\` text DEFAULT 'pending' NOT NULL,
	\`saved_playlist_id\` integer,
	\`created_at\` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	\`last_processed_at\` integer
);
CREATE UNIQUE INDEX IF NOT EXISTS \`external_import_jobs_source_playlist_unq\` ON \`external_import_jobs\` (\`source\`,\`source_playlist_id\`);
CREATE INDEX IF NOT EXISTS \`external_import_jobs_status_idx\` ON \`external_import_jobs\` (\`status\`);
CREATE TABLE IF NOT EXISTS \`external_import_items\` (
	\`item_id\` text PRIMARY KEY NOT NULL,
	\`job_id\` text NOT NULL,
	\`fingerprint\` text NOT NULL,
	\`original_index\` integer NOT NULL,
	\`original_track\` text NOT NULL,
	\`status\` text DEFAULT 'pending' NOT NULL,
	\`matched_video\` text,
	\`error_type\` text,
	\`error_message\` text,
	\`updated_at\` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (\`job_id\`) REFERENCES \`external_import_jobs\`(\`job_id\`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS \`external_import_items_job_idx\` ON \`external_import_items\` (\`job_id\`);
CREATE INDEX IF NOT EXISTS \`external_import_items_job_index_idx\` ON \`external_import_items\` (\`job_id\`,\`original_index\`);
CREATE INDEX IF NOT EXISTS \`external_import_items_job_fingerprint_idx\` ON \`external_import_items\` (\`job_id\`,\`fingerprint\`);
CREATE TABLE IF NOT EXISTS \`external_track_mappings\` (
	\`track_id\` integer PRIMARY KEY NOT NULL,
	\`playlist_id\` integer NOT NULL,
	\`job_id\` text,
	\`item_id\` text,
	\`source\` text NOT NULL,
	\`source_playlist_id\` text NOT NULL,
	\`source_track_id\` text,
	\`original_index\` integer DEFAULT 0 NOT NULL,
	\`track_fingerprint\` text NOT NULL,
	\`original_title\` text NOT NULL,
	\`original_translated_title\` text,
	\`original_artists_json\` text NOT NULL,
	\`original_album\` text NOT NULL,
	\`original_duration\` integer DEFAULT 0 NOT NULL,
	\`original_cover_url\` text,
	\`match_status\` text DEFAULT 'pending' NOT NULL,
	\`matched_bvid\` text,
	\`matched_cid\` integer,
	\`matched_title\` text,
	\`matched_author\` text,
	\`matched_mid\` integer,
	\`matched_pic\` text,
	\`matched_duration\` text,
	\`matched_video_json\` text,
	\`error_type\` text,
	\`error_message\` text,
	\`created_at\` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (\`track_id\`) REFERENCES \`tracks\`(\`id\`) ON DELETE cascade,
	FOREIGN KEY (\`playlist_id\`) REFERENCES \`playlists\`(\`id\`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS \`external_track_mappings_playlist_idx\` ON \`external_track_mappings\` (\`playlist_id\`);
CREATE INDEX IF NOT EXISTS \`external_track_mappings_status_idx\` ON \`external_track_mappings\` (\`playlist_id\`,\`match_status\`);
`

function getDefaultSqliteExecutor(): SqliteSyncExecutor {
	// Lazy require so unit tests can inject or mock @/lib/db/db cleanly
	// oxlint-disable-next-line typescript/no-require-imports
	const dbModule = require('@/lib/db/db') as { expoDb: SqliteSyncExecutor }
	return dbModule.expoDb
}

export class ExternalImportJobService {
	private tablesEnsured = false
	private activeJobChecker: (jobId: string) => boolean = () => false
	private readonly changeListeners = new Set<() => void>()

	constructor(
		private readonly getDb: () => SqliteSyncExecutor = getDefaultSqliteExecutor,
	) {}

	public subscribeChanges(listener: () => void): () => void {
		this.changeListeners.add(listener)
		return () => {
			this.changeListeners.delete(listener)
		}
	}

	private notifyChanges(): void {
		for (const listener of this.changeListeners) {
			try {
				listener()
			} catch (e) {
				logger.warning('ExternalImportJobService 变更监听回调异常:', e)
			}
		}
	}

	private onCancelJob?: (jobId: string) => void
	private onCancelPlaylist?: (playlistId: number) => void

	public setWorkerCancellationHooks(hooks: {
		cancelJob: (jobId: string) => void
		cancelPlaylist: (playlistId: number) => void
	}): void {
		this.onCancelJob = hooks.cancelJob
		this.onCancelPlaylist = hooks.cancelPlaylist
	}

	public setActiveJobChecker(checker: (jobId: string) => boolean): void {
		this.activeJobChecker = checker
	}

	public isJobActivelyRunning(jobId: string): boolean {
		return this.activeJobChecker(jobId)
	}

	/**
	 * 检查并清理所有指向不存在或已删除本地歌单的孤立外部导入任务。
	 * 防止歌单被删除后遗留僵尸任务或导致再次导入时复用旧数据。
	 */
	public cleanupOrphanedJobs(): number {
		const executor = this.getDb()
		let cleanedCount = 0
		try {
			executor.withTransactionSync(() => {
				const rows = executor.getAllSync<DbJobRow>(
					`SELECT * FROM external_import_jobs WHERE saved_playlist_id IS NOT NULL`,
				)
				for (const row of rows) {
					let playlistExists = false
					try {
						const pl = executor.getFirstSync<{ id: number }>(
							`SELECT id FROM playlists WHERE id = ?`,
							[row.saved_playlist_id],
						)
						playlistExists = Boolean(pl)
					} catch {
						// 单元测试中可能尚未创建 playlists 表，容错处理
						playlistExists = true
					}
					if (!playlistExists) {
						try {
							this.onCancelJob?.(row.job_id)
						} catch {
							// Ignore
						}
						executor.runSync(
							`DELETE FROM external_import_items WHERE job_id = ?`,
							[row.job_id],
						)
						executor.runSync(
							`DELETE FROM external_import_jobs WHERE job_id = ?`,
							[row.job_id],
						)
						this.consumeLegacySession(
							`${row.source}:${row.source_playlist_id}`,
							[],
						)
						cleanedCount++
					}
				}
			})
		} catch (e) {
			logger.warning('清理孤立外部导入任务时出错:', e)
		}

		if (cleanedCount > 0) {
			logger.info(`已清理 ${cleanedCount} 个指向已删除歌单的孤立外部导入任务`)
			this.notifyChanges()
		}
		return cleanedCount
	}

	private db(): SqliteSyncExecutor {
		const executor = this.getDb()
		if (!this.tablesEnsured) {
			executor.execSync(ENSURE_IMPORT_JOB_TABLES_SQL)
			try {
				executor.execSync(
					'ALTER TABLE external_import_jobs ADD COLUMN saved_playlist_id integer;',
				)
			} catch {
				// Column already exists
			}
			try {
				executor.execSync(
					'ALTER TABLE external_track_mappings ADD COLUMN matched_video_json text;',
				)
			} catch {
				// Column already exists
			}
			this.tablesEnsured = true
			this.cleanupOrphanedJobs()
		}
		return executor
	}

	private mapJobRow(row: DbJobRow, rateLimitedCount = 0): ImportJob {
		let playlistMetadata: GenericPlaylist
		try {
			playlistMetadata = JSON.parse(row.playlist_metadata) as GenericPlaylist
		} catch {
			playlistMetadata = buildDefaultPlaylistMetadata(
				row.source,
				row.source_playlist_id,
				row.total_count,
			)
		}

		return {
			jobId: row.job_id,
			source: row.source,
			sourcePlaylistId: row.source_playlist_id,
			playlistMetadata,
			totalCount: row.total_count,
			processedCount: row.processed_count,
			matchedCount: row.matched_count,
			unmatchedCount: row.unmatched_count,
			errorCount: row.error_count,
			rateLimitedCount,
			status: row.status,
			savedPlaylistId: row.saved_playlist_id ?? null,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			lastProcessedAt: row.last_processed_at,
		}
	}

	private mapTrackMappingRow(
		row: DbTrackMappingRow,
	): ExternalTrackMappingRecord {
		let originalArtists: string[] = []
		try {
			const parsed = JSON.parse(row.original_artists_json) as unknown
			if (Array.isArray(parsed)) {
				originalArtists = parsed.filter(
					(item): item is string => typeof item === 'string',
				)
			}
		} catch {
			originalArtists = []
		}

		let matchedVideo: BilibiliSearchVideo | null = null
		if (row.matched_video_json) {
			try {
				matchedVideo = JSON.parse(row.matched_video_json) as BilibiliSearchVideo
			} catch {
				matchedVideo = null
			}
		} else if (row.matched_bvid) {
			matchedVideo = {
				type: 'video',
				aid: 0,
				bvid: row.matched_bvid,
				title: row.matched_title ?? row.original_title,
				pic: row.matched_pic ?? row.original_cover_url ?? '',
				author: row.matched_author ?? '',
				duration: row.matched_duration ?? '0:00',
				senddate: 0,
				mid: row.matched_mid ?? 0,
				typeid: 130,
			}
		}

		const originalTrack: GenericTrack = {
			title: row.original_title,
			...(row.original_translated_title
				? { translatedTitle: row.original_translated_title }
				: {}),
			artists: originalArtists,
			album: row.original_album,
			duration: row.original_duration,
			coverUrl: row.original_cover_url ?? undefined,
		}

		return {
			trackId: row.track_id,
			playlistId: row.playlist_id,
			jobId: row.job_id ?? null,
			itemId: row.item_id ?? null,
			externalSource: row.source,
			externalPlaylistId: row.source_playlist_id,
			originalIndex: row.original_index,
			fingerprint: row.track_fingerprint,
			originalTrackTitle: row.original_title,
			originalTranslatedTitle: row.original_translated_title ?? null,
			originalArtists,
			originalAlbum: row.original_album,
			originalDuration: row.original_duration,
			originalCoverUrl: row.original_cover_url ?? null,
			originalTrack,
			matchStatus: row.match_status,
			matchedBvid: row.matched_bvid ?? null,
			matchedVideo,
			errorType: row.error_type ?? null,
			errorMessage: row.error_message ?? null,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}
	}

	private mapItemRow(row: DbItemRow): ImportItem {
		const originalTrack = JSON.parse(row.original_track) as GenericTrack
		const matchedVideo = row.matched_video
			? (JSON.parse(row.matched_video) as BilibiliSearchVideo)
			: null

		return {
			itemId: row.item_id,
			jobId: row.job_id,
			fingerprint: row.fingerprint,
			originalIndex: row.original_index,
			originalTrack,
			status: row.status,
			matchedVideo,
			...(row.error_type ? { errorType: row.error_type } : {}),
			...(row.error_message ? { errorMessage: row.error_message } : {}),
			updatedAt: row.updated_at,
		}
	}

	public getJobSnapshot(jobId: string): ImportJobSnapshot | null {
		const executor = this.db()
		const jobRow = executor.getFirstSync<DbJobRow>(
			`SELECT * FROM external_import_jobs WHERE job_id = ?`,
			[jobId],
		)
		if (!jobRow) return null

		const itemRows = executor.getAllSync<DbItemRow>(
			`SELECT * FROM external_import_items WHERE job_id = ? ORDER BY original_index ASC`,
			[jobId],
		)
		const items = itemRows.map((r) => this.mapItemRow(r))
		const stats = computeImportJobStats(items, jobRow.total_count)

		return {
			job: this.mapJobRow(jobRow, stats.rateLimitedCount),
			items,
		}
	}

	/**
	 * 应用启动或页面重新挂载时调用：
	 * 将上次因崩溃 / 强杀遗留的 running 状态恢复为 paused 或 rate_limited，防止假 running。
	 */
	public recoverStuckJobs(
		activeJobIds: ReadonlySet<string> = new Set(),
	): number {
		const executor = this.db()
		let recovered = 0
		executor.withTransactionSync(() => {
			const runningRows = executor.getAllSync<DbJobRow>(
				`SELECT * FROM external_import_jobs WHERE status = 'running'`,
			)
			const now = Date.now()
			for (const row of runningRows) {
				if (
					activeJobIds.has(row.job_id) ||
					this.isJobActivelyRunning(row.job_id)
				) {
					continue
				}
				const itemRows = executor.getAllSync<DbItemRow>(
					`SELECT * FROM external_import_items WHERE job_id = ? ORDER BY original_index ASC`,
					[row.job_id],
				)
				const items = itemRows.map((r) => this.mapItemRow(r))
				const stats = computeImportJobStats(items, row.total_count)
				const nextStatus: ImportJobStatus =
					stats.rateLimitedCount > 0 ? 'rate_limited' : 'paused'
				executor.runSync(
					`UPDATE external_import_jobs
					 SET status = ?, processed_count = ?, matched_count = ?, unmatched_count = ?, error_count = ?, updated_at = ?
					 WHERE job_id = ?`,
					[
						nextStatus,
						stats.processedCount,
						stats.matchedCount,
						stats.unmatchedCount,
						stats.errorCount,
						now,
						row.job_id,
					],
				)
				recovered++
			}
		})
		if (recovered > 0) {
			logger.info(
				`已恢复 ${recovered} 个中断的外部歌单导入任务（running -> paused/rate_limited）`,
			)
		}
		return recovered
	}

	/**
	 * 读取并一次性迁移旧版 MMKV external-playlist-sync-storage 中的会话数据。
	 * - 仅迁移包含可校验歌曲信息且 fingerprint 匹配的条目；
	 * - 安全忽略损坏或无法校验身份的数据，绝不按纯数组下标套到别的歌曲；
	 * - 迁移完成后清理对应的旧 session 条目。
	 */
	public consumeLegacySession(
		legacySessionKey: string,
		tracks: GenericTrack[],
		storageImpl: StateStorage = zustandStorage,
	): {
		reconciledResults: Record<number, MatchResult>
		isRateLimited: boolean
		updatedAt: number
		didMigrate: boolean
	} {
		const rawJson = storageImpl.getItem(LEGACY_SYNC_STORAGE_KEY)
		if (typeof rawJson !== 'string' || !rawJson.trim()) {
			return {
				reconciledResults: {},
				isRateLimited: false,
				updatedAt: Date.now(),
				didMigrate: false,
			}
		}

		try {
			const parsed = JSON.parse(rawJson) as {
				state?: {
					sessions?: Record<
						string,
						{
							results?: Record<number, unknown>
							isRateLimited?: boolean
							updatedAt?: number
						}
					>
				}
				version?: number
			}
			const sessions = parsed?.state?.sessions
			if (!sessions || typeof sessions !== 'object') {
				return {
					reconciledResults: {},
					isRateLimited: false,
					updatedAt: Date.now(),
					didMigrate: false,
				}
			}

			const legacySession = sessions[legacySessionKey]
			if (!legacySession || typeof legacySession !== 'object') {
				return {
					reconciledResults: {},
					isRateLimited: false,
					updatedAt: Date.now(),
					didMigrate: false,
				}
			}

			const verifiableResults: Record<number, MatchResult> = {}
			if (legacySession.results && typeof legacySession.results === 'object') {
				for (const [k, candidate] of Object.entries(legacySession.results)) {
					const idx = Number(k)
					if (
						Number.isInteger(idx) &&
						idx >= 0 &&
						isVerifiableLegacyMatchResult(candidate)
					) {
						verifiableResults[idx] = {
							...candidate,
							status: getMatchResultStatus(candidate),
							trackFingerprint: getMatchResultFingerprint(candidate),
						}
					}
				}
			}

			const reconciledResults = reconcileSessionResults(
				verifiableResults,
				tracks,
			)
			const hasRateLimited = Object.values(reconciledResults).some(
				(r) => getMatchResultStatus(r) === 'rate_limited',
			)
			const isRateLimited =
				Boolean(legacySession.isRateLimited) || hasRateLimited
			const updatedAt =
				typeof legacySession.updatedAt === 'number' &&
				Number.isFinite(legacySession.updatedAt)
					? legacySession.updatedAt
					: Date.now()

			// One-time cleanup of migrated session key from legacy MMKV storage
			const remainingSessions = { ...sessions }
			delete remainingSessions[legacySessionKey]
			if (Object.keys(remainingSessions).length === 0) {
				storageImpl.removeItem(LEGACY_SYNC_STORAGE_KEY)
			} else {
				storageImpl.setItem(
					LEGACY_SYNC_STORAGE_KEY,
					JSON.stringify({
						...parsed,
						state: {
							...parsed.state,
							sessions: remainingSessions,
						},
					}),
				)
			}

			return {
				reconciledResults,
				isRateLimited,
				updatedAt,
				didMigrate: true,
			}
		} catch (e) {
			logger.warning(
				'解析旧版 external-playlist-sync-storage 失败，已安全忽略:',
				e,
			)
			return {
				reconciledResults: {},
				isRateLimited: false,
				updatedAt: Date.now(),
				didMigrate: false,
			}
		}
	}

	/**
	 * 创建或恢复持久化的 Import Job，并按歌曲稳定身份 (fingerprint + occurrence) 对齐所有条目。
	 */
	public createOrResumeJob(params: {
		source: ExternalPlaylistSource
		sourcePlaylistId: string
		tracks: GenericTrack[]
		playlistMetadata?: Partial<Omit<GenericPlaylist, 'coverUrl'>> & {
			coverUrl?: string | null
		}
		legacyStorage?: StateStorage
	}): ImportJobSnapshot {
		const {
			source,
			sourcePlaylistId,
			tracks,
			playlistMetadata,
			legacyStorage = zustandStorage,
		} = params
		const jobId = createImportJobId(source, sourcePlaylistId)
		if (this.isJobActivelyRunning(jobId)) {
			const runningSnapshot = this.getJobSnapshot(jobId)
			if (runningSnapshot) {
				return runningSnapshot
			}
		}

		const legacySessionKey = `${source}:${sourcePlaylistId}`
		const executor = this.db()
		const now = Date.now()

		let snapshot!: ImportJobSnapshot

		executor.withTransactionSync(() => {
			let existingJobRow = executor.getFirstSync<DbJobRow>(
				`SELECT * FROM external_import_jobs WHERE job_id = ?`,
				[jobId],
			)

			// 如果该任务之前已被正式保存过（saved_playlist_id IS NOT NULL）：
			// 说明之前的那次导入早已归档，或者其对应的本地歌单可能已被删除。
			// 此时用户进入 createOrResumeJob 是发起了【全新的导入/重新解析】，
			// 绝不能复用旧的已匹配结果，更不能复用指向旧歌单的 saved_playlist_id，
			// 必须彻底清除历史旧条目与旧结果，作为全新的导入重新开始。
			if (
				existingJobRow?.saved_playlist_id !== null &&
				existingJobRow?.saved_playlist_id !== undefined
			) {
				try {
					this.onCancelJob?.(jobId)
				} catch {
					// Ignore
				}
				executor.runSync(`DELETE FROM external_import_items WHERE job_id = ?`, [
					jobId,
				])
				executor.runSync(`DELETE FROM external_import_jobs WHERE job_id = ?`, [
					jobId,
				])
				this.consumeLegacySession(legacySessionKey, [], legacyStorage)
				existingJobRow = null
			}

			const existingItemRows = existingJobRow
				? executor.getAllSync<DbItemRow>(
						`SELECT * FROM external_import_items WHERE job_id = ? ORDER BY original_index ASC`,
						[jobId],
					)
				: []
			const existingItems = existingItemRows.map((r) => this.mapItemRow(r))

			// Consume legacy MMKV session if present
			const legacyMigration = this.consumeLegacySession(
				legacySessionKey,
				tracks,
				legacyStorage,
			)

			// Index existing persistent items by their stable itemId (jobId::fingerprint#occurrence)
			const existingByItemId = new Map<string, ImportItem>()
			for (const item of existingItems) {
				existingByItemId.set(item.itemId, item)
			}

			const occurrenceCounter = new Map<string, number>()
			const reconciledItems: ImportItem[] = []
			const validItemIds = new Set<string>()

			for (let i = 0; i < tracks.length; i++) {
				const track = tracks[i]
				const fingerprint = getTrackFingerprint(track)
				const occurrence = occurrenceCounter.get(fingerprint) ?? 0
				occurrenceCounter.set(fingerprint, occurrence + 1)

				const itemId = createImportItemId(jobId, fingerprint, occurrence)
				validItemIds.add(itemId)

				const existingItem = existingByItemId.get(itemId)
				const legacyResult = legacyMigration.reconciledResults[i]

				if (
					existingItem &&
					existingItem.status !== 'pending' &&
					existingItem.fingerprint === fingerprint
				) {
					reconciledItems.push({
						itemId,
						jobId,
						fingerprint,
						originalIndex: i,
						originalTrack: track,
						status: existingItem.status,
						matchedVideo: existingItem.matchedVideo,
						...(existingItem.errorType
							? { errorType: existingItem.errorType }
							: {}),
						...(existingItem.errorMessage
							? { errorMessage: existingItem.errorMessage }
							: {}),
						updatedAt: existingItem.updatedAt,
					})
				} else if (legacyResult && isMatchResultForTrack(legacyResult, track)) {
					const legacyStatus = getMatchResultStatus(legacyResult)
					reconciledItems.push({
						itemId,
						jobId,
						fingerprint,
						originalIndex: i,
						originalTrack: track,
						status: legacyStatus,
						matchedVideo: legacyResult.matchedVideo ?? null,
						...(legacyResult.errorType
							? { errorType: legacyResult.errorType }
							: {}),
						...(legacyResult.errorMessage
							? { errorMessage: legacyResult.errorMessage }
							: {}),
						updatedAt: legacyMigration.updatedAt,
					})
				} else {
					reconciledItems.push({
						itemId,
						jobId,
						fingerprint,
						originalIndex: i,
						originalTrack: track,
						status: 'pending',
						matchedVideo: null,
						updatedAt: existingItem?.updatedAt ?? now,
					})
				}
			}

			const stats = computeImportJobStats(reconciledItems, tracks.length)
			const baseMetadata = existingJobRow
				? this.mapJobRow(existingJobRow).playlistMetadata
				: buildDefaultPlaylistMetadata(source, sourcePlaylistId, tracks.length)
			const resolvedMetadata: GenericPlaylist = playlistMetadata
				? {
						...baseMetadata,
						...playlistMetadata,
						coverUrl: playlistMetadata.coverUrl ?? baseMetadata.coverUrl,
						trackCount: playlistMetadata.trackCount ?? tracks.length,
						author: playlistMetadata.author ?? baseMetadata.author,
					}
				: baseMetadata

			let nextStatus: ImportJobStatus
			const hasAnyAttempted =
				stats.processedCount > 0 ||
				stats.errorCount > 0 ||
				stats.rateLimitedCount > 0

			if (
				stats.rateLimitedCount > 0 ||
				(legacyMigration.didMigrate && legacyMigration.isRateLimited) ||
				(existingJobRow?.status === 'rate_limited' && stats.pendingCount > 0)
			) {
				nextStatus = 'rate_limited'
			} else if (
				stats.totalCount > 0 &&
				stats.processedCount === stats.totalCount
			) {
				nextStatus = 'completed'
			} else if (existingJobRow?.status === 'running') {
				// Prevent fake running state on recovery
				nextStatus = 'paused'
			} else if (
				existingJobRow?.status === 'paused' ||
				existingJobRow?.status === 'failed' ||
				existingJobRow?.status === 'cancelled'
			) {
				nextStatus = hasAnyAttempted ? existingJobRow.status : 'pending'
			} else if (hasAnyAttempted) {
				nextStatus = 'paused'
			} else {
				nextStatus = 'pending'
			}

			const createdAt = existingJobRow?.created_at ?? now
			const savedPlaylistId = existingJobRow?.saved_playlist_id ?? null
			const lastProcessedAt =
				existingJobRow?.last_processed_at ??
				(hasAnyAttempted ? legacyMigration.updatedAt : null)

			executor.runSync(
				`INSERT INTO external_import_jobs (
					job_id, source, source_playlist_id, playlist_metadata,
					total_count, processed_count, matched_count, unmatched_count, error_count,
					status, saved_playlist_id, created_at, updated_at, last_processed_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(job_id) DO UPDATE SET
					playlist_metadata = excluded.playlist_metadata,
					total_count = excluded.total_count,
					processed_count = excluded.processed_count,
					matched_count = excluded.matched_count,
					unmatched_count = excluded.unmatched_count,
					error_count = excluded.error_count,
					status = excluded.status,
					saved_playlist_id = excluded.saved_playlist_id,
					updated_at = excluded.updated_at,
					last_processed_at = excluded.last_processed_at`,
				[
					jobId,
					source,
					sourcePlaylistId,
					JSON.stringify(resolvedMetadata),
					stats.totalCount,
					stats.processedCount,
					stats.matchedCount,
					stats.unmatchedCount,
					stats.errorCount,
					nextStatus,
					savedPlaylistId,
					createdAt,
					now,
					lastProcessedAt,
				],
			)

			// Delete stale items that no longer belong to the current playlist tracks
			for (const oldItem of existingItems) {
				if (!validItemIds.has(oldItem.itemId)) {
					executor.runSync(
						`DELETE FROM external_import_items WHERE item_id = ?`,
						[oldItem.itemId],
					)
				}
			}

			// Upsert all current items
			for (const item of reconciledItems) {
				executor.runSync(
					`INSERT INTO external_import_items (
						item_id, job_id, fingerprint, original_index, original_track,
						status, matched_video, error_type, error_message, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT(item_id) DO UPDATE SET
						original_index = excluded.original_index,
						original_track = excluded.original_track,
						status = excluded.status,
						matched_video = excluded.matched_video,
						error_type = excluded.error_type,
						error_message = excluded.error_message,
						updated_at = excluded.updated_at`,
					[
						item.itemId,
						item.jobId,
						item.fingerprint,
						item.originalIndex,
						JSON.stringify(item.originalTrack),
						item.status,
						item.matchedVideo ? JSON.stringify(item.matchedVideo) : null,
						item.errorType ?? null,
						item.errorMessage ?? null,
						item.updatedAt,
					],
				)
			}

			snapshot = {
				job: {
					jobId,
					source,
					sourcePlaylistId,
					playlistMetadata: resolvedMetadata,
					totalCount: stats.totalCount,
					processedCount: stats.processedCount,
					matchedCount: stats.matchedCount,
					unmatchedCount: stats.unmatchedCount,
					errorCount: stats.errorCount,
					rateLimitedCount: stats.rateLimitedCount,
					status: nextStatus,
					savedPlaylistId,
					createdAt,
					updatedAt: now,
					lastProcessedAt,
				},
				items: reconciledItems,
			}
		})

		this.notifyChanges()
		return snapshot
	}

	public updateJobStatus(
		jobId: string,
		status: ImportJobStatus,
	): ImportJobSnapshot | null {
		const executor = this.db()
		const now = Date.now()
		executor.withTransactionSync(() => {
			if (status === 'running') {
				// Clear previous rate_limited marker on items when user resumes matching
				executor.runSync(
					`UPDATE external_import_items
					 SET status = 'pending', error_type = NULL, error_message = NULL, updated_at = ?
					 WHERE job_id = ? AND status = 'rate_limited'`,
					[now, jobId],
				)
			}
			executor.runSync(
				`UPDATE external_import_jobs SET status = ?, updated_at = ? WHERE job_id = ?`,
				[status, now, jobId],
			)
		})
		this.notifyChanges()
		return this.getJobSnapshot(jobId)
	}

	public updateItemResult(
		jobId: string,
		originalIndex: number,
		result: MatchResult,
	): ImportJobSnapshot | null {
		const executor = this.db()
		const now = Date.now()

		executor.withTransactionSync(() => {
			const itemRow = executor.getFirstSync<DbItemRow>(
				`SELECT * FROM external_import_items WHERE job_id = ? AND original_index = ?`,
				[jobId, originalIndex],
			)
			if (!itemRow) return

			const currentItem = this.mapItemRow(itemRow)
			if (!isMatchResultForTrack(result, currentItem.originalTrack)) {
				logger.warning(
					`拒绝写入不匹配的歌曲结果: jobId=${jobId}, index=${originalIndex}`,
				)
				return
			}

			const nextItemStatus = getMatchResultStatus(result)
			executor.runSync(
				`UPDATE external_import_items
				 SET status = ?, matched_video = ?, error_type = ?, error_message = ?, updated_at = ?
				 WHERE item_id = ?`,
				[
					nextItemStatus,
					result.matchedVideo ? JSON.stringify(result.matchedVideo) : null,
					result.errorType ?? null,
					result.errorMessage ?? null,
					now,
					currentItem.itemId,
				],
			)

			const allItemRows = executor.getAllSync<DbItemRow>(
				`SELECT * FROM external_import_items WHERE job_id = ? ORDER BY original_index ASC`,
				[jobId],
			)
			const allItems = allItemRows.map((r) => this.mapItemRow(r))
			const jobRow = executor.getFirstSync<DbJobRow>(
				`SELECT * FROM external_import_jobs WHERE job_id = ?`,
				[jobId],
			)
			if (!jobRow) return

			const stats = computeImportJobStats(allItems, jobRow.total_count)
			let nextJobStatus: ImportJobStatus = jobRow.status
			if (nextItemStatus === 'rate_limited') {
				nextJobStatus = 'rate_limited'
			} else if (
				jobRow.status !== 'running' &&
				stats.totalCount > 0 &&
				stats.processedCount === stats.totalCount
			) {
				nextJobStatus = 'completed'
			}

			executor.runSync(
				`UPDATE external_import_jobs
				 SET processed_count = ?, matched_count = ?, unmatched_count = ?, error_count = ?,
				     status = ?, updated_at = ?, last_processed_at = ?
				 WHERE job_id = ?`,
				[
					stats.processedCount,
					stats.matchedCount,
					stats.unmatchedCount,
					stats.errorCount,
					nextJobStatus,
					now,
					now,
					jobId,
				],
			)

			// 如果该任务已经正式保存为本地歌单，同步更新本地歌单中的对应歌曲音源映射与元数据
			if (jobRow.saved_playlist_id) {
				const mappingRow = executor.getFirstSync<DbTrackMappingRow>(
					`SELECT track_id FROM external_track_mappings WHERE playlist_id = ? AND original_index = ?`,
					[jobRow.saved_playlist_id, originalIndex],
				)
				if (mappingRow) {
					this.updateTrackMatchInPlace(mappingRow.track_id, result)
				}
			}
		})

		this.notifyChanges()
		return this.getJobSnapshot(jobId)
	}

	public resetJob(jobId: string): ImportJobSnapshot | null {
		const executor = this.db()
		const now = Date.now()
		executor.withTransactionSync(() => {
			executor.runSync(
				`UPDATE external_import_items
				 SET status = 'pending', matched_video = NULL, error_type = NULL, error_message = NULL, updated_at = ?
				 WHERE job_id = ?`,
				[now, jobId],
			)
			executor.runSync(
				`UPDATE external_import_jobs
				 SET processed_count = 0, matched_count = 0, unmatched_count = 0, error_count = 0,
				     status = 'pending', saved_playlist_id = NULL, updated_at = ?, last_processed_at = NULL
				 WHERE job_id = ?`,
				[now, jobId],
			)
		})
		this.notifyChanges()
		return this.getJobSnapshot(jobId)
	}

	/**
	 * 阶段 5：列出所有尚未正式转换为本地歌单的导入中草稿任务（Draft Importing Playlists）。
	 * 已正式保存（saved_playlist_id IS NOT NULL）或已取消（status = 'cancelled'）的任务不会作为草稿重复出现在歌单列表。
	 */
	public listActiveDraftJobs(): ImportJob[] {
		this.cleanupOrphanedJobs()
		const executor = this.db()
		const rows = executor.getAllSync<DbJobRow>(
			`SELECT * FROM external_import_jobs
			 WHERE saved_playlist_id IS NULL AND status != 'cancelled'
			 ORDER BY updated_at DESC`,
		)
		return rows.map((row) => {
			const rateLimitedRow = executor.getFirstSync<{ cnt: number }>(
				`SELECT COUNT(*) AS cnt FROM external_import_items WHERE job_id = ? AND status = 'rate_limited'`,
				[row.job_id],
			)
			return this.mapJobRow(row, rateLimitedRow?.cnt ?? 0)
		})
	}

	/**
	 * 阶段 5：当用户确认并将导入任务正式保存为本地歌单后，记录 saved_playlist_id 并标记为 completed，
	 * 使其从“导入中的草稿歌单”转为正式本地歌单，不再与正式歌单重复显示。
	 */
	public markJobConfirmed(
		jobId: string,
		savedPlaylistId: number,
	): ImportJobSnapshot | null {
		const executor = this.db()
		const now = Date.now()
		executor.runSync(
			`UPDATE external_import_jobs
			 SET status = 'completed', saved_playlist_id = ?, updated_at = ?
			 WHERE job_id = ?`,
			[savedPlaylistId, now, jobId],
		)
		this.notifyChanges()
		return this.getJobSnapshot(jobId)
	}

	public deleteJob(
		jobId: string,
		legacyStorage: StateStorage = zustandStorage,
	): void {
		const executor = this.db()
		const jobRow = executor.getFirstSync<DbJobRow>(
			`SELECT * FROM external_import_jobs WHERE job_id = ?`,
			[jobId],
		)
		executor.withTransactionSync(() => {
			executor.runSync(`DELETE FROM external_import_items WHERE job_id = ?`, [
				jobId,
			])
			executor.runSync(`DELETE FROM external_import_jobs WHERE job_id = ?`, [
				jobId,
			])
		})
		if (jobRow) {
			this.consumeLegacySession(
				`${jobRow.source}:${jobRow.source_playlist_id}`,
				[],
				legacyStorage,
			)
		}
		this.notifyChanges()
	}

	/**
	 * 阶段 6：写入或更新正式歌单中外部歌曲的映射记录。
	 */
	public upsertTrackMapping(
		input: UpsertExternalTrackMappingInput,
	): ExternalTrackMappingRecord {
		const executor = this.db()
		const now = Date.now()
		const fingerprint = getTrackFingerprint(input.originalTrack)
		const matchedVideo = input.matchedVideo ?? null

		executor.runSync(
			`INSERT INTO external_track_mappings (
				track_id, playlist_id, job_id, item_id, source, source_playlist_id,
				original_index, track_fingerprint, original_title, original_translated_title,
				original_artists_json, original_album, original_duration, original_cover_url,
				match_status, matched_bvid, matched_title, matched_author, matched_mid,
				matched_pic, matched_duration, matched_video_json,
				error_type, error_message, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(track_id) DO UPDATE SET
				playlist_id = excluded.playlist_id,
				job_id = COALESCE(excluded.job_id, external_track_mappings.job_id),
				item_id = COALESCE(excluded.item_id, external_track_mappings.item_id),
				source = excluded.source,
				source_playlist_id = excluded.source_playlist_id,
				original_index = excluded.original_index,
				track_fingerprint = excluded.track_fingerprint,
				original_title = excluded.original_title,
				original_translated_title = excluded.original_translated_title,
				original_artists_json = excluded.original_artists_json,
				original_album = excluded.original_album,
				original_duration = excluded.original_duration,
				original_cover_url = excluded.original_cover_url,
				match_status = excluded.match_status,
				matched_bvid = excluded.matched_bvid,
				matched_title = excluded.matched_title,
				matched_author = excluded.matched_author,
				matched_mid = excluded.matched_mid,
				matched_pic = excluded.matched_pic,
				matched_duration = excluded.matched_duration,
				matched_video_json = excluded.matched_video_json,
				error_type = excluded.error_type,
				error_message = excluded.error_message,
				updated_at = excluded.updated_at`,
			[
				input.trackId,
				input.playlistId,
				input.jobId ?? null,
				input.itemId ?? null,
				input.externalSource,
				input.externalPlaylistId,
				input.originalIndex ?? 0,
				fingerprint,
				input.originalTrack.title,
				input.originalTrack.translatedTitle ?? null,
				JSON.stringify(input.originalTrack.artists ?? []),
				input.originalTrack.album ?? '',
				input.originalTrack.duration ?? 0,
				input.originalTrack.coverUrl ?? null,
				input.matchStatus,
				matchedVideo?.bvid ?? null,
				matchedVideo?.title ?? null,
				matchedVideo?.author ?? null,
				matchedVideo?.mid ?? null,
				matchedVideo?.pic ?? null,
				matchedVideo?.duration ?? null,
				matchedVideo ? JSON.stringify(matchedVideo) : null,
				input.errorType ?? null,
				input.errorMessage ?? null,
				now,
				now,
			],
		)

		this.notifyChanges()
		const saved = this.getTrackMapping(input.trackId)
		if (!saved) {
			throw new Error(`写入外部歌曲映射失败: trackId=${input.trackId}`)
		}
		return saved
	}

	public upsertTrackMappings(inputs: UpsertExternalTrackMappingInput[]): void {
		if (inputs.length === 0) return
		for (const input of inputs) {
			this.upsertTrackMapping(input)
		}
	}

	public getTrackMapping(trackId: number): ExternalTrackMappingRecord | null {
		const executor = this.db()
		const row = executor.getFirstSync<DbTrackMappingRow>(
			`SELECT * FROM external_track_mappings WHERE track_id = ?`,
			[trackId],
		)
		return row ? this.mapTrackMappingRow(row) : null
	}

	public getPlaylistTrackMappings(
		playlistId: number,
	): ExternalTrackMappingRecord[] {
		const executor = this.db()
		const rows = executor.getAllSync<DbTrackMappingRow>(
			`SELECT * FROM external_track_mappings WHERE playlist_id = ? ORDER BY original_index ASC, track_id ASC`,
			[playlistId],
		)
		return rows.map((row) => this.mapTrackMappingRow(row))
	}

	/**
	 * 阶段 6：在正式歌单中原地更新某首歌曲的 B 站视频匹配结果：
	 * - 只更新 external_track_mappings 与 bilibili_metadata（bvid / video_is_valid / main_track_title）；
	 * - 绝不修改 tracks 表的 title / artist_id / duration / cover_url；
	 * - 绝不修改 playlist_tracks 表的 sort_key（保持歌单原有顺序）。
	 */
	public updateTrackMatchInPlace(
		trackId: number,
		result: MatchResult,
		fallbackContext?: {
			playlistId: number
			externalSource?: ExternalPlaylistSource
			externalPlaylistId?: string
			originalIndex?: number
			originalTrack?: GenericTrack
		},
	): ExternalTrackMappingRecord | null {
		const executor = this.db()
		const now = Date.now()
		let updatedMapping: ExternalTrackMappingRecord | null = null

		executor.withTransactionSync(() => {
			const existingRow = executor.getFirstSync<DbTrackMappingRow>(
				`SELECT * FROM external_track_mappings WHERE track_id = ?`,
				[trackId],
			)

			const nextStatus = getMatchResultStatus(result)
			const matchedVideo = result.matchedVideo ?? null

			if (existingRow) {
				const existing = this.mapTrackMappingRow(existingRow)
				const keepPreviousVideo =
					!matchedVideo &&
					Boolean(existing.matchedBvid && existing.matchedVideo)
				const effectiveVideo = keepPreviousVideo
					? existing.matchedVideo
					: matchedVideo
				const effectiveBvid = keepPreviousVideo
					? existing.matchedBvid
					: (matchedVideo?.bvid ?? null)

				executor.runSync(
					`UPDATE external_track_mappings
					 SET match_status = ?,
					     matched_bvid = ?,
					     matched_title = ?,
					     matched_author = ?,
					     matched_mid = ?,
					     matched_pic = ?,
					     matched_duration = ?,
					     matched_video_json = ?,
					     error_type = ?,
					     error_message = ?,
					     updated_at = ?
					 WHERE track_id = ?`,
					[
						nextStatus,
						effectiveBvid,
						effectiveVideo?.title ?? null,
						effectiveVideo?.author ?? null,
						effectiveVideo?.mid ?? null,
						effectiveVideo?.pic ?? null,
						effectiveVideo?.duration ?? null,
						effectiveVideo ? JSON.stringify(effectiveVideo) : null,
						result.errorType ?? null,
						result.errorMessage ?? null,
						now,
						trackId,
					],
				)
			} else if (fallbackContext) {
				const origTrack = fallbackContext.originalTrack ?? result.track
				this.upsertTrackMapping({
					trackId,
					playlistId: fallbackContext.playlistId,
					externalSource: fallbackContext.externalSource ?? 'netease',
					externalPlaylistId:
						fallbackContext.externalPlaylistId ??
						String(fallbackContext.playlistId),
					originalIndex: fallbackContext.originalIndex ?? 0,
					originalTrack: origTrack,
					matchStatus: nextStatus,
					matchedVideo,
					errorType: result.errorType ?? null,
					errorMessage: result.errorMessage ?? null,
				})
			}

			// Update bilibili_metadata in-place if present
			try {
				if (matchedVideo) {
					const cleanVideoTitle = matchedVideo.title.replace(
						/<em[^>]*>|<\/em>/g,
						'',
					)
					const mainTrackTitle = `音源: ${cleanVideoTitle}${matchedVideo.author ? ` · UP: ${matchedVideo.author}` : ''}`
					executor.runSync(
						`UPDATE bilibili_metadata
						 SET bvid = ?, cid = NULL, is_multi_page = 0, video_is_valid = 1, main_track_title = ?
						 WHERE track_id = ?`,
						[matchedVideo.bvid, mainTrackTitle, trackId],
					)
				} else {
					const statusHint =
						nextStatus === 'rate_limited'
							? '[未匹配音源] Bilibili 请求受限，请稍后重试'
							: nextStatus === 'error'
								? `[未匹配音源] ${result.errorMessage ?? '网络或超时异常，可重试'}`
								: '[未匹配音源] 未找到匹配视频，点击手动匹配'
					executor.runSync(
						`UPDATE bilibili_metadata
						 SET video_is_valid = 1, main_track_title = ?
						 WHERE track_id = ? AND (bvid IS NULL OR bvid = '')`,
						[statusHint, trackId],
					)
				}
			} catch {
				// Ignore if bilibili_metadata table does not exist in isolated unit test DB
			}

			const refreshed = executor.getFirstSync<DbTrackMappingRow>(
				`SELECT * FROM external_track_mappings WHERE track_id = ?`,
				[trackId],
			)
			updatedMapping = refreshed ? this.mapTrackMappingRow(refreshed) : null
		})

		this.notifyChanges()
		return updatedMapping
	}

	private playlistViewModes = new Map<number, ExternalPlaylistViewMode>()
	private playlistViewModesHydrated = false

	private ensurePlaylistViewModesHydrated(): void {
		if (this.playlistViewModesHydrated) return
		this.playlistViewModesHydrated = true
		try {
			const raw = zustandStorage.getItem(PLAYLIST_VIEW_MODES_STORAGE_KEY)
			if (!raw || typeof raw !== 'string') return
			const parsed = JSON.parse(raw) as Record<string, unknown>
			for (const [key, val] of Object.entries(parsed)) {
				const id = Number(key)
				if (
					Number.isInteger(id) &&
					id > 0 &&
					(val === 'original' || val === 'bilibili')
				) {
					this.playlistViewModes.set(id, val)
				}
			}
		} catch {
			// Ignore malformed storage
		}
	}

	private persistPlaylistViewModes(): void {
		try {
			const record: Record<string, ExternalPlaylistViewMode> = {}
			for (const [id, mode] of this.playlistViewModes.entries()) {
				if (mode === 'bilibili') {
					record[String(id)] = mode
				}
			}
			zustandStorage.setItem(
				PLAYLIST_VIEW_MODES_STORAGE_KEY,
				JSON.stringify(record),
			)
		} catch {
			// Ignore storage errors
		}
	}

	public getPlaylistViewMode(playlistId: number): ExternalPlaylistViewMode {
		this.ensurePlaylistViewModesHydrated()
		return this.playlistViewModes.get(playlistId) ?? 'original'
	}

	public setPlaylistViewMode(
		playlistId: number,
		mode: ExternalPlaylistViewMode,
	): ExternalPlaylistViewMode {
		this.ensurePlaylistViewModesHydrated()
		if (mode === 'original') {
			this.playlistViewModes.delete(playlistId)
		} else {
			this.playlistViewModes.set(playlistId, mode)
		}
		this.persistPlaylistViewModes()
		this.notifyChanges()
		return mode
	}

	public togglePlaylistViewMode(playlistId: number): ExternalPlaylistViewMode {
		const current = this.getPlaylistViewMode(playlistId)
		const next: ExternalPlaylistViewMode =
			current === 'original' ? 'bilibili' : 'original'
		return this.setPlaylistViewMode(playlistId, next)
	}

	public resolveTrackForPlayback(
		track: Track,
		explicitPlaylistId?: number,
	): Track {
		const playlistId =
			explicitPlaylistId ??
			parseExternalPlaylistIdFromUniqueKey(track.uniqueKey)
		if (!playlistId) {
			return track
		}
		const mode = this.getPlaylistViewMode(playlistId)
		if (mode !== 'bilibili') {
			return track
		}
		let mapping: ExternalTrackMappingRecord | null = null
		try {
			mapping = this.getTrackMapping(track.id)
		} catch {
			mapping = null
		}
		return applyPlaylistViewModeToTrack(track, mode, mapping)
	}

	/**
	 * 当本地歌单被删除时调用：彻底清理该歌单关联的所有外部导入任务、草稿条目、映射记录与旧缓存。
	 * 确保再次导入该外部歌单时不会遗留旧数据或导致状态混乱。
	 */
	public deleteJobsForPlaylist(
		playlistId: number,
		legacyStorage: StateStorage = zustandStorage,
	): void {
		const executor = this.db()
		try {
			this.onCancelPlaylist?.(playlistId)
		} catch {
			// Ignore
		}

		executor.withTransactionSync(() => {
			const jobRows = executor.getAllSync<DbJobRow>(
				`SELECT * FROM external_import_jobs WHERE saved_playlist_id = ?`,
				[playlistId],
			)
			for (const job of jobRows) {
				try {
					this.onCancelJob?.(job.job_id)
				} catch {
					// Ignore
				}
				executor.runSync(`DELETE FROM external_import_items WHERE job_id = ?`, [
					job.job_id,
				])
				executor.runSync(`DELETE FROM external_import_jobs WHERE job_id = ?`, [
					job.job_id,
				])
				this.consumeLegacySession(
					`${job.source}:${job.source_playlist_id}`,
					[],
					legacyStorage,
				)
			}
			executor.runSync(
				`DELETE FROM external_track_mappings WHERE playlist_id = ?`,
				[playlistId],
			)
			this.playlistViewModes.delete(playlistId)
		})
		this.persistPlaylistViewModes()
		this.notifyChanges()
	}

	public deletePlaylistTrackMappings(playlistId: number): void {
		this.deleteJobsForPlaylist(playlistId)
	}

	public clearAllJobsForTesting(): void {
		const executor = this.db()
		executor.withTransactionSync(() => {
			executor.runSync(`DELETE FROM external_track_mappings`)
			executor.runSync(`DELETE FROM external_import_items`)
			executor.runSync(`DELETE FROM external_import_jobs`)
		})
		this.playlistViewModes.clear()
		this.playlistViewModesHydrated = true
		try {
			zustandStorage.removeItem(PLAYLIST_VIEW_MODES_STORAGE_KEY)
		} catch {
			// Ignore
		}
		this.notifyChanges()
	}
}

export const externalImportJobService = new ExternalImportJobService()

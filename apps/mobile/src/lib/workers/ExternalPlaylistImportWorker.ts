import { isBilibiliRateLimitError } from '@/lib/errors/thirdparty/bilibili'
import {
	type ExternalImportJobService,
	type ExternalTrackMappingRecord,
	externalImportJobService,
	type ImportJobSnapshot,
	type ImportJobStatus,
} from '@/lib/services/externalImportJobService'
import {
	DEFAULT_REQUEST_DELAY_MS,
	type ExternalPlaylistService,
	externalPlaylistService,
	getMatchResultStatus,
} from '@/lib/services/externalPlaylistService'
import type { GenericTrack } from '@/types/external_playlist'
import log from '@/utils/log'

const logger = log.extend('Workers.ExternalPlaylistImport')

export type ImportWorkerEventType =
	| 'started'
	| 'progress'
	| 'paused'
	| 'rate_limited'
	| 'completed'
	| 'cancelled'
	| 'failed'
	| 'updated'

export interface ImportWorkerEvent {
	type: ImportWorkerEventType
	jobId: string
	snapshot: ImportJobSnapshot | null
	etaSeconds: number | null
	currentTrackTitle: string | null
	error?: Error
}

export interface ImportWorkerRunOptions {
	trackIndexes?: number[]
	requestDelayMs?: number
	searchTimeoutMs?: number
}

export interface ImportWorkerRunOutcome {
	status: ImportJobStatus
	snapshot: ImportJobSnapshot | null
	error?: Error
}

export interface PlaylistRematchOptions {
	mode?: 'unfinished' | 'failed' | 'all'
	trackIds?: number[]
	requestDelayMs?: number
	searchTimeoutMs?: number
	onProgress?: (
		current: number,
		total: number,
		mapping: ExternalTrackMappingRecord | null,
	) => void
}

export interface PlaylistRematchOutcome {
	status: 'completed' | 'paused' | 'rate_limited' | 'failed'
	processed: number
	total: number
	matched: number
	unmatched: number
	error: number
	rateLimited: number
	errorCause?: Error
}

export function formatTrackDisplayTitle(track?: GenericTrack | null): string {
	if (!track) return ''
	const artistText =
		Array.isArray(track.artists) && track.artists.length > 0
			? ` - ${track.artists.join(' / ')}`
			: ''
	return `${track.title}${artistText}`
}

export function selectJobIndexesToProcess(snapshot: ImportJobSnapshot): {
	indexesToProcess: number[]
	didResetAll: boolean
} {
	const pendingIndexes: number[] = []
	const errorIndexes: number[] = []
	const unmatchedIndexes: number[] = []

	for (const item of snapshot.items) {
		if (item.status === 'pending' || item.status === 'rate_limited') {
			pendingIndexes.push(item.originalIndex)
		} else if (item.status === 'error') {
			errorIndexes.push(item.originalIndex)
		} else if (item.status === 'unmatched') {
			unmatchedIndexes.push(item.originalIndex)
		}
	}

	if (pendingIndexes.length > 0) {
		return {
			indexesToProcess: [...pendingIndexes, ...errorIndexes].sort(
				(a, b) => a - b,
			),
			didResetAll: false,
		}
	}
	if (errorIndexes.length > 0) {
		return {
			indexesToProcess: errorIndexes,
			didResetAll: false,
		}
	}
	if (unmatchedIndexes.length > 0) {
		return {
			indexesToProcess: unmatchedIndexes,
			didResetAll: false,
		}
	}

	return {
		indexesToProcess: snapshot.items.map((item) => item.originalIndex),
		didResetAll: true,
	}
}

export class ExternalPlaylistImportWorker {
	private activeJobId: string | null = null
	private activeRematchPlaylistId: number | null = null
	private abortController: AbortController | null = null
	private activeRunPromise: Promise<ImportWorkerRunOutcome> | null = null
	private activeRematchPromise: Promise<PlaylistRematchOutcome> | null = null
	private readonly etaSecondsByJobId = new Map<string, number | null>()
	private readonly currentTrackByJobId = new Map<string, string | null>()
	private readonly listeners = new Set<(event: ImportWorkerEvent) => void>()

	constructor(
		private readonly jobService: ExternalImportJobService = externalImportJobService,
		private readonly playlistService: ExternalPlaylistService = externalPlaylistService,
	) {
		this.jobService.setActiveJobChecker((jobId) => this.isJobRunning(jobId))
		this.jobService.setWorkerCancellationHooks({
			cancelJob: (jobId) => this.cancel(jobId),
			cancelPlaylist: (playlistId) => this.pausePlaylistRematch(playlistId),
		})
	}

	public isJobRunning(jobId: string): boolean {
		return (
			this.activeJobId === jobId &&
			Boolean(this.abortController && !this.abortController.signal.aborted)
		)
	}

	public isPlaylistRematchRunning(playlistId: number): boolean {
		return (
			this.activeRematchPlaylistId === playlistId &&
			Boolean(this.abortController && !this.abortController.signal.aborted)
		)
	}

	public getActiveJobId(): string | null {
		return this.activeJobId
	}

	public getActiveRematchPlaylistId(): number | null {
		return this.activeRematchPlaylistId
	}

	public getEtaSeconds(jobId: string): number | null {
		return this.etaSecondsByJobId.get(jobId) ?? null
	}

	public getCurrentTrackTitle(jobId: string): string | null {
		return this.currentTrackByJobId.get(jobId) ?? null
	}

	public subscribe(listener: (event: ImportWorkerEvent) => void): () => void {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	public notifyUpdated(
		jobId: string,
		type: ImportWorkerEventType = 'updated',
		error?: Error,
	): void {
		const snapshot = this.jobService.getJobSnapshot(jobId)
		const etaSeconds = this.getEtaSeconds(jobId)
		const currentTrackTitle = this.getCurrentTrackTitle(jobId)
		const event: ImportWorkerEvent = {
			type,
			jobId,
			snapshot,
			etaSeconds,
			currentTrackTitle,
			...(error ? { error } : {}),
		}
		for (const listener of this.listeners) {
			try {
				listener(event)
			} catch (e) {
				logger.error('Worker listener threw an error:', e)
			}
		}
	}

	/**
	 * 启动或继续执行指定的 Import Job。
	 * - 同一 jobId 已在运行时：幂等返回当前执行 Promise，绝不重复启动；
	 * - 其他 jobId 正在运行时：自动暂停旧任务并等待其安全退出后再启动新任务，严格保证全局单任务单并发。
	 */
	public async start(
		jobId: string,
		options?: ImportWorkerRunOptions,
	): Promise<ImportWorkerRunOutcome> {
		if (this.isJobRunning(jobId) && this.activeRunPromise) {
			logger.debug(`Job ${jobId} 已在运行中，忽略重复启动`)
			return this.activeRunPromise
		}

		if (this.activeRematchPlaylistId !== null && this.activeRematchPromise) {
			this.pausePlaylistRematch(this.activeRematchPlaylistId)
			try {
				await this.activeRematchPromise
			} catch {
				// Ignore
			}
		}

		if (
			this.activeJobId &&
			this.activeJobId !== jobId &&
			this.activeRunPromise
		) {
			const previousJobId = this.activeJobId
			const previousPromise = this.activeRunPromise
			logger.info(
				`启动新任务 ${jobId} 前，先暂停正在运行的任务 ${previousJobId}`,
			)
			this.pause(previousJobId)
			try {
				await previousPromise
			} catch {
				// Ignore previous run cancellation
			}
		}

		let initialSnapshot = this.jobService.getJobSnapshot(jobId)
		if (!initialSnapshot || initialSnapshot.items.length === 0) {
			return {
				status: initialSnapshot?.job.status ?? 'completed',
				snapshot: initialSnapshot,
			}
		}

		let indexesToProcess: number[]
		if (options?.trackIndexes && options.trackIndexes.length > 0) {
			indexesToProcess = options.trackIndexes
		} else {
			const selection = selectJobIndexesToProcess(initialSnapshot)
			indexesToProcess = selection.indexesToProcess
			if (selection.didResetAll) {
				initialSnapshot = this.jobService.resetJob(jobId) ?? initialSnapshot
			}
		}

		const controller = new AbortController()
		this.activeJobId = jobId
		this.abortController = controller

		const delayMs = options?.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS
		this.etaSecondsByJobId.set(
			jobId,
			(indexesToProcess.length * delayMs) / 1000,
		)
		const firstTrackIndex = indexesToProcess[0]
		const firstTrack =
			firstTrackIndex !== undefined
				? initialSnapshot.items[firstTrackIndex]?.originalTrack
				: undefined
		this.currentTrackByJobId.set(
			jobId,
			firstTrack ? formatTrackDisplayTitle(firstTrack) : null,
		)

		this.jobService.updateJobStatus(jobId, 'running')
		this.notifyUpdated(jobId, 'started')

		const tracks = initialSnapshot.items.map((item) => item.originalTrack)
		const sessionStartTime = Date.now()

		const runPromise = (async (): Promise<ImportWorkerRunOutcome> => {
			try {
				const result = await this.playlistService.matchExternalPlaylist(
					tracks,
					(current, total, matchResult, trackIndex) => {
						this.jobService.updateItemResult(jobId, trackIndex, matchResult)

						const nextIndexInQueue = indexesToProcess[current]
						const nextTrack =
							nextIndexInQueue !== undefined
								? tracks[nextIndexInQueue]
								: matchResult.track
						this.currentTrackByJobId.set(
							jobId,
							nextTrack ? formatTrackDisplayTitle(nextTrack) : null,
						)

						if (getMatchResultStatus(matchResult) !== 'rate_limited') {
							const elapsed = Date.now() - sessionStartTime
							if (current > 0) {
								const avgTimePerItem = elapsed / current
								const remainingItems = Math.max(total - current, 0)
								this.etaSecondsByJobId.set(
									jobId,
									(avgTimePerItem * remainingItems) / 1000,
								)
							}
						}
						this.notifyUpdated(jobId, 'progress')
					},
					{
						trackIndexes: indexesToProcess,
						signal: controller.signal,
						requestDelayMs: options?.requestDelayMs,
						searchTimeoutMs: options?.searchTimeoutMs,
					},
				)

				this.etaSecondsByJobId.delete(jobId)
				this.currentTrackByJobId.delete(jobId)

				if (result.isErr()) {
					const err = result.error
					if (isBilibiliRateLimitError(err)) {
						const updated = this.jobService.updateJobStatus(
							jobId,
							'rate_limited',
						)
						this.notifyUpdated(jobId, 'rate_limited', err)
						return {
							status: 'rate_limited',
							snapshot: updated,
							error: err,
						}
					}

					if (err.message === 'Aborted') {
						const latest = this.jobService.getJobSnapshot(jobId)
						const statusAfterAbort: ImportJobStatus =
							latest?.job.status === 'cancelled'
								? 'cancelled'
								: latest?.job.status === 'rate_limited'
									? 'rate_limited'
									: 'paused'
						const updated = this.jobService.updateJobStatus(
							jobId,
							statusAfterAbort,
						)
						this.notifyUpdated(
							jobId,
							statusAfterAbort === 'cancelled' ? 'cancelled' : 'paused',
						)
						return {
							status: statusAfterAbort,
							snapshot: updated,
						}
					}

					const updated = this.jobService.updateJobStatus(jobId, 'failed')
					this.notifyUpdated(jobId, 'failed', err)
					return {
						status: 'failed',
						snapshot: updated,
						error: err,
					}
				}

				const latest = this.jobService.getJobSnapshot(jobId)
				const finalStatus: ImportJobStatus =
					latest &&
					latest.job.totalCount > 0 &&
					latest.job.processedCount === latest.job.totalCount
						? 'completed'
						: latest && latest.job.errorCount > 0
							? 'paused'
							: 'completed'
				const updated = this.jobService.updateJobStatus(jobId, finalStatus)
				this.notifyUpdated(jobId, 'completed')
				return {
					status: finalStatus,
					snapshot: updated,
				}
			} finally {
				this.etaSecondsByJobId.delete(jobId)
				this.currentTrackByJobId.delete(jobId)
				if (this.activeJobId === jobId) {
					this.activeJobId = null
					this.abortController = null
					this.activeRunPromise = null
				}
			}
		})()

		this.activeRunPromise = runPromise
		return runPromise
	}

	/**
	 * 阶段 6：对已保存为正式本地歌单的歌曲发起继续匹配 / 重试失败项 / 重新匹配。
	 * 复用同一套串行节流、412/429 风控熔断和原地更新逻辑。
	 */
	public async rematchPlaylistTracks(
		playlistId: number,
		options?: PlaylistRematchOptions,
	): Promise<PlaylistRematchOutcome> {
		if (
			this.isPlaylistRematchRunning(playlistId) &&
			this.activeRematchPromise
		) {
			return this.activeRematchPromise
		}

		if (this.activeJobId && this.activeRunPromise) {
			this.pause(this.activeJobId)
			try {
				await this.activeRunPromise
			} catch {
				// Ignore
			}
		}

		if (
			this.activeRematchPlaylistId !== null &&
			this.activeRematchPlaylistId !== playlistId &&
			this.activeRematchPromise
		) {
			this.pausePlaylistRematch(this.activeRematchPlaylistId)
			try {
				await this.activeRematchPromise
			} catch {
				// Ignore
			}
		}

		const allMappings = this.jobService.getPlaylistTrackMappings(playlistId)
		const mode = options?.mode ?? 'unfinished'
		const targetTrackIdSet =
			options?.trackIds && options.trackIds.length > 0
				? new Set(options.trackIds)
				: null

		const targetMappings = allMappings.filter((m) => {
			if (targetTrackIdSet) {
				return targetTrackIdSet.has(m.trackId)
			}
			if (mode === 'failed') {
				return m.matchStatus === 'error' || m.matchStatus === 'rate_limited'
			}
			if (mode === 'all') {
				return true
			}
			return m.matchStatus !== 'matched' || !m.matchedBvid
		})

		if (targetMappings.length === 0) {
			return {
				status: 'completed',
				processed: 0,
				total: 0,
				matched: 0,
				unmatched: 0,
				error: 0,
				rateLimited: 0,
			}
		}

		const controller = new AbortController()
		this.activeRematchPlaylistId = playlistId
		this.abortController = controller

		const tracks = targetMappings.map((m) => m.originalTrack)
		let processed = 0
		let matched = 0
		let unmatched = 0
		let errorCount = 0
		let rateLimited = 0

		const rematchPromise = (async (): Promise<PlaylistRematchOutcome> => {
			try {
				const res = await this.playlistService.matchExternalPlaylist(
					tracks,
					(current, total, matchResult, trackIndex) => {
						const mapping = targetMappings[trackIndex]
						if (!mapping) return

						const updatedMapping = this.jobService.updateTrackMatchInPlace(
							mapping.trackId,
							matchResult,
						)
						const itemStatus = getMatchResultStatus(matchResult)
						if (itemStatus === 'matched') {
							matched++
							processed++
						} else if (itemStatus === 'unmatched') {
							unmatched++
							processed++
						} else if (itemStatus === 'error') {
							errorCount++
						} else if (itemStatus === 'rate_limited') {
							rateLimited++
						}
						options?.onProgress?.(current, total, updatedMapping)
					},
					{
						signal: controller.signal,
						requestDelayMs: options?.requestDelayMs,
						searchTimeoutMs: options?.searchTimeoutMs,
					},
				)

				if (res.isErr()) {
					const err = res.error
					if (isBilibiliRateLimitError(err)) {
						return {
							status: 'rate_limited',
							processed,
							total: targetMappings.length,
							matched,
							unmatched,
							error: errorCount,
							rateLimited,
							errorCause: err,
						}
					}
					if (err.message === 'Aborted') {
						return {
							status: 'paused',
							processed,
							total: targetMappings.length,
							matched,
							unmatched,
							error: errorCount,
							rateLimited,
						}
					}
					return {
						status: 'failed',
						processed,
						total: targetMappings.length,
						matched,
						unmatched,
						error: errorCount,
						rateLimited,
						errorCause: err,
					}
				}

				return {
					status: 'completed',
					processed,
					total: targetMappings.length,
					matched,
					unmatched,
					error: errorCount,
					rateLimited,
				}
			} finally {
				if (this.activeRematchPlaylistId === playlistId) {
					this.activeRematchPlaylistId = null
					this.abortController = null
					this.activeRematchPromise = null
				}
			}
		})()

		this.activeRematchPromise = rematchPromise
		return rematchPromise
	}

	public pausePlaylistRematch(playlistId: number): void {
		if (this.activeRematchPlaylistId === playlistId) {
			this.abortController?.abort()
			this.activeRematchPlaylistId = null
			this.abortController = null
			this.activeRematchPromise = null
		}
	}

	public pause(jobId: string): ImportJobSnapshot | null {
		const wasRunning = this.activeJobId === jobId
		if (wasRunning) {
			this.abortController?.abort()
			this.activeJobId = null
			this.abortController = null
			this.activeRunPromise = null
		}
		this.etaSecondsByJobId.delete(jobId)
		this.currentTrackByJobId.delete(jobId)
		const updated = this.jobService.updateJobStatus(jobId, 'paused')
		this.notifyUpdated(jobId, 'paused')
		return updated
	}

	public async pauseAndWait(jobId: string): Promise<ImportJobSnapshot | null> {
		const wasRunning = this.activeJobId === jobId
		const promise = this.activeRunPromise
		const res = this.pause(jobId)
		if (wasRunning && promise) {
			try {
				await promise
			} catch {
				// Ignore
			}
		}
		return res
	}

	public cancel(jobId: string): ImportJobSnapshot | null {
		const wasRunning = this.activeJobId === jobId
		if (wasRunning) {
			this.abortController?.abort()
			this.activeJobId = null
			this.abortController = null
			this.activeRunPromise = null
		}
		this.etaSecondsByJobId.delete(jobId)
		this.currentTrackByJobId.delete(jobId)
		const updated = this.jobService.updateJobStatus(jobId, 'cancelled')
		this.notifyUpdated(jobId, 'cancelled')
		return updated
	}

	public recoverStuckJobs(): number {
		const activeIds = this.activeJobId
			? new Set<string>([this.activeJobId])
			: new Set<string>()
		return this.jobService.recoverStuckJobs(activeIds)
	}

	public resetForTesting(): void {
		this.abortController?.abort()
		this.activeJobId = null
		this.activeRematchPlaylistId = null
		this.abortController = null
		this.activeRunPromise = null
		this.activeRematchPromise = null
		this.etaSecondsByJobId.clear()
		this.currentTrackByJobId.clear()
		this.listeners.clear()
	}
}

export const externalPlaylistImportWorker = new ExternalPlaylistImportWorker()

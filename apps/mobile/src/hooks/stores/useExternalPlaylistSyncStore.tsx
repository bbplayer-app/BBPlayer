import { createContext, use, useEffect, useState } from 'react'
import { createStore, useStore } from 'zustand'
import type { StateStorage } from 'zustand/middleware'

import {
	computeImportJobStats,
	type ExternalImportJobService,
	externalImportJobService,
	type ImportItem,
	type ImportJob,
	type ImportJobSnapshot,
	type ImportJobStatus,
	itemsToResultsRecord,
	parseSessionKeyToJobIdentity,
	reconcileSessionResults,
} from '@/lib/services/externalImportJobService'
import type { MatchResult } from '@/lib/services/externalPlaylistService'
import {
	getMatchResultFingerprint,
	getMatchResultStatus,
} from '@/lib/services/externalPlaylistService'
import {
	type ExternalPlaylistImportWorker,
	externalPlaylistImportWorker,
	type ImportWorkerRunOptions,
	type ImportWorkerRunOutcome,
} from '@/lib/workers/ExternalPlaylistImportWorker'
import type { GenericPlaylist, GenericTrack } from '@/types/external_playlist'
import { zustandStorage } from '@/utils/mmkv'

export { reconcileSessionResults }

export type SyncSession = {
	results: Record<number, MatchResult>
	isRateLimited?: boolean
	updatedAt: number
}

export interface SyncState {
	currentJobId: string | null
	currentSessionKey: string | null
	job: ImportJob | null
	items: ImportItem[]
	jobStatus: ImportJobStatus
	results: Record<number, MatchResult>
	totalTracks: number
	processedCount: number
	matchedCount: number
	unmatchedCount: number
	errorCount: number
	rateLimitedCount: number
	progress: number
	etaSeconds: number | null
	syncing: boolean
	isRateLimited: boolean
	setSessionKey: (
		sessionKey: string,
		tracksOrTotal: GenericTrack[] | number,
		playlistMetadata?: GenericPlaylist,
	) => void
	setJobStatus: (status: ImportJobStatus) => void
	setSyncing: (syncing: boolean) => void
	setRateLimited: (isRateLimited: boolean) => void
	setResult: (index: number, result: MatchResult) => void
	setProgress: (current: number, total: number) => void
	startOrResumeMatching: (
		options?: ImportWorkerRunOptions,
	) => Promise<ImportWorkerRunOutcome | null>
	pauseMatching: () => void
	pauseMatchingAndWait: () => Promise<void>
	bindWorkerEvents: () => () => void
	unbindWorkerEvents: () => void
	reset: () => void
	clearSession: () => void
	cancelJob: () => void
}

type SyncStore = ReturnType<typeof createExternalPlaylistSyncStore>

export const getProgressFromResults = (
	results: Record<number, MatchResult>,
	total: number,
) => {
	if (total <= 0) return 0
	const completedCount = Object.values(results).filter((res) => {
		const status = getMatchResultStatus(res)
		return status === 'matched' || status === 'unmatched'
	}).length
	return Math.min(completedCount / total, 1)
}

function mapSnapshotToStorePatch(
	snapshot: ImportJobSnapshot,
	options?: {
		syncingOverride?: boolean
		etaSeconds?: number | null
	},
) {
	const results = itemsToResultsRecord(snapshot.items)
	const stats = computeImportJobStats(snapshot.items, snapshot.job.totalCount)
	const isRateLimited =
		snapshot.job.status === 'rate_limited' || stats.rateLimitedCount > 0
	const syncing = options?.syncingOverride ?? snapshot.job.status === 'running'

	return {
		currentJobId: snapshot.job.jobId,
		job: snapshot.job,
		items: snapshot.items,
		jobStatus: snapshot.job.status,
		results,
		totalTracks: stats.totalCount,
		processedCount: stats.processedCount,
		matchedCount: stats.matchedCount,
		unmatchedCount: stats.unmatchedCount,
		errorCount: stats.errorCount,
		rateLimitedCount: stats.rateLimitedCount,
		progress: getProgressFromResults(results, stats.totalCount),
		etaSeconds: syncing ? (options?.etaSeconds ?? null) : null,
		syncing,
		isRateLimited,
	}
}

export const createExternalPlaylistSyncStore = (
	storageImpl: StateStorage = zustandStorage,
	jobService: ExternalImportJobService = externalImportJobService,
	worker: ExternalPlaylistImportWorker = externalPlaylistImportWorker,
) => {
	let workerUnsubscribe: (() => void) | null = null

	const ensureWorkerSubscription = (
		set: (partial: Partial<SyncState>) => void,
		get: () => SyncState,
	) => {
		if (workerUnsubscribe) return workerUnsubscribe
		workerUnsubscribe = worker.subscribe((event) => {
			const currentJobId = get().currentJobId
			if (!currentJobId || event.jobId !== currentJobId) return
			if (!event.snapshot) return

			const isRunning =
				event.type === 'started' || event.type === 'progress'
					? true
					: event.type === 'paused' ||
						  event.type === 'rate_limited' ||
						  event.type === 'completed' ||
						  event.type === 'cancelled' ||
						  event.type === 'failed'
						? false
						: worker.isJobRunning(currentJobId)
			set(
				mapSnapshotToStorePatch(event.snapshot, {
					syncingOverride: isRunning,
					etaSeconds: event.etaSeconds,
				}),
			)
		})
		return workerUnsubscribe
	}

	return createStore<SyncState>()((set, get) => ({
		currentJobId: null,
		currentSessionKey: null,
		job: null,
		items: [],
		jobStatus: 'pending',
		results: {},
		totalTracks: 0,
		processedCount: 0,
		matchedCount: 0,
		unmatchedCount: 0,
		errorCount: 0,
		rateLimitedCount: 0,
		progress: 0,
		etaSeconds: null,
		syncing: false,
		isRateLimited: false,
		bindWorkerEvents: () => {
			ensureWorkerSubscription(set, get)
			return () => {
				if (workerUnsubscribe) {
					workerUnsubscribe()
					workerUnsubscribe = null
				}
			}
		},
		unbindWorkerEvents: () => {
			if (workerUnsubscribe) {
				workerUnsubscribe()
				workerUnsubscribe = null
			}
		},
		setSessionKey: (sessionKey, tracksOrTotal, playlistMetadata) => {
			ensureWorkerSubscription(set, get)
			const { jobId, source, sourcePlaylistId } =
				parseSessionKeyToJobIdentity(sessionKey)
			const isActivelyRunning = worker.isJobRunning(jobId)
			const currentEta = worker.getEtaSeconds(jobId)

			if (Array.isArray(tracksOrTotal)) {
				const snapshot = jobService.createOrResumeJob({
					source,
					sourcePlaylistId,
					tracks: tracksOrTotal,
					playlistMetadata,
					legacyStorage: storageImpl,
				})
				set({
					currentSessionKey: sessionKey,
					...mapSnapshotToStorePatch(snapshot, {
						syncingOverride: isActivelyRunning,
						etaSeconds: currentEta,
					}),
				})
				return
			}

			const existingSnapshot = jobService.getJobSnapshot(jobId)
			if (existingSnapshot) {
				if (existingSnapshot.job.status === 'running' && !isActivelyRunning) {
					const recovered =
						jobService.updateJobStatus(
							jobId,
							existingSnapshot.job.rateLimitedCount > 0
								? 'rate_limited'
								: 'paused',
						) ?? existingSnapshot
					set({
						currentSessionKey: sessionKey,
						...mapSnapshotToStorePatch(recovered, {
							syncingOverride: false,
							etaSeconds: null,
						}),
					})
					return
				}
				set({
					currentSessionKey: sessionKey,
					...mapSnapshotToStorePatch(existingSnapshot, {
						syncingOverride: isActivelyRunning,
						etaSeconds: currentEta,
					}),
				})
				return
			}

			set({
				currentJobId: jobId,
				currentSessionKey: sessionKey,
				job: null,
				items: [],
				jobStatus: 'pending',
				results: {},
				totalTracks: tracksOrTotal,
				processedCount: 0,
				matchedCount: 0,
				unmatchedCount: 0,
				errorCount: 0,
				rateLimitedCount: 0,
				progress: 0,
				etaSeconds: null,
				syncing: false,
				isRateLimited: false,
			})
		},
		startOrResumeMatching: async (options) => {
			ensureWorkerSubscription(set, get)
			const { currentJobId } = get()
			if (!currentJobId) return null
			set({ syncing: true, jobStatus: 'running' })
			return await worker.start(currentJobId, options)
		},
		pauseMatching: () => {
			const { currentJobId } = get()
			if (!currentJobId) return
			const snapshot = worker.pause(currentJobId)
			if (snapshot) {
				set(
					mapSnapshotToStorePatch(snapshot, {
						syncingOverride: false,
						etaSeconds: null,
					}),
				)
			} else {
				set({ syncing: false, jobStatus: 'paused', etaSeconds: null })
			}
		},
		pauseMatchingAndWait: async () => {
			const { currentJobId } = get()
			if (!currentJobId) return
			set({ syncing: false, jobStatus: 'paused', etaSeconds: null })
			await worker.pauseAndWait(currentJobId)
		},
		setJobStatus: (status) => {
			const { currentJobId } = get()
			if (!currentJobId) {
				set({ jobStatus: status, syncing: status === 'running' })
				return
			}
			const snapshot = jobService.updateJobStatus(currentJobId, status)
			if (snapshot) {
				set(
					mapSnapshotToStorePatch(snapshot, {
						syncingOverride: status === 'running',
						etaSeconds: worker.getEtaSeconds(currentJobId),
					}),
				)
			} else {
				set({ jobStatus: status, syncing: status === 'running' })
			}
		},
		setSyncing: (syncing) => {
			const state = get()
			const { currentJobId } = state
			if (syncing) {
				if (currentJobId) {
					const snapshot = jobService.updateJobStatus(currentJobId, 'running')
					if (snapshot) {
						set(
							mapSnapshotToStorePatch(snapshot, {
								syncingOverride: true,
								etaSeconds: worker.getEtaSeconds(currentJobId),
							}),
						)
						return
					}
				}
				set({
					syncing: true,
					jobStatus: 'running',
					isRateLimited: false,
				})
				return
			}

			if (currentJobId) {
				const latest = jobService.getJobSnapshot(currentJobId)
				if (latest) {
					let nextStatus: ImportJobStatus = latest.job.status
					if (latest.job.status === 'running') {
						if (latest.job.rateLimitedCount > 0 || state.isRateLimited) {
							nextStatus = 'rate_limited'
						} else if (
							latest.job.totalCount > 0 &&
							latest.job.processedCount === latest.job.totalCount
						) {
							nextStatus = 'completed'
						} else if (
							latest.job.processedCount > 0 ||
							latest.job.errorCount > 0
						) {
							nextStatus = 'paused'
						} else {
							nextStatus = 'pending'
						}
						const updated =
							jobService.updateJobStatus(currentJobId, nextStatus) ?? latest
						set(
							mapSnapshotToStorePatch(updated, {
								syncingOverride: false,
								etaSeconds: null,
							}),
						)
						return
					}
					set(
						mapSnapshotToStorePatch(latest, {
							syncingOverride: false,
							etaSeconds: null,
						}),
					)
					return
				}
			}

			set({ syncing: false, etaSeconds: null })
		},
		setRateLimited: (isRateLimited) => {
			const { currentJobId } = get()
			if (currentJobId && isRateLimited) {
				const snapshot = jobService.updateJobStatus(
					currentJobId,
					'rate_limited',
				)
				if (snapshot) {
					set({
						...mapSnapshotToStorePatch(snapshot, {
							syncingOverride: false,
							etaSeconds: null,
						}),
						isRateLimited: true,
					})
					return
				}
			}
			set({
				isRateLimited,
				...(isRateLimited
					? { jobStatus: 'rate_limited', syncing: false, etaSeconds: null }
					: {}),
			})
		},
		setResult: (index, result) => {
			const state = get()
			const normalizedResult: MatchResult = {
				...result,
				status: getMatchResultStatus(result),
				trackFingerprint: getMatchResultFingerprint(result),
			}

			if (state.currentJobId) {
				const snapshot = jobService.updateItemResult(
					state.currentJobId,
					index,
					normalizedResult,
				)
				if (snapshot) {
					set(
						mapSnapshotToStorePatch(snapshot, {
							syncingOverride: state.syncing,
							etaSeconds: state.etaSeconds,
						}),
					)
					worker.notifyUpdated(state.currentJobId)
					return
				}
			}

			const results = { ...state.results, [index]: normalizedResult }
			const isRateLimited =
				normalizedResult.status === 'rate_limited' || state.isRateLimited
			const progress =
				state.totalTracks > 0
					? getProgressFromResults(results, state.totalTracks)
					: state.progress
			set({
				results,
				isRateLimited,
				progress,
			})
		},
		setProgress: (current, total) =>
			set({ progress: total > 0 ? Math.min(current / total, 1) : 0 }),
		reset: () => {
			const { currentJobId } = get()
			if (currentJobId) {
				if (worker.isJobRunning(currentJobId)) {
					worker.pause(currentJobId)
				}
				const snapshot = jobService.resetJob(currentJobId)
				if (snapshot) {
					set(
						mapSnapshotToStorePatch(snapshot, {
							syncingOverride: false,
							etaSeconds: null,
						}),
					)
					worker.notifyUpdated(currentJobId)
					return
				}
			}
			set({
				jobStatus: 'pending',
				results: {},
				processedCount: 0,
				matchedCount: 0,
				unmatchedCount: 0,
				errorCount: 0,
				rateLimitedCount: 0,
				progress: 0,
				etaSeconds: null,
				syncing: false,
				isRateLimited: false,
			})
		},
		clearSession: () => {
			const { currentJobId } = get()
			if (currentJobId) {
				if (worker.isJobRunning(currentJobId)) {
					worker.cancel(currentJobId)
				}
				jobService.deleteJob(currentJobId, storageImpl)
			}
			set({
				currentJobId: null,
				job: null,
				items: [],
				jobStatus: 'pending',
				results: {},
				processedCount: 0,
				matchedCount: 0,
				unmatchedCount: 0,
				errorCount: 0,
				rateLimitedCount: 0,
				progress: 0,
				etaSeconds: null,
				syncing: false,
				isRateLimited: false,
			})
		},
		cancelJob: () => {
			const { currentJobId } = get()
			if (currentJobId) {
				const snapshot = worker.cancel(currentJobId)
				if (snapshot) {
					set(
						mapSnapshotToStorePatch(snapshot, {
							syncingOverride: false,
							etaSeconds: null,
						}),
					)
					return
				}
			}
			set({
				jobStatus: 'cancelled',
				syncing: false,
				etaSeconds: null,
			})
		},
	}))
}

const ExternalPlaylistSyncStoreContext = createContext<SyncStore | null>(null)

export const ExternalPlaylistSyncStoreProvider = ({
	children,
}: {
	children: React.ReactNode
}) => {
	const [store] = useState(() => createExternalPlaylistSyncStore())

	useEffect(() => {
		return store.getState().bindWorkerEvents()
	}, [store])

	return (
		<ExternalPlaylistSyncStoreContext.Provider value={store}>
			{children}
		</ExternalPlaylistSyncStoreContext.Provider>
	)
}

export type { SyncStore }

export function useExternalPlaylistSyncStoreApi() {
	const store = use(ExternalPlaylistSyncStoreContext)
	if (!store) {
		throw new Error(
			'useExternalPlaylistSyncStoreApi must be used within ExternalPlaylistSyncStoreProvider',
		)
	}
	return store
}

export function useExternalPlaylistSyncStore<T>(
	selector: (state: SyncState) => T,
): T {
	const store = useExternalPlaylistSyncStoreApi()
	return useStore(store, selector)
}

import {
	cancelImportProgressNotification,
	type ImportProgressNotificationOptions,
	updateImportProgressNotification,
} from '@bbplayer/native'

import type { ImportJobSnapshot } from '@/lib/services/externalImportJobService'
import {
	type ExternalPlaylistImportWorker,
	externalPlaylistImportWorker,
	type ImportWorkerEvent,
} from '@/lib/workers/ExternalPlaylistImportWorker'
import log from '@/utils/log'

const logger = log.extend('Services.ExternalImportNotification')

export interface ImportLiveActivityPayload {
	jobId: string
	playlistTitle: string
	source: string
	processedCount: number
	totalCount: number
	matchedCount: number
	unmatchedCount: number
	errorCount: number
	percentage: number
	progressText: string
	currentTrackTitle: string | null
	compactLeadingText: string
	compactTrailingText: string
	status: 'running' | 'paused' | 'rate_limited' | 'completed' | 'failed'
	statusMessage: string
	deepLinkUri: string
}

export interface ImportNotificationAdapter {
	updateAndroidNotification(options: ImportProgressNotificationOptions): boolean
	cancelAndroidNotification(): boolean
	updateIosLiveActivity(payload: ImportLiveActivityPayload | null): void
}

export function buildImportDeepLinkUri(
	source: string,
	sourcePlaylistId: string,
): string {
	return `bbplayer:///playlist/external-sync?source=${encodeURIComponent(source)}&id=${encodeURIComponent(sourcePlaylistId)}`
}

export function buildAndroidNotificationPayload(
	event: ImportWorkerEvent,
): ImportProgressNotificationOptions | null {
	const snapshot = event.snapshot
	if (!snapshot) return null

	const { job } = snapshot
	const playlistTitle = job.playlistMetadata.title || job.sourcePlaylistId
	const totalCount = Math.max(job.totalCount, 0)
	const processedCount = Math.min(job.processedCount, totalCount)
	const percentage =
		totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0
	const deepLinkUri = buildImportDeepLinkUri(job.source, job.sourcePlaylistId)

	if (
		(event.type === 'started' ||
			event.type === 'progress' ||
			event.type === 'updated') &&
		job.status === 'running'
	) {
		return {
			jobId: job.jobId,
			title: `正在匹配《${playlistTitle}》`,
			body: `${processedCount} / ${totalCount} · ${percentage}%`,
			subText: event.currentTrackTitle
				? `当前：${event.currentTrackTitle}`
				: undefined,
			progress: processedCount,
			maxProgress: totalCount,
			ongoing: true,
			deepLinkUri,
			status: 'running',
		}
	}

	if (event.type === 'rate_limited' || job.status === 'rate_limited') {
		return {
			jobId: job.jobId,
			title: '歌单匹配已暂停',
			body: 'Bilibili 请求暂时受限，进度已保存',
			subText: `已完成 ${processedCount} / ${totalCount} 首，点击返回查看`,
			progress: processedCount,
			maxProgress: totalCount,
			ongoing: false,
			deepLinkUri,
			status: 'rate_limited',
		}
	}

	if (event.type === 'completed' || job.status === 'completed') {
		const needActionCount = job.unmatchedCount + job.errorCount
		return {
			jobId: job.jobId,
			title: `《${playlistTitle}》匹配完成`,
			body: `${job.matchedCount} 首成功，${needActionCount} 首需要处理`,
			progress: totalCount,
			maxProgress: totalCount,
			ongoing: false,
			deepLinkUri,
			status: 'completed',
		}
	}

	if (event.type === 'paused' || job.status === 'paused') {
		return {
			jobId: job.jobId,
			title: `《${playlistTitle}》匹配已暂停`,
			body: `已完成 ${processedCount} / ${totalCount} · ${percentage}%，点击继续`,
			progress: processedCount,
			maxProgress: totalCount,
			ongoing: false,
			deepLinkUri,
			status: 'paused',
		}
	}

	if (event.type === 'failed' || job.status === 'failed') {
		return {
			jobId: job.jobId,
			title: `《${playlistTitle}》匹配中断`,
			body: `已完成 ${processedCount} / ${totalCount} 首，进度已保存`,
			progress: processedCount,
			maxProgress: totalCount,
			ongoing: false,
			deepLinkUri,
			status: 'failed',
		}
	}

	return null
}

export function buildIosLiveActivityPayload(
	snapshot: ImportJobSnapshot | null,
	currentTrackTitle: string | null,
): ImportLiveActivityPayload | null {
	if (!snapshot) return null
	const { job } = snapshot
	if (job.status === 'cancelled' || job.status === 'pending') {
		return null
	}

	const playlistTitle = job.playlistMetadata.title || job.sourcePlaylistId
	const totalCount = Math.max(job.totalCount, 0)
	const processedCount = Math.min(job.processedCount, totalCount)
	const percentage =
		totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0
	const needActionCount = job.unmatchedCount + job.errorCount
	const deepLinkUri = buildImportDeepLinkUri(job.source, job.sourcePlaylistId)

	let status: ImportLiveActivityPayload['status']
	let statusMessage: string

	switch (job.status) {
		case 'running':
			status = 'running'
			statusMessage = currentTrackTitle
				? `正在匹配：${currentTrackTitle}`
				: '正在自动匹配 Bilibili 音源...'
			break
		case 'rate_limited':
			status = 'rate_limited'
			statusMessage = '请求受限，已暂停保护进度'
			break
		case 'completed':
		case 'completed_waiting_confirmation':
			status = 'completed'
			statusMessage = `匹配完成 · ${job.matchedCount} 首成功，${needActionCount} 首待处理`
			break
		case 'failed':
			status = 'failed'
			statusMessage = '匹配中断，回到 App 继续'
			break
		default:
			status = 'paused'
			statusMessage = '已暂停，回到 App 继续'
			break
	}

	return {
		jobId: job.jobId,
		playlistTitle,
		source: job.source,
		processedCount,
		totalCount,
		matchedCount: job.matchedCount,
		unmatchedCount: job.unmatchedCount,
		errorCount: job.errorCount,
		percentage,
		progressText: `${processedCount}/${totalCount}`,
		currentTrackTitle: status === 'running' ? currentTrackTitle : null,
		compactLeadingText: 'BB',
		compactTrailingText: `${processedCount}/${totalCount}`,
		status,
		statusMessage,
		deepLinkUri,
	}
}

const defaultAdapter: ImportNotificationAdapter = {
	updateAndroidNotification: (options) =>
		updateImportProgressNotification(options),
	cancelAndroidNotification: () => cancelImportProgressNotification(),
	updateIosLiveActivity: () => {
		// iOS ActivityKit bridge hook (no-op when ActivityKit extension is not active)
	},
}

export class ExternalImportNotificationService {
	private unsubscribeWorker: (() => void) | null = null
	private lastAndroidPayload: ImportProgressNotificationOptions | null = null
	private lastIosPayload: ImportLiveActivityPayload | null = null

	constructor(
		private readonly worker: ExternalPlaylistImportWorker = externalPlaylistImportWorker,
		private readonly adapter: ImportNotificationAdapter = defaultAdapter,
	) {}

	public startListening(): () => void {
		if (this.unsubscribeWorker) {
			return () => this.stopListening()
		}
		this.unsubscribeWorker = this.worker.subscribe((event) => {
			this.handleWorkerEvent(event)
		})
		return () => this.stopListening()
	}

	public stopListening(): void {
		this.unsubscribeWorker?.()
		this.unsubscribeWorker = null
	}

	public getLastAndroidPayload(): ImportProgressNotificationOptions | null {
		return this.lastAndroidPayload
	}

	public getLastIosPayload(): ImportLiveActivityPayload | null {
		return this.lastIosPayload
	}

	public handleWorkerEvent(event: ImportWorkerEvent): void {
		try {
			if (event.type === 'cancelled' || !event.snapshot) {
				this.lastAndroidPayload = null
				this.lastIosPayload = null
				this.adapter.cancelAndroidNotification()
				this.adapter.updateIosLiveActivity(null)
				return
			}

			const androidPayload = buildAndroidNotificationPayload(event)
			if (androidPayload) {
				this.lastAndroidPayload = androidPayload
				this.adapter.updateAndroidNotification(androidPayload)
			}

			const iosPayload = buildIosLiveActivityPayload(
				event.snapshot,
				event.currentTrackTitle,
			)
			this.lastIosPayload = iosPayload
			this.adapter.updateIosLiveActivity(iosPayload)
		} catch (e) {
			logger.warning('更新外部歌单导入系统通知失败:', e)
		}
	}

	/**
	 * 当 iOS 后台执行即将被系统挂起时调用：
	 * 诚实将正在运行的任务标记为已暂停并更新 Live Activity，绝不伪造后台进度。
	 */
	public handleIosBackgroundExpiration(): void {
		const activeJobId = this.worker.getActiveJobId()
		if (!activeJobId) return
		const pausedSnapshot = this.worker.pause(activeJobId)
		const iosPayload = buildIosLiveActivityPayload(pausedSnapshot, null)
		this.lastIosPayload = iosPayload
		this.adapter.updateIosLiveActivity(iosPayload)
	}
}

export const externalImportNotificationService =
	new ExternalImportNotificationService()

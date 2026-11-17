import type { Track as OrpheusTrack } from '@bbplayer/orpheus'
import { Orpheus } from '@bbplayer/orpheus'

import { useTracedQuery } from '@/hooks/utils/useTracedQuery'
import { queryClient } from '@/lib/config/queryClient'

export const orpheusQueryKeys = {
	all: ['orpheus'] as const,
	batchDownloadStatus: (ids: string[]) =>
		[...orpheusQueryKeys.all, 'batchDownloadStatus', ids] as const,
	shuffleMode: () => [...orpheusQueryKeys.all, 'shuffleMode'] as const,
	downloadTasks: () => [...orpheusQueryKeys.all, 'downloadTasks'] as const,
	playerQueue: () => [...orpheusQueryKeys.all, 'playerQueue'] as const,
	sleepTimer: () => [...orpheusQueryKeys.all, 'sleepTimerEndAt'] as const,
	completedDownloads: () =>
		[...orpheusQueryKeys.all, 'completedDownloads'] as const,
}

queryClient.setQueryDefaults(orpheusQueryKeys.all, {
	networkMode: 'always',
	gcTime: 0,
	staleTime: 0,
	retry: false,
})

export function useBatchDownloadStatus(ids: string[]) {
	return useTracedQuery({
		span: { name: 'download.batch_status' },
		queryKey: orpheusQueryKeys.batchDownloadStatus(ids),
		queryFn: async () => {
			return await Orpheus.getDownloadStatusByIds(ids)
		},
		staleTime: 0,
		gcTime: 0,
		enabled: ids.length > 0,
	})
}

export function useShuffleMode() {
	return useTracedQuery({
		span: { name: 'player.shuffle_mode' },
		queryKey: orpheusQueryKeys.shuffleMode(),
		queryFn: () => Orpheus.getShuffleMode(),
		gcTime: 0,
		staleTime: 0,
	})
}

export function useDownloadTasks() {
	return useTracedQuery({
		span: { name: 'download.tasks' },
		queryKey: orpheusQueryKeys.downloadTasks(),
		queryFn: async () => {
			return await Orpheus.getUncompletedDownloadTasks()
		},
		staleTime: 0,
	})
}

export function useCompletedDownloads() {
	return useTracedQuery({
		span: { name: 'download.completed' },
		queryKey: orpheusQueryKeys.completedDownloads(),
		queryFn: async () => {
			return await Orpheus.getCompletedDownloadTasks()
		},
		staleTime: 0,
	})
}

/**
 * 播放队列。大队列时读一次开销不小，调用方应只在真正展示队列时启用。
 */
export function usePlayerQueue(enabled: boolean = true) {
	return useTracedQuery<OrpheusTrack[]>({
		span: { name: 'player.queue' },
		queryKey: orpheusQueryKeys.playerQueue(),
		queryFn: () => Orpheus.getQueue(),
		staleTime: 0,
		enabled,
		gcTime: 0,
	})
}

let playerQueueListening = false
let invalidateTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 队列变化时让播放队列查询失效：没有启用中的查询时只标记过期，不读取原生队列。
 *
 * 一次队列操作会连续触发多个 onQueueChanged，而原生调用无法真正取消，
 * 所以先防抖合并，避免排起一串重复读取。
 */
export function listenPlayerQueueChanges() {
	if (playerQueueListening) return
	playerQueueListening = true

	Orpheus.addListener('onQueueChanged', () => {
		if (invalidateTimer) clearTimeout(invalidateTimer)
		invalidateTimer = setTimeout(() => {
			invalidateTimer = null
			void queryClient.invalidateQueries({
				queryKey: orpheusQueryKeys.playerQueue(),
			})
		}, 100)
	})
}

export function useSleepTimerEndTime() {
	return useTracedQuery({
		span: { name: 'player.sleep_timer' },
		queryFn: async () => {
			return await Orpheus.getSleepTimerEndTime()
		},
		queryKey: orpheusQueryKeys.sleepTimer(),
		gcTime: 0,
		staleTime: 0,
	})
}

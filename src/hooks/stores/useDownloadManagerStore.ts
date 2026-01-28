import type { DownloadState } from '@roitium/expo-orpheus'
import { Orpheus } from '@roitium/expo-orpheus'

import createStickyEmitter from '@/utils/sticky-mitt'

export type ProgressEvent = Record<
	`progress:${string}`,
	{
		current: number
		total: number
		percent: number
		state: DownloadState
	}
>
export const eventListner = createStickyEmitter<ProgressEvent>()

// Dispatch event to each task
Orpheus.addListener('onDownloadUpdated', (event) => {
	const eventKey = `progress:${event.id}` as const
	eventListner.emit(eventKey, {
		current: event.bytesDownloaded,
		total: event.contentLength,
		percent: event.percentDownloaded,
		state: event.state,
	})
})

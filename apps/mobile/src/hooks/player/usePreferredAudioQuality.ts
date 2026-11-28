import { Orpheus, type AudioQualityPreference } from '@bbplayer/orpheus'
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
	listeners.add(listener)

	return () => {
		listeners.delete(listener)
	}
}

export function getPreferredAudioQuality(): AudioQualityPreference {
	return Orpheus.preferredAudioQuality
}

/** 写入首选音质，并通知所有正在显示首选音质的组件 */
export function setPreferredAudioQuality(preference: AudioQualityPreference) {
	Orpheus.preferredAudioQuality = preference

	for (const listener of listeners) {
		listener()
	}
}

export default function usePreferredAudioQuality(): AudioQualityPreference {
	return useSyncExternalStore(subscribe, getPreferredAudioQuality)
}

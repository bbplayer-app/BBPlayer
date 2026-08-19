import { useEvent } from 'expo'

import { Orpheus } from '../ExpoOrpheusModule'

/** 订阅原生频谱开关变化，并返回当前原生状态。 */
export function useSpectrumVisualizerEnabled() {
	const event = useEvent(Orpheus, 'onSpectrumVisualizerEnabledChanged', {
		enabled: Orpheus.isSpectrumVisualizerEnabled,
	})

	return event.enabled
}

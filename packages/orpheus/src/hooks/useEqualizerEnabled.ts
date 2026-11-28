import { useEvent } from 'expo'
import { Platform } from 'react-native'

import type { EqualizerSettings } from '../equalizerPresets'
import { Orpheus } from '../ExpoOrpheusModule'

const DISABLED_SETTINGS: EqualizerSettings = {
	enabled: false,
	preampDb: 0,
	limiterEnabled: true,
	gainsDb: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	activePresetId: 'flat',
}

/** 订阅原生均衡器变化，并返回当前是否启用；非 Android 平台恒为 false。 */
export function useEqualizerEnabled(): boolean {
	const isAndroid = Platform.OS === 'android'

	const event = useEvent(
		Orpheus,
		'onEqualizerChanged',
		isAndroid
			? { ...DISABLED_SETTINGS, enabled: Orpheus.isEqualizerEnabled }
			: DISABLED_SETTINGS,
	)

	return isAndroid ? event.enabled : false
}

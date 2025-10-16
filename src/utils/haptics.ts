import * as ExpoHaptics from 'expo-haptics'
import { reportErrorToSentry } from './log'

let hapticsSupported = true

export const performAndroidHapticsAsync = async (
	type: ExpoHaptics.AndroidHaptics,
): Promise<void> => {
	if (!hapticsSupported) return

	try {
		await ExpoHaptics.performAndroidHapticsAsync(type)
	} catch (e) {
		if (e instanceof Error && e.message.includes('is not available')) {
			hapticsSupported = false
			return
		}
		reportErrorToSentry(e, 'performAndroidHapticsAsync 出错', 'Utils.Haptics')
	}
}

export const AndroidHaptics = ExpoHaptics.AndroidHaptics

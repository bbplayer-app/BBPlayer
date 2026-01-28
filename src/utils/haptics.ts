import * as ExpoHaptics from 'expo-haptics'
import { Platform } from 'react-native'

import { reportErrorToSentry } from './log'

let hapticsSupported = true

export const AndroidHaptics = ExpoHaptics.AndroidHaptics

/**
 * Platform-agnostic haptics function.
 * On Android, it calls the specific Android haptic type.
 * On iOS, it maps the Android hint to the closest iOS equivalent.
 */
export const performHaptics = async (
	type: ExpoHaptics.AndroidHaptics,
): Promise<void> => {
	if (!hapticsSupported) return

	try {
		if (Platform.OS === 'android') {
			await ExpoHaptics.performAndroidHapticsAsync(type)
		} else {
			// iOS Mapping
			switch (type) {
				case ExpoHaptics.AndroidHaptics.Context_Click:
					await ExpoHaptics.selectionAsync()
					break
				case ExpoHaptics.AndroidHaptics.Confirm:
					await ExpoHaptics.notificationAsync(
						ExpoHaptics.NotificationFeedbackType.Success,
					)
					break
				case ExpoHaptics.AndroidHaptics.Reject:
					await ExpoHaptics.notificationAsync(
						ExpoHaptics.NotificationFeedbackType.Error,
					)
					break
				case ExpoHaptics.AndroidHaptics.Drag_Start:
					await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light)
					break
				case ExpoHaptics.AndroidHaptics.Gesture_End:
					await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium)
					break
				case ExpoHaptics.AndroidHaptics.Clock_Tick:
					await ExpoHaptics.selectionAsync()
					break
				case ExpoHaptics.AndroidHaptics.Long_Press:
					await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy)
					break
				default:
					// Default fallback for other Android specific haptics on iOS
					await ExpoHaptics.selectionAsync()
					break
			}
		}
	} catch (e) {
		if (e instanceof Error && e.message.includes('is not available')) {
			hapticsSupported = false
			return
		}
		// On iOS, we might want to suppress errors or log them differently,
		// but sticking to the existing pattern is fine.
		reportErrorToSentry(e, 'performHaptics 出错', 'Utils.Haptics')
	}
}

/**
 * @deprecated Use performHaptics instead
 */
export const performAndroidHapticsAsync = performHaptics

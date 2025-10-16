import * as ExpoHaptics from 'expo-haptics'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

// Cache for haptics support check
let hapticsSupported: boolean | null = null

/**
 * Checks if the device supports haptics and caches the result.
 * This prevents repeated checks and failed calls on unsupported devices.
 */
const checkHapticsSupportAsync = async (): Promise<boolean> => {
	if (hapticsSupported !== null) {
		return hapticsSupported
	}

	try {
		// Try to perform a minimal haptic feedback to test if the device supports it
		await ExpoHaptics.performAndroidHapticsAsync(
			ExpoHaptics.AndroidHaptics.Context_Click,
		)
		hapticsSupported = true
		return true
	} catch (error) {
		// If haptics fail (e.g., "A haptics engine is not available on this device"),
		// cache that this device doesn't support haptics
		hapticsSupported = false
		return false
	}
}

export const performAndroidHapticsAsync = (type: ExpoHaptics.AndroidHaptics) =>
	ResultAsync.fromPromise(
		(async () => {
			// Check if haptics are supported before attempting
			const supported = await checkHapticsSupportAsync()
			if (!supported) {
				// Silently succeed without performing haptics on unsupported devices
				return
			}
			// Only perform haptics on supported devices
			await ExpoHaptics.performAndroidHapticsAsync(type)
		})(),
		(e) => errAsync(e),
	)

export const AndroidHaptics = ExpoHaptics.AndroidHaptics

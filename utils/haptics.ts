import * as ExpoHaptics from 'expo-haptics'
import { errAsync, ResultAsync } from 'neverthrow'

export const performAndroidHapticsAsync = (type: ExpoHaptics.AndroidHaptics) =>
	ResultAsync.fromPromise(ExpoHaptics.performAndroidHapticsAsync(type), (e) =>
		errAsync(e),
	)

export const AndroidHaptics = ExpoHaptics.AndroidHaptics

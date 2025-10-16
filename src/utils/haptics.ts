import * as ExpoHaptics from 'expo-haptics'
import { errAsync, ResultAsync } from 'neverthrow'
import { reportErrorToSentry } from './log'

let hapticsSupported = true

export const performAndroidHapticsAsync = (type: ExpoHaptics.AndroidHaptics) =>
	ResultAsync.fromPromise(
		(async () => {
			if (!hapticsSupported) return
			try {
				await ExpoHaptics.performAndroidHapticsAsync(type)
			} catch (e) {
				if (e instanceof Error && e.message.includes('is not available')) {
					// 这用户的手机有点老
					hapticsSupported = false
					return
				}
				reportErrorToSentry(
					e,
					'performAndroidHapticsAsync 出错',
					'Utils.Haptics',
				)
			}
		})(),
		(e) => errAsync(e),
	)

export const AndroidHaptics = ExpoHaptics.AndroidHaptics

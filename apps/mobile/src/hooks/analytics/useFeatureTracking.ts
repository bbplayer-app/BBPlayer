import { Orpheus } from '@roitium/expo-orpheus'
import { useEffect } from 'react'

import { useAppStore } from '@/hooks/stores/useAppStore'
import { analyticsService } from '@/lib/services/analyticsService'

/**
 * Syncs feature flags and user settings to Analytics User Properties.
 * This allows segmenting users based on their configuration.
 */
export function useFeatureTracking() {
	const settings = useAppStore((state) => state.settings)
	const { enableDataCollection } = settings

	useEffect(() => {
		void analyticsService.setAnalyticsCollectionEnabled(enableDataCollection)

		if (!enableDataCollection) return

		if (Object.keys(settings).length > 0) {
			Object.entries(settings).forEach(([key, value]) => {
				void analyticsService.setUserProperty(`setting_${key}`, String(value))
			})
		}

		const trackNativeSettings = () => {
			void analyticsService.setUserProperty(
				'setting_persist_pos',
				String(Orpheus.restorePlaybackPositionEnabled),
			)
			void analyticsService.setUserProperty(
				'setting_loudness_norm',
				String(Orpheus.loudnessNormalizationEnabled),
			)
			void analyticsService.setUserProperty(
				'setting_autoplay',
				String(Orpheus.autoplayOnStartEnabled),
			)
			void analyticsService.setUserProperty(
				'setting_desktop_lyric',
				String(Orpheus.isDesktopLyricsShown),
			)
		}

		trackNativeSettings()
	}, [settings, enableDataCollection])
}

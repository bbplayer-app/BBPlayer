import { Orpheus } from '@bbplayer/orpheus'
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

		void analyticsService.setUserProperty(
			'setting_lyric_source',
			settings.lyricSource,
		)
		void analyticsService.setUserProperty(
			'setting_player_bg_style',
			settings.playerBackgroundStyle,
		)
		void analyticsService.setUserProperty(
			'setting_now_playing_bar_style',
			settings.nowPlayingBarStyle,
		)

		void analyticsService.setUserProperty(
			'setting_desktop_lyric',
			String(Orpheus.isDesktopLyricsShown),
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
			'setting_send_history',
			String(settings.sendPlayHistory),
		)

		void analyticsService.setUserProperty(
			'setting_visualizer',
			String(settings.enableSpectrumVisualizer),
		)
		void analyticsService.setUserProperty(
			'setting_persist_pos',
			String(Orpheus.restorePlaybackPositionEnabled),
		)
	}, [settings, enableDataCollection])
}

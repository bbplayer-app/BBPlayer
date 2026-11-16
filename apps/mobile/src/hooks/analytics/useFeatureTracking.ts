import { setNativeTelemetryEnabled } from '@bbplayer/native'
import { Orpheus, useSpectrumVisualizerEnabled } from '@bbplayer/orpheus'
import { Observe } from 'expo-observe'
import { useEffect } from 'react'

import { useAppStore } from '@/hooks/stores/useAppStore'
import { isSentryTelemetryEnabled } from '@/lib/config/sentry'
import { runAfterStartup } from '@/lib/performance'
import { analyticsService } from '@/lib/services/analyticsService'

/**
 * Syncs feature flags and user settings to Analytics User Properties.
 * This allows segmenting users based on their configuration.
 */
export function useFeatureTracking() {
	const settings = useAppStore((state) => state.settings)
	const { enableDataCollection } = settings
	const enableSpectrumVisualizer = useSpectrumVisualizerEnabled()

	useEffect(() => {
		Observe.configure({ dispatchingEnabled: enableDataCollection })
		void analyticsService.setAnalyticsCollectionEnabled(enableDataCollection)
		// JS 侧的 Sentry 在 beforeSend 里读取开关，原生侧需要单独同步
		setNativeTelemetryEnabled(isSentryTelemetryEnabled())

		if (!enableDataCollection) return

		// 用户属性不影响首屏，启动时等首屏可交互后再同步
		runAfterStartup(() => {
			// 回调排队期间用户可能关掉了数据收集
			if (!useAppStore.getState().settings.enableDataCollection) return

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
				String(enableSpectrumVisualizer),
			)
			void analyticsService.setUserProperty(
				'setting_persist_pos',
				String(Orpheus.restorePlaybackPositionEnabled),
			)
		})
	}, [settings, enableDataCollection, enableSpectrumVisualizer])
}

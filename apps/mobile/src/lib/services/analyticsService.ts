import {
	getAnalytics,
	logEvent,
	logScreenView,
	setAnalyticsCollectionEnabled,
	setUserProperty,
} from '@react-native-firebase/analytics'

import log from '@/utils/log'

const logger = log.extend('Service.Analytics')

type PlayerAction =
	| 'play'
	| 'pause'
	| 'skip_next'
	| 'skip_prev'
	| 'shuffle'
	| 'repeat'

type PlayerQueueAction = 'open_queue' | 'play_item' | 'reverse_remaining'

type PlaylistSyncAction = 'sync_bilibili' | 'sync_external'

class AnalyticsService {
	private async safeLogEvent(name: string, params?: Record<string, unknown>) {
		try {
			logEvent(getAnalytics(), name, params)
			logger.debug('analytics.event_logged', { 'analytics.event_name': name })
		} catch (error) {
			logger.warning(
				'analytics.event_failed',
				{ 'analytics.event_name': name },
				error,
			)
		}
	}

	public async logPlayerAction(
		action: PlayerAction,
		params?: Record<string, unknown>,
	) {
		await this.safeLogEvent('player_action', {
			action,
			...params,
		})
	}

	public async logPlayerQueueAction(action: PlayerQueueAction) {
		await this.safeLogEvent('player_queue_action', {
			action,
		})
	}

	public async logPlaylistSync(
		action: PlaylistSyncAction,
		targetType:
			| 'collection'
			| 'series'
			| 'favorite'
			| 'multi_page'
			| 'external',
		itemCount: number,
	) {
		await this.safeLogEvent('playlist_sync', {
			action,
			target_type: targetType,
			item_count: itemCount,
		})
	}

	public async logSearch(type: 'global' | 'fav') {
		await this.safeLogEvent('search', {
			search_type: type,
		})
	}

	public async logScreenView(
		screenName: string,
		screenclass: string = screenName,
	) {
		try {
			await logScreenView(getAnalytics(), {
				screen_name: screenName,
				screen_class: screenclass,
			})
			logger.debug('analytics.screen_logged', {
				'analytics.screen_name': screenName,
			})
		} catch (error) {
			logger.warning(
				'analytics.screen_failed',
				{ 'analytics.screen_name': screenName },
				error,
			)
		}
	}

	public async setUserProperty(name: string, value: string) {
		try {
			await setUserProperty(getAnalytics(), name, value)
			logger.debug('analytics.property_set', {
				'analytics.property_name': name,
			})
		} catch (error) {
			logger.warning(
				'analytics.property_failed',
				{ 'analytics.property_name': name },
				error,
			)
		}
	}

	public async logPlaybackSession(durationSeconds: number) {
		await this.safeLogEvent('playback_session', {
			duration_seconds: durationSeconds,
		})
	}

	public async setAnalyticsCollectionEnabled(enabled: boolean) {
		await setAnalyticsCollectionEnabled(getAnalytics(), enabled)
		logger.debug('analytics.collection_changed', {
			'analytics.enabled': enabled,
		})
	}

	public async logAppInfo(version: string, buildVersion: string) {
		await this.setUserProperty('app_version', version)
		await this.setUserProperty('build_version', buildVersion)
	}
}

export const analyticsService = new AnalyticsService()

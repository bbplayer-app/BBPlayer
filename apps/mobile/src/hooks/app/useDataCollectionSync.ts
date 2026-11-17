import { setNativeTelemetryEnabled } from '@bbplayer/native'
import { Observe } from 'expo-observe'
import { useEffect } from 'react'

import { useAppStore } from '@/hooks/stores/useAppStore'
import { isSentryTelemetryEnabled } from '@/lib/config/sentry'

/** 把「分享数据」开关同步给不读取 JS 设置的上报方：Expo Observe 与原生侧 Sentry */
export function useDataCollectionSync() {
	const enableDataCollection = useAppStore(
		(state) => state.settings.enableDataCollection,
	)

	useEffect(() => {
		Observe.configure({ dispatchingEnabled: enableDataCollection })
		// JS 侧的 Sentry 在 beforeSend 里读取开关，原生侧需要单独同步
		setNativeTelemetryEnabled(isSentryTelemetryEnabled())
	}, [enableDataCollection])
}

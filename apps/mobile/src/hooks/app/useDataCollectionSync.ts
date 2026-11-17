import { setNativeTelemetryEnabled } from '@bbplayer/native'
import { useEffect } from 'react'

import { useAppStore } from '@/hooks/stores/useAppStore'
import { isSentryTelemetryEnabled } from '@/lib/config/sentry'

/** 把「分享数据」开关同步给原生侧 Sentry：JS 侧的 Sentry 在 beforeSend 里读取开关，原生侧需要单独同步 */
export function useDataCollectionSync() {
	const enableDataCollection = useAppStore(
		(state) => state.settings.enableDataCollection,
	)

	useEffect(() => {
		setNativeTelemetryEnabled(isSentryTelemetryEnabled())
	}, [enableDataCollection])
}

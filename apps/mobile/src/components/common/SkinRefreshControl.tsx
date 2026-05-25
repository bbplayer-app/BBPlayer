import { useEffect } from 'react'
import type { RefreshControlProps } from 'react-native'
import { RefreshControl } from 'react-native'

import useSkinRefreshStore from '@/hooks/stores/useSkinRefreshStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'

export default function SkinRefreshControl({
	refreshing,
	...props
}: RefreshControlProps) {
	const activeSkin = useActiveSkin()
	const beginRefresh = useSkinRefreshStore((state) => state.begin)
	const endRefresh = useSkinRefreshStore((state) => state.end)

	useEffect(() => {
		if (!activeSkin || !refreshing) return

		beginRefresh()
		return () => endRefresh()
	}, [activeSkin, beginRefresh, endRefresh, refreshing])

	return (
		<RefreshControl
			{...props}
			refreshing={refreshing}
			colors={activeSkin ? ['transparent'] : props.colors}
			progressBackgroundColor={
				activeSkin ? 'transparent' : props.progressBackgroundColor
			}
			tintColor={activeSkin ? 'transparent' : props.tintColor}
		/>
	)
}

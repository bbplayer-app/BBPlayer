import { Image } from 'expo-image'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import useSkinRefreshStore from '@/hooks/stores/useSkinRefreshStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'

const SkinRefreshOverlay = memo(function SkinRefreshOverlay() {
	const activeSkin = useActiveSkin()
	const activeCount = useSkinRefreshStore((state) => state.activeCount)
	const insets = useSafeAreaInsets()

	if (!activeSkin || activeCount <= 0) return null

	return (
		<View
			pointerEvents='none'
			style={[styles.container, { top: insets.top + 8 }]}
		>
			<Image
				source={activeSkin.refresh.preview}
				style={styles.image}
				contentFit='contain'
				cachePolicy='memory-disk'
			/>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		left: 0,
		right: 0,
		zIndex: 50,
		alignItems: 'center',
	},
	image: {
		width: 72,
		height: 72,
	},
})

export default SkinRefreshOverlay

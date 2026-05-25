import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'

import useActiveSkin from '@/hooks/theme/useActiveSkin'

interface SkinAppbarBackgroundProps {
	height: number
}

const SkinAppbarBackground = memo(function SkinAppbarBackground({
	height,
}: SkinAppbarBackgroundProps) {
	const activeSkin = useActiveSkin()
	const colors = useTheme().colors

	if (!activeSkin) return null

	return (
		<View
			pointerEvents='none'
			style={[styles.container, { height }]}
		>
			<Image
				source={activeSkin.background.head}
				style={styles.image}
				contentFit='cover'
				cachePolicy='memory-disk'
			/>
			<LinearGradient
				colors={['rgba(255,255,255,0)', colors.background]}
				style={styles.fade}
			/>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		overflow: 'hidden',
	},
	image: {
		...StyleSheet.absoluteFillObject,
	},
	fade: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		height: 56,
	},
})

export default SkinAppbarBackground

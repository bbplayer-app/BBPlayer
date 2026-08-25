import Color from 'color'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'

import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'

interface SkinAppbarBackgroundProps {
	height: number
}

const SkinAppbarBackground = memo(function SkinAppbarBackground({
	height,
}: SkinAppbarBackgroundProps) {
	const activeSkin = useActiveSkin()
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	const colors = useTheme().colors
	const scrimColor = Color(colors.background).alpha(0.88).rgb().string()
	const scrimMidColor = Color(colors.background).alpha(0.48).rgb().string()

	const head = activeSkin?.skins[activeSkinIndex]?.background.head
	if (!head) return null

	return (
		<View
			pointerEvents='none'
			style={[styles.container, { height }]}
		>
			<Image
				source={head}
				style={styles.image}
				contentFit='cover'
				cachePolicy='memory-disk'
			/>
			<LinearGradient
				colors={[scrimColor, scrimMidColor, 'transparent']}
				locations={[0, 0.55, 1]}
				style={styles.topScrim}
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
		...StyleSheet.absoluteFill,
	},
	topScrim: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		height: 88,
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

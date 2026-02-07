import { memo } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Divider, Icon, Text, useTheme } from 'react-native-paper'

export interface LyricsOffsetControlProps {
	visible: boolean
	anchor: { x: number; y: number; width: number; height: number } | null
	offset: number
	onChangeOffset: (delta: number) => void
	onClose: () => void
}

export const LyricsOffsetControl = memo(function LyricsOffsetControl({
	visible,
	anchor,
	offset,
	onChangeOffset,
	onClose,
}: LyricsOffsetControlProps) {
	const dimensions = useWindowDimensions()
	const windowHeight = dimensions.height
	const windowWidth = dimensions.width
	const colors = useTheme().colors

	return (
		<View
			style={[
				styles.offsetControlContainer,
				{
					right: anchor ? windowWidth - (anchor.x + anchor.width) : 0,
					bottom: anchor ? windowHeight - anchor.y : 0,
					backgroundColor: colors.elevation.level2,
					opacity: visible ? 1 : 0,
					pointerEvents: visible ? 'auto' : 'none',
				},
			]}
		>
			<RectButton
				style={styles.offsetControlButton}
				onPress={() => onChangeOffset(0.5)}
			>
				<Icon
					source='arrow-up'
					size={20}
					color={colors.onSurface}
				/>
			</RectButton>
			<Text
				variant='titleSmall'
				style={[styles.offsetControlText, { color: colors.onSurface }]}
			>
				{offset.toFixed(1)}s
			</Text>
			<RectButton
				style={styles.offsetControlButton}
				onPress={() => onChangeOffset(-0.5)}
			>
				<Icon
					source='arrow-down'
					size={20}
					color={colors.onSurface}
				/>
			</RectButton>
			<Divider />
			<RectButton
				style={styles.offsetControlButton}
				onPress={onClose}
			>
				<Icon
					source='check'
					size={20}
					color={colors.onSurface}
				/>
			</RectButton>
		</View>
	)
})

const styles = StyleSheet.create({
	offsetControlContainer: {
		position: 'absolute',
		gap: 8,
		borderRadius: 12,
		elevation: 10,
		paddingHorizontal: 2,
		paddingVertical: 4,
		zIndex: 99999,
	},
	offsetControlButton: {
		borderRadius: 99999,
		padding: 10,
	},
	offsetControlText: {
		textAlign: 'center',
	},
})

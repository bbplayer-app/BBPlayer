import { memo, useCallback, useEffect } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Divider, Icon, Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

export interface LyricsOffsetControlProps {
	visible: boolean
	offset: number
	onChangeOffset: (delta: number) => void
	onClose: () => void
}

export const LyricsOffsetControl = memo(function LyricsOffsetControl({
	visible,
	offset,
	onChangeOffset,
	onClose,
}: LyricsOffsetControlProps) {
	const colors = useTheme().colors
	const translateX = useSharedValue(200)
	const isAnimatingOut = useSharedValue(false)

	useEffect(() => {
		if (visible) {
			isAnimatingOut.value = false
			translateX.value = withTiming(0, { duration: 250 })
		}
	}, [visible, translateX, isAnimatingOut])

	const handleDismiss = useCallback(() => {
		if (isAnimatingOut.value) return
		isAnimatingOut.set(true)
		translateX.set(
			withTiming(250, { duration: 200 }, (finished) => {
				if (finished) {
					scheduleOnRN(onClose)
				}
			}),
		)
	}, [isAnimatingOut, translateX, onClose])

	const panelStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.value }],
	}))

	return (
		<Modal
			transparent
			visible={visible}
			onRequestClose={handleDismiss}
			animationType='none'
			statusBarTranslucent
		>
			<View style={styles.modalRoot}>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={handleDismiss}
				/>
				<Animated.View
					style={[
						styles.panel,
						{ backgroundColor: colors.elevation.level2 },
						panelStyle,
					]}
				>
					<Pressable
						android_ripple={{}}
						style={styles.offsetControlButton}
						onPress={() => onChangeOffset(0.5)}
					>
						<Icon
							source='arrow-up'
							size={28}
							color={colors.onSurface}
						/>
					</Pressable>
					<Text
						variant='titleMedium'
						style={[styles.offsetControlText, { color: colors.onSurface }]}
					>
						{offset.toFixed(1)}s
					</Text>
					<Pressable
						android_ripple={{}}
						style={styles.offsetControlButton}
						onPress={() => onChangeOffset(-0.5)}
					>
						<Icon
							source='arrow-down'
							size={28}
							color={colors.onSurface}
						/>
					</Pressable>
					<Divider />
					<Pressable
						android_ripple={{}}
						style={styles.offsetControlButton}
						onPress={handleDismiss}
					>
						<Icon
							source='check'
							size={28}
							color={colors.onSurface}
						/>
					</Pressable>
				</Animated.View>
			</View>
		</Modal>
	)
})

const styles = StyleSheet.create({
	modalRoot: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'flex-end',
	},
	panel: {
		gap: 12,
		borderRadius: 20,
		elevation: 10,
		paddingHorizontal: 4,
		paddingVertical: 8,
		marginRight: 16,
	},
	offsetControlButton: {
		borderRadius: 99999,
		padding: 14,
	},
	offsetControlText: {
		textAlign: 'center',
		minWidth: 56,
	},
})

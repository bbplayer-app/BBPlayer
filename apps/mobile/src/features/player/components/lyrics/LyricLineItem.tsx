import { type LyricLine } from '@bbplayer/splash'
import { memo, useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { useTheme } from 'react-native-paper'
import Animated, {
	type SharedValue,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

import { KaraokeWord } from './KaraokeWord'

const AnimatedRectButton = Animated.createAnimatedComponent(RectButton)

export interface LyricLineItemProps {
	item: LyricLine & { isPaddingItem?: boolean }
	isHighlighted: boolean
	jumpToThisLyric: (index: number) => void
	index: number
	onPressBackground?: () => void
	currentTime: SharedValue<number>
	enableVerbatimLyrics: boolean
}

export const OldSchoolLyricLineItem = memo(function OldSchoolLyricLineItem({
	item,
	isHighlighted,
	jumpToThisLyric,
	index,
	onPressBackground,
	currentTime,
	enableVerbatimLyrics,
}: LyricLineItemProps) {
	const colors = useTheme().colors
	const isHighlightedShared = useSharedValue(isHighlighted)

	useEffect(() => {
		isHighlightedShared.value = isHighlighted
	}, [isHighlighted, item.startTime, index, isHighlightedShared])

	const gatedCurrentTime = useDerivedValue(() => {
		return isHighlightedShared.value ? currentTime.value : -1
	})

	const animatedStyle = useAnimatedStyle(() => {
		if (isHighlightedShared.value === true) {
			return {
				opacity: withTiming(1, { duration: 300 }),
				color: withTiming(colors.primary, { duration: 300 }),
			}
		}

		return {
			opacity: withTiming(0.7, { duration: 300 }),
			color: withTiming(colors.onSurfaceDisabled, { duration: 300 }),
		}
	})
	return (
		<View style={styles.oldSchoolItemWrapper}>
			<Pressable
				style={StyleSheet.absoluteFill}
				onPress={onPressBackground}
			/>
			<RectButton
				style={styles.oldSchoolItemButton}
				onPress={() => jumpToThisLyric(index)}
			>
				{enableVerbatimLyrics &&
				item.isDynamic &&
				item.spans &&
				item.spans.length > 0 ? (
					<View
						style={{
							flexDirection: 'row',
							flexWrap: 'wrap',
							justifyContent: 'center',
						}}
					>
						{item.spans.map((span, idx) => (
							<KaraokeWord
								key={`${index}_${idx}`}
								span={span}
								currentTime={gatedCurrentTime}
								baseStyle={styles.oldSchoolItemText}
								activeColor={colors.primary}
								inactiveColor={colors.onSurfaceDisabled}
								isHighlighted={isHighlighted}
							/>
						))}
					</View>
				) : (
					<Animated.Text style={[styles.oldSchoolItemText, animatedStyle]}>
						{item.content}
					</Animated.Text>
				)}
				{item.translations?.[0] && (
					<Animated.Text
						style={[styles.oldSchoolItemTranslation, animatedStyle]}
					>
						{item.translations[0]}
					</Animated.Text>
				)}
			</RectButton>
		</View>
	)
})

export const ModernLyricLineItem = memo(function ModernLyricLineItem({
	item,
	isHighlighted,
	jumpToThisLyric,
	index,
	onPressBackground,
	currentTime,
	enableVerbatimLyrics,
}: LyricLineItemProps) {
	const theme = useTheme()
	const isHighlightedShared = useSharedValue(isHighlighted)

	useEffect(() => {
		isHighlightedShared.value = isHighlighted
	}, [isHighlighted, item.startTime, index, isHighlightedShared])

	const gatedCurrentTime = useDerivedValue(() => {
		return isHighlightedShared.value ? currentTime.value : -1
	})

	const containerAnimatedStyle = useAnimatedStyle(() => {
		if (isHighlightedShared.value === true) {
			return {
				opacity: withTiming(1, { duration: 300 }),
				transform: [
					{ scale: withTiming(1.05, { duration: 300 }) },
					{ translateX: withTiming(12, { duration: 300 }) },
				],
			}
		}

		return {
			opacity: withTiming(0.7, { duration: 300 }),
			transform: [
				{ scale: withTiming(1, { duration: 300 }) },
				{ translateX: withTiming(0, { duration: 300 }) },
			],
		}
	})

	const textAnimatedStyle = useAnimatedStyle(() => {
		if (isHighlightedShared.value === true) {
			return {
				color: withTiming(theme.colors.primary, { duration: 300 }),
			}
		}
		return {
			color: withTiming(theme.colors.onSurfaceDisabled, { duration: 300 }),
		}
	})

	const renderContent = () => {
		if (
			enableVerbatimLyrics &&
			item.isDynamic &&
			item.spans &&
			item.spans.length > 0
		) {
			return (
				<View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
					{item.spans.map((span, idx) => (
						<KaraokeWord
							key={`${index}_${idx}`}
							span={span}
							currentTime={gatedCurrentTime}
							baseStyle={styles.modernItemText}
							activeColor={theme.colors.primary}
							inactiveColor={theme.colors.onSurfaceDisabled}
							isHighlighted={isHighlighted}
						/>
					))}
				</View>
			)
		}

		return (
			<Animated.Text style={[styles.modernItemText, textAnimatedStyle]}>
				{item.content}
			</Animated.Text>
		)
	}

	return (
		<View style={styles.modernItemWrapper}>
			<Pressable
				style={StyleSheet.absoluteFill}
				onPress={onPressBackground}
			/>
			<AnimatedRectButton
				style={[styles.modernItemButton, containerAnimatedStyle]}
				onPress={() => jumpToThisLyric(index)}
			>
				{renderContent()}
				{item.translations?.[0] && (
					<Animated.Text
						style={[styles.modernItemTranslation, textAnimatedStyle]}
					>
						{item.translations[0]}
					</Animated.Text>
				)}
			</AnimatedRectButton>
		</View>
	)
})

const styles = StyleSheet.create({
	oldSchoolItemWrapper: {
		alignItems: 'center',
		paddingVertical: 4,
	},
	oldSchoolItemButton: {
		flexDirection: 'column',
		alignItems: 'center',
		gap: 4,
		borderRadius: 16,
		paddingVertical: 8,
		paddingHorizontal: 16,
		marginHorizontal: 30,
		alignSelf: 'center',
	},
	oldSchoolItemText: {
		textAlign: 'center',
		fontSize: 14,
		fontWeight: '400',
		letterSpacing: 0.25,
		lineHeight: 20,
	},
	oldSchoolItemTranslation: {
		textAlign: 'center',
		fontSize: 12,
		fontWeight: '400',
		letterSpacing: 0.4,
		lineHeight: 16,
	},
	modernItemWrapper: {
		flexDirection: 'column',
		alignItems: 'stretch',
		marginVertical: 4,
		paddingVertical: 2,
	},
	modernItemButton: {
		flexDirection: 'column',
		alignItems: 'flex-start',
		gap: 4,
		borderRadius: 8,
		paddingVertical: 4,
		marginHorizontal: 30,
		paddingLeft: 8,
		paddingRight: 8,
		alignSelf: 'flex-start',
	},
	modernItemText: {
		textAlign: 'left',
		fontSize: 24,
		fontWeight: '700',
		letterSpacing: 0,
		lineHeight: 32,
	},
	modernItemTranslation: {
		textAlign: 'left',
		fontSize: 18,
		fontWeight: '400',
		letterSpacing: 0,
		lineHeight: 26,
		marginTop: 2,
	},
})

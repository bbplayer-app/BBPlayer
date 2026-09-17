import { type PropsWithChildren, useEffect } from 'react'
import { type StyleProp, StyleSheet, type ViewStyle, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import Animated, {
	cancelAnimation,
	Easing,
	ReduceMotion,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LIST_ITEM_COVER_SIZE, SQUIRCLE_RADIUS_RATIO } from '@/theme/dimensions'

interface PlaylistSkeletonProps {
	/** 转场期间保持静态；仅在转场结束后仍在加载时呼吸。 */
	animate?: boolean
}

function SkeletonPulse({
	animate,
	children,
	style,
}: PropsWithChildren<
	PlaylistSkeletonProps & { style?: StyleProp<ViewStyle> }
>) {
	const opacity = useSharedValue(1)

	useEffect(() => {
		if (!animate) {
			cancelAnimation(opacity)
			opacity.set(1)
			return
		}

		opacity.set(0.68)
		opacity.set(
			withRepeat(
				withTiming(1, {
					duration: 900,
					easing: Easing.inOut(Easing.quad),
					reduceMotion: ReduceMotion.System,
				}),
				-1,
				true,
			),
		)

		return () => cancelAnimation(opacity)
	}, [animate, opacity])

	const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

	return <Animated.View style={[style, pulseStyle]}>{children}</Animated.View>
}

export function PlaylistPageSkeleton({
	animate = false,
}: PlaylistSkeletonProps) {
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()

	return (
		<View
			style={[
				styles.container,
				{
					backgroundColor: colors.background,
					paddingTop: insets.top + 64, // Margin for Appbar
				},
			]}
		>
			<SkeletonPulse
				animate={animate}
				style={styles.pulse}
			>
				<View style={styles.contentContainer}>
					<PlaylistHeaderSkeleton />
					<View style={styles.trackList}>
						{Array.from({ length: 2 }, (_, index) => (
							<TrackListItemSkeleton key={index} />
						))}
					</View>
				</View>
			</SkeletonPulse>
		</View>
	)
}

export function PlaylistTrackListSkeleton({
	animate = false,
}: PlaylistSkeletonProps) {
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()

	return (
		<View
			style={[
				styles.container,
				{
					backgroundColor: colors.background,
					paddingTop: insets.top + 64, // Margin for Appbar
				},
			]}
		>
			<SkeletonPulse
				animate={animate}
				style={styles.pulse}
			>
				<View style={styles.contentContainer}>
					<View style={styles.trackList}>
						{Array.from({ length: 2 }, (_, index) => (
							<TrackListItemSkeleton key={index} />
						))}
					</View>
				</View>
			</SkeletonPulse>
		</View>
	)
}

export function PlaylistHeaderSkeleton() {
	const { colors } = useTheme()

	return (
		<View style={styles.headerContainer}>
			{/* Top Section: Cover + Text */}
			<View style={styles.headerTopSection}>
				<View
					style={[
						styles.coverSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
				<View style={styles.headerTextSection}>
					<View
						style={[
							styles.titleSkeleton,
							{ backgroundColor: colors.surfaceVariant },
						]}
					/>
					<View
						style={[
							styles.subtitleSkeleton,
							{ backgroundColor: colors.surfaceVariant },
						]}
					/>
					<View
						style={[
							styles.subtitleSkeleton,
							{
								backgroundColor: colors.surfaceVariant,
								width: '40%',
								marginTop: 4,
							},
						]}
					/>
				</View>
			</View>

			{/* Action Buttons */}
			<View style={styles.actionButtonsContainer}>
				{/* Play All Button (Pill) */}
				<View
					style={[
						styles.playAllButtonSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
				{/* Icon Buttons */}
				<View
					style={[
						styles.actionIconSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
				<View
					style={[
						styles.actionIconSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
				<View
					style={[
						styles.actionIconSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
			</View>
		</View>
	)
}

export function TrackListItemSkeleton() {
	const { colors } = useTheme()

	return (
		<View style={styles.trackItemContainer}>
			{/* Index */}
			<View style={styles.trackIndexContainer}>
				<View
					style={[
						styles.trackIndexSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
			</View>

			{/* Cover */}
			<View
				style={[
					styles.trackCoverSkeleton,
					{ backgroundColor: colors.surfaceVariant },
				]}
			/>

			{/* Info */}
			<View style={styles.trackInfoContainer}>
				<View
					style={[
						styles.trackTitleSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
				<View style={styles.trackSubtitleRow}>
					<View
						style={[
							styles.trackArtistSkeleton,
							{ backgroundColor: colors.surfaceVariant },
						]}
					/>
				</View>
			</View>

			{/* Menu */}
			<View style={styles.trackMenuContainer}>
				<View
					style={[
						styles.trackMenuSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
			</View>
		</View>
	)
}

export function TrackListItemSkeletonGroup({
	count,
	animate = false,
}: PlaylistSkeletonProps & { count: number }) {
	return (
		<SkeletonPulse animate={animate}>
			<View>
				{Array.from({ length: count }, (_, index) => (
					<TrackListItemSkeleton key={index} />
				))}
			</View>
		</SkeletonPulse>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	pulse: {
		flex: 1,
	},
	contentContainer: {
		flex: 1,
	},
	headerContainer: {
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 12,
	},
	headerTopSection: {
		flexDirection: 'row',
		marginBottom: 16,
	},
	coverSkeleton: {
		width: 120,
		height: 120,
		borderRadius: 120 * SQUIRCLE_RADIUS_RATIO,
		overflow: 'hidden',
	},
	headerTextSection: {
		flex: 1,
		marginLeft: 16,
		justifyContent: 'center',
		paddingVertical: 8,
	},
	titleSkeleton: {
		height: 24,
		borderRadius: 4,
		overflow: 'hidden',
		width: '90%',
		marginBottom: 12,
	},
	subtitleSkeleton: {
		height: 14,
		width: '70%',
		borderRadius: 4,
		overflow: 'hidden',
		marginBottom: 4,
	},
	actionButtonsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginHorizontal: 16,
		gap: 8, // Gap between buttons
	},
	playAllButtonSkeleton: {
		width: 120,
		height: 40,
		borderRadius: 20,
		overflow: 'hidden',
	},
	actionIconSkeleton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		overflow: 'hidden',
	},
	trackList: {
		paddingHorizontal: 0,
	},
	trackItemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	trackIndexContainer: {
		width: 35,
		marginRight: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	trackIndexSkeleton: {
		width: 16,
		height: 16,
		borderRadius: 4,
		overflow: 'hidden',
	},
	trackCoverSkeleton: {
		width: LIST_ITEM_COVER_SIZE,
		height: LIST_ITEM_COVER_SIZE,
		borderRadius: LIST_ITEM_COVER_SIZE * SQUIRCLE_RADIUS_RATIO,
		overflow: 'hidden',
	},
	trackInfoContainer: {
		flex: 1,
		marginLeft: 12,
		marginRight: 4,
		justifyContent: 'center',
	},
	trackTitleSkeleton: {
		height: 16,
		borderRadius: 4,
		overflow: 'hidden',
		width: '80%',
		marginBottom: 6,
	},
	trackSubtitleRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	trackArtistSkeleton: {
		width: '50%',
		height: 12,
		borderRadius: 4,
		overflow: 'hidden',
	},
	trackMenuContainer: {
		padding: 10,
	},
	trackMenuSkeleton: {
		width: 24,
		height: 24,
		borderRadius: 12,
		overflow: 'hidden',
	},
})

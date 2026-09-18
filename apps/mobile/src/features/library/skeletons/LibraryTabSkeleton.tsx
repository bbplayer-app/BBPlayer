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

import { LIST_ITEM_COVER_SIZE, SQUIRCLE_RADIUS_RATIO } from '@/theme/dimensions'

interface LibrarySkeletonProps {
	/** 转场期间保持静态；仅在转场结束后仍在加载时呼吸。 */
	animate?: boolean
}

function SkeletonPulse({
	animate = true,
	children,
	style,
}: PropsWithChildren<LibrarySkeletonProps & { style?: StyleProp<ViewStyle> }>) {
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

/**
 * Generic item skeleton for all library lists
 */
export function LibraryListItemSkeleton() {
	const { colors } = useTheme()

	return (
		<View style={styles.itemContainer}>
			<View style={styles.itemContent}>
				<View
					style={[
						styles.coverSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>

				<View style={styles.itemTextContainer}>
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
				</View>

				<View
					style={[
						styles.arrowIconSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
			</View>
			<View
				style={[styles.divider, { backgroundColor: colors.surfaceVariant }]}
			/>
		</View>
	)
}

export function LocalPlaylistListSkeleton({
	animate = true,
}: LibrarySkeletonProps) {
	const { colors } = useTheme()

	return (
		<SkeletonPulse
			animate={animate}
			style={styles.listContainer}
		>
			<View style={styles.listHeaderContainer}>
				<View
					style={[
						styles.headerTitleSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
				<View style={styles.headerActionsContainer}>
					<View
						style={[
							styles.headerCountSkeleton,
							{ backgroundColor: colors.surfaceVariant },
						]}
					/>
					<View
						style={[
							styles.iconButtonSkeleton,
							{ backgroundColor: colors.surfaceVariant },
						]}
					/>
				</View>
			</View>

			<View
				style={[
					styles.searchBarSkeleton,
					{ backgroundColor: colors.surfaceVariant },
				]}
			/>

			{Array.from({ length: 2 }, (_, index) => (
				<LibraryListItemSkeleton key={index} />
			))}
		</SkeletonPulse>
	)
}

export function FavoriteFolderListSkeleton({
	animate = true,
}: LibrarySkeletonProps) {
	const { colors } = useTheme()

	return (
		<SkeletonPulse
			animate={animate}
			style={styles.listContainer}
		>
			<View style={styles.listHeaderContainer}>
				<View
					style={[
						styles.headerTitleSkeleton,
						{ backgroundColor: colors.surfaceVariant, width: 100 },
					]}
				/>
				<View
					style={[
						styles.headerCountSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
			</View>

			<View
				style={[
					styles.searchBarSkeleton,
					{ backgroundColor: colors.surfaceVariant },
				]}
			/>

			{Array.from({ length: 2 }, (_, index) => (
				<LibraryListItemSkeleton key={index} />
			))}
		</SkeletonPulse>
	)
}

export function CollectionListSkeleton({
	animate = true,
}: LibrarySkeletonProps) {
	const { colors } = useTheme()

	return (
		<SkeletonPulse
			animate={animate}
			style={styles.listContainer}
		>
			<View style={styles.listHeaderContainer}>
				<View
					style={[
						styles.headerTitleSkeleton,
						{ backgroundColor: colors.surfaceVariant, width: 150 },
					]}
				/>
				<View
					style={[
						styles.headerCountSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
			</View>

			{Array.from({ length: 2 }, (_, index) => (
				<LibraryListItemSkeleton key={index} />
			))}
		</SkeletonPulse>
	)
}

export function MultiPageVideosListSkeleton({
	animate = true,
}: LibrarySkeletonProps) {
	const { colors } = useTheme()

	return (
		<SkeletonPulse
			animate={animate}
			style={styles.listContainer}
		>
			<View style={styles.listHeaderContainer}>
				<View
					style={[
						styles.headerTitleSkeleton,
						{ backgroundColor: colors.surfaceVariant, width: 120 },
					]}
				/>
				<View
					style={[
						styles.headerCountSkeleton,
						{ backgroundColor: colors.surfaceVariant },
					]}
				/>
			</View>

			{Array.from({ length: 2 }, (_, index) => (
				<LibraryListItemSkeleton key={index} />
			))}
		</SkeletonPulse>
	)
}

// Default export can act as a fallback or the main entry point if needed.
// Since existing code imports { LibraryTabSkeleton }, we keep it.
// We'll map it to LocalPlaylistListSkeleton as a default since it's the first tab.
export function LibraryTabSkeleton() {
	return <LocalPlaylistListSkeleton />
}

const styles = StyleSheet.create({
	listContainer: {
		flex: 1,
		marginHorizontal: 16,
		marginTop: 8, // Gap from top
	},
	listHeaderContainer: {
		marginBottom: 8,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		height: 48,
	},
	headerTitleSkeleton: {
		width: 80,
		height: 24,
		borderRadius: 4,
		overflow: 'hidden',
	},
	headerActionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	headerCountSkeleton: {
		width: 80,
		height: 16,
		borderRadius: 4,
		overflow: 'hidden',
	},
	iconButtonSkeleton: {
		width: 28, // IconButton size=20 + padding? Actual IconButton size=20, touch area bigger.
		height: 28,
		borderRadius: 14,
		overflow: 'hidden',
	},
	searchBarSkeleton: {
		height: 45,
		borderRadius: 22.5, // 9999 in original, effectively pill
		marginBottom: 20,
		marginTop: 10,
		overflow: 'hidden',
	},
	itemContainer: {
		marginBottom: 1,
	},
	itemContent: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
		paddingHorizontal: 8,
	},
	coverSkeleton: {
		width: LIST_ITEM_COVER_SIZE,
		height: LIST_ITEM_COVER_SIZE,
		borderRadius: LIST_ITEM_COVER_SIZE * SQUIRCLE_RADIUS_RATIO,
		overflow: 'hidden',
	},
	itemTextContainer: {
		marginLeft: 12,
		flex: 1,
		gap: 6,
		justifyContent: 'center',
	},
	titleSkeleton: {
		height: 16,
		borderRadius: 4,
		overflow: 'hidden',
		width: '60%',
	},
	subtitleSkeleton: {
		height: 12,
		borderRadius: 4,
		overflow: 'hidden',
		width: '40%',
	},
	arrowIconSkeleton: {
		width: 24,
		height: 24,
		borderRadius: 12,
		overflow: 'hidden',
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 68, // cover(48) + padding(8) + margin(12) = 68
	},
})

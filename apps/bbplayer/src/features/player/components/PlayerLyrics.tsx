import MaskedView from '@react-native-masked-view/masked-view'
import type { FlashListRef } from '@shopify/flash-list'
import { FlashList } from '@shopify/flash-list'
import { LinearGradient } from 'expo-linear-gradient'
import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import {
	ActivityIndicator,
	Divider,
	Icon,
	Text,
	useTheme,
} from 'react-native-paper'
import Animated, {
	useAnimatedScrollHandler,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

import { LyricsControlOverlay } from '@/features/player/components/LyricsControlOverlay'
import useLyricSync from '@/features/player/hooks/useLyricSync'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { lyricsQueryKeys, useSmartFetchLyrics } from '@/hooks/queries/lyrics'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { queryClient } from '@/lib/config/queryClient'
import lyricService from '@/lib/services/lyricService'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'
import type { LyricLine } from '@/types/player/lyrics'
import { toastAndLogError } from '@/utils/error-handling'

const AnimatedFlashList = Animated.createAnimatedComponent(
	FlashList,
) as typeof FlashList<LyricLine & { isPaddingItem?: boolean }>

interface LyricsOffsetControlProps {
	visible: boolean
	anchor: { x: number; y: number; width: number; height: number } | null
	offset: number
	onChangeOffset: (delta: number) => void
	onClose: () => void
}

const { height: windowHeight, width: windowWidth } = Dimensions.get('window')

export const LyricsOffsetControl = memo(function LyricsOffsetControl({
	visible,
	anchor,
	offset,
	onChangeOffset,
	onClose,
}: LyricsOffsetControlProps) {
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

const OldSchoolLyricLineItem = memo(function OldSchoolLyricLineItem({
	item,
	isHighlighted,
	jumpToThisLyric,
	index,
}: {
	item: LyricLine & { isPaddingItem?: boolean }
	isHighlighted: boolean
	jumpToThisLyric: (index: number) => void
	index: number
}) {
	const colors = useTheme().colors
	const isHighlightedShared = useSharedValue(isHighlighted)

	useEffect(() => {
		isHighlightedShared.value = isHighlighted
	}, [isHighlighted, item.timestamp, index, isHighlightedShared])

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
		<RectButton
			style={styles.oldSchoolItemButton}
			onPress={() => jumpToThisLyric(index)}
		>
			<Animated.Text style={[styles.oldSchoolItemText, animatedStyle]}>
				{item.text}
			</Animated.Text>
			{item.translation && (
				<Animated.Text style={[styles.oldSchoolItemTranslation, animatedStyle]}>
					{item.translation}
				</Animated.Text>
			)}
		</RectButton>
	)
})

const ModernLyricLineItem = memo(function ModernLyricLineItem({
	item,
	isHighlighted,
	jumpToThisLyric,
	index,
}: {
	item: LyricLine & { isPaddingItem?: boolean }
	isHighlighted: boolean
	jumpToThisLyric: (index: number) => void
	index: number
}) {
	const theme = useTheme()
	const isHighlightedShared = useSharedValue(isHighlighted)

	useEffect(() => {
		isHighlightedShared.value = isHighlighted
	}, [isHighlighted, item.timestamp, index, isHighlightedShared])

	const animatedStyle = useAnimatedStyle(() => {
		if (isHighlightedShared.value === true) {
			return {
				opacity: withTiming(1, { duration: 300 }),
				transform: [
					{ scale: withTiming(1.05, { duration: 300 }) },
					{ translateX: withTiming(12, { duration: 300 }) },
				],
				color: withTiming(theme.colors.primary, { duration: 300 }),
			}
		}

		return {
			opacity: withTiming(0.7, { duration: 300 }),
			transform: [
				{ scale: withTiming(1, { duration: 300 }) },
				{ translateX: withTiming(0, { duration: 300 }) },
			],
			color: withTiming(theme.colors.onSurfaceDisabled, { duration: 300 }),
		}
	})

	return (
		<RectButton
			style={styles.modernItemButton}
			onPress={() => jumpToThisLyric(index)}
		>
			<Animated.Text style={[styles.modernItemText, animatedStyle]}>
				{item.text}
			</Animated.Text>
			{item.translation && (
				<Animated.Text style={[styles.modernItemText, animatedStyle]}>
					{item.translation}
				</Animated.Text>
			)}
		</RectButton>
	)
})

const renderItem = ({
	item,
	index,
	extraData,
}: ListRenderItemInfoWithExtraData<
	LyricLine & { isPaddingItem?: boolean },
	{
		currentLyricIndex: number
		handleJumpToLyric: (index: number) => void
		enableOldSchoolStyleLyric: boolean
	}
>) => {
	if (item.isPaddingItem) {
		return <View style={{ height: windowHeight / 2 }} />
	}
	if (!extraData) throw new Error('Extradata 不存在')
	const { currentLyricIndex, handleJumpToLyric, enableOldSchoolStyleLyric } =
		extraData
	if (enableOldSchoolStyleLyric) {
		return (
			<OldSchoolLyricLineItem
				item={item}
				isHighlighted={index === currentLyricIndex}
				index={index}
				jumpToThisLyric={handleJumpToLyric}
			/>
		)
	}
	return (
		<ModernLyricLineItem
			item={item}
			isHighlighted={index === currentLyricIndex}
			index={index}
			jumpToThisLyric={handleJumpToLyric}
		/>
	)
}

const SCROLL_DIRECTION_THRESHOLD = 8

const Lyrics = memo(function Lyrics({
	currentIndex,
}: {
	currentIndex: number
}) {
	const colors = useTheme().colors
	const flashListRef = useRef<FlashListRef<LyricLine>>(null)
	const [offsetMenuVisible, setOffsetMenuVisible] = useState(false)
	const [offsetMenuAnchor, setOffsetMenuAnchor] = useState<{
		x: number
		y: number
		width: number
		height: number
	} | null>(null)
	const offsetMenuAnchorRef = useRef<View>(null)
	const scrollY = useSharedValue(0)
	const contentHeight = useSharedValue(0)
	const viewportHeight = useSharedValue(0)
	const scrollDirection = useSharedValue<'up' | 'down' | 'idle'>('idle')
	const lastScrollY = useSharedValue(0)
	const track = useCurrentTrack()
	const enableOldSchoolStyleLyric = useAppStore(
		(state) => state.settings.enableOldSchoolStyleLyric,
	)

	const {
		data: lyrics,
		isPending,
		isError,
		error,
	} = useSmartFetchLyrics(currentIndex === 1, track ?? undefined)
	const finalLyrics = useMemo(() => {
		if (!lyrics?.lyrics) return []
		const paddingTimestamp =
			(lyrics.lyrics.at(-1)?.timestamp ?? 0) + Number.EPSILON
		return [
			...lyrics.lyrics,
			{
				timestamp: paddingTimestamp,
				text: '',
				isPaddingItem: true,
			},
		]
	}, [lyrics])
	const {
		currentLyricIndex,
		onUserScrollEnd,
		onUserScrollStart,
		handleJumpToLyric,
	} = useLyricSync(lyrics?.lyrics ?? [], flashListRef, lyrics?.offset ?? 0)

	const scrollHandler = useAnimatedScrollHandler({
		onScroll: (e) => {
			const currentY = e.contentOffset.y
			const deltaY = currentY - lastScrollY.value

			// 检测滚动方向
			if (Math.abs(deltaY) > SCROLL_DIRECTION_THRESHOLD) {
				scrollDirection.value = deltaY > 0 ? 'up' : 'down'
			}

			lastScrollY.value = currentY
			scrollY.value = currentY
			contentHeight.value = e.contentSize.height
			viewportHeight.value = e.layoutMeasurement.height
		},
		onEndDrag: () => {
			scrollDirection.value = 'idle'
		},
	})

	// 我们不在本地创建 offset state，而是直接调用 queryClient 来更新 smartFetchLyrics 的缓存。当用户点击确认时，再保存到本地
	const handleChangeOffset = (delta: number) => {
		if (!lyrics || !track) return
		const newOffset = (lyrics.offset ?? 0) + delta
		queryClient.setQueryData(
			lyricsQueryKeys.smartFetchLyrics(track.uniqueKey),
			() => {
				return {
					...lyrics,
					offset: newOffset,
				}
			},
		)
	}

	const handleCloseOffsetMenu = async () => {
		setOffsetMenuVisible(false)
		if (!lyrics || !track) return
		const saveResult = await lyricService.saveLyricsToFile(
			{
				...lyrics,
				offset: lyrics.offset,
			},
			track.uniqueKey,
		)
		if (saveResult.isErr()) {
			toastAndLogError('保存歌词偏移量失败', saveResult.error, 'Lyrics')
			return
		}
		console.log('保存歌词偏移量成功:', lyrics.offset)
	}

	const handleEditLyrics = useCallback(() => {
		if (!track || !lyrics) return
		useModalStore
			.getState()
			.open('EditLyrics', { uniqueKey: track.uniqueKey, lyrics })
	}, [track, lyrics])

	const handleOpenOffsetMenu = useCallback(() => {
		setOffsetMenuVisible(true)
	}, [])

	const keyExtractor = useCallback(
		(item: LyricLine, index: number) => `${index}_${item.timestamp * 1000}`,
		[],
	)

	const extraData = useMemo(
		() => ({
			currentLyricIndex,
			handleJumpToLyric,
			enableOldSchoolStyleLyric,
		}),
		[currentLyricIndex, handleJumpToLyric, enableOldSchoolStyleLyric],
	)

	useLayoutEffect(() => {
		if (offsetMenuAnchorRef.current) {
			offsetMenuAnchorRef.current.measureInWindow((x, y, width, height) => {
				setOffsetMenuAnchor({ x, y, width, height })
			})
		}
	}, [offsetMenuVisible])

	if (!track) return null

	if (isPending) {
		return (
			<View style={styles.pendingContainer}>
				<ActivityIndicator size={'large'} />
			</View>
		)
	}

	if (isError) {
		return (
			<ScrollView
				style={styles.errorScrollView}
				contentContainerStyle={styles.errorContentContainer}
			>
				<Text
					variant='bodyMedium'
					style={styles.errorText}
				>
					歌词加载失败：{error.message}
				</Text>
			</ScrollView>
		)
	}

	const renderLyrics = () => {
		if (!lyrics.lyrics) {
			return (
				<Animated.ScrollView
					contentContainerStyle={styles.rawLyricsScrollViewContainer}
					scrollEventThrottle={16}
					onScroll={scrollHandler}
				>
					<Text
						variant='bodyMedium'
						style={styles.rawLyricsText}
					>
						{lyrics.rawTranslatedLyrics ? '原始歌词：' : ''}
						{lyrics.rawOriginalLyrics}
						{lyrics.rawTranslatedLyrics
							? `\n\n翻译歌词：${lyrics.rawTranslatedLyrics}`
							: ''}
					</Text>
				</Animated.ScrollView>
			)
		}
		return (
			<AnimatedFlashList
				ref={flashListRef}
				data={finalLyrics as (LyricLine & { isPaddingItem?: boolean })[]}
				renderItem={renderItem}
				extraData={extraData}
				keyExtractor={keyExtractor}
				contentContainerStyle={{
					justifyContent: 'center',
					pointerEvents: offsetMenuVisible ? 'none' : 'auto',
					paddingTop: windowHeight * 0.02,
				}}
				showsVerticalScrollIndicator={false}
				onScrollEndDrag={onUserScrollEnd}
				onScrollBeginDrag={onUserScrollStart}
				scrollEventThrottle={30}
				onScroll={scrollHandler}
				getItemType={(item) => (item.isPaddingItem ? 'padding' : 'lyric')}
			/>
		)
	}

	return (
		<View style={styles.lyricsContainer}>
			<View style={styles.lyricsContent}>
				<MaskedView
					style={{ flex: 1 }}
					maskElement={
						<View
							style={{ flex: 1 }}
							pointerEvents='none'
						>
							<LinearGradient
								style={[styles.gradient]}
								start={{ x: 0, y: 0 }}
								end={{ x: 0, y: 1 }}
								colors={['transparent', colors.background]}
								locations={[0, 1]}
							/>

							<View
								style={{
									flex: 1,
									backgroundColor: colors.background,
								}}
							/>

							<LinearGradient
								style={[styles.gradient]}
								start={{ x: 0, y: 0 }}
								end={{ x: 0, y: 1 }}
								colors={[colors.background, 'transparent']}
								locations={[0, 1]}
							/>
						</View>
					}
				>
					{/* 你要显示的内容放在这里 */}
					{renderLyrics()}
				</MaskedView>
			</View>

			{/* 播放器控件覆盖层 */}
			<LyricsControlOverlay
				scrollDirection={scrollDirection}
				offsetMenuVisible={offsetMenuVisible}
				onEditLyrics={handleEditLyrics}
				onOpenOffsetMenu={handleOpenOffsetMenu}
				offsetMenuAnchorRef={offsetMenuAnchorRef}
			/>

			{/* 歌词偏移量调整面板 */}
			<LyricsOffsetControl
				visible={offsetMenuVisible}
				anchor={offsetMenuAnchor}
				offset={lyrics.offset ?? 0}
				onChangeOffset={handleChangeOffset}
				onClose={handleCloseOffsetMenu}
			/>
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
	oldSchoolItemButton: {
		flexDirection: 'column',
		alignItems: 'center',
		gap: 4,
		borderRadius: 16,
		paddingVertical: 8,
		marginHorizontal: 30,
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
	modernItemButton: {
		flexDirection: 'column',
		alignItems: 'flex-start',
		gap: 4,
		borderRadius: 8,
		marginVertical: 4,
		paddingVertical: 6,
		marginHorizontal: 30,
		paddingLeft: 8,
		paddingRight: 8,
	},
	modernItemText: {
		textAlign: 'left',
		fontSize: 20,
		letterSpacing: 0,
		lineHeight: 28,
	},
	pendingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	errorScrollView: {
		flex: 1,
		marginHorizontal: 30,
	},
	errorContentContainer: {
		justifyContent: 'center',
		alignItems: 'center',
	},
	errorText: {
		textAlign: 'center',
	},
	rawLyricsScrollViewContainer: {
		justifyContent: 'center',
		alignItems: 'center',
	},
	rawLyricsText: {
		textAlign: 'center',
	},
	lyricsContainer: {
		flex: 1,
	},
	lyricsContent: {
		flex: 1,
		flexDirection: 'column',
	},
	gradient: {
		height: 60,
	},
})

Lyrics.displayName = 'Lyrics'

export default Lyrics

import { parseSpl, type LyricLine } from '@bbplayer/splash'
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
import {
	Dimensions,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import {
	ActivityIndicator,
	Divider,
	Icon,
	Text,
	useTheme,
} from 'react-native-paper'
import Animated, {
	type SharedValue,
	useAnimatedScrollHandler,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

import { LyricsControlOverlay } from '@/features/player/components/LyricsControlOverlay'
import useLyricSync from '@/features/player/hooks/useLyricSync'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useSmoothProgress from '@/hooks/player/useSmoothProgress'
import { lyricsQueryKeys, useSmartFetchLyrics } from '@/hooks/queries/lyrics'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { queryClient } from '@/lib/config/queryClient'
import lyricService from '@/lib/services/lyricService'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'
import { toastAndLogError } from '@/utils/error-handling'

import { KaraokeWord } from './lyrics/KaraokeWord'

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
	onPressBackground,
	currentTime,
}: {
	item: LyricLine & { isPaddingItem?: boolean }
	isHighlighted: boolean
	jumpToThisLyric: (index: number) => void
	index: number
	onPressBackground?: () => void
	currentTime: SharedValue<number>
}) {
	const colors = useTheme().colors
	const isHighlightedShared = useSharedValue(isHighlighted)

	useEffect(() => {
		isHighlightedShared.value = isHighlighted
	}, [isHighlighted, item.startTime, index, isHighlightedShared])

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
				{item.isDynamic && item.spans && item.spans.length > 0 ? (
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
								currentTime={currentTime}
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

const AnimatedRectButton = Animated.createAnimatedComponent(RectButton)

const ModernLyricLineItem = memo(function ModernLyricLineItem({
	item,
	isHighlighted,
	jumpToThisLyric,
	index,
	onPressBackground,
	currentTime,
}: {
	item: LyricLine & { isPaddingItem?: boolean }
	isHighlighted: boolean
	jumpToThisLyric: (index: number) => void
	index: number
	onPressBackground?: () => void
	currentTime: SharedValue<number>
}) {
	const theme = useTheme()
	const isHighlightedShared = useSharedValue(isHighlighted)

	useEffect(() => {
		isHighlightedShared.value = isHighlighted
	}, [isHighlighted, item.startTime, index, isHighlightedShared])

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
		if (item.isDynamic && item.spans && item.spans.length > 0) {
			return (
				<View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
					{item.spans.map((span, idx) => (
						<KaraokeWord
							key={`${index}_${idx}`}
							span={span}
							currentTime={currentTime}
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
		onPressBackground?: () => void
		currentTime: SharedValue<number>
	}
>) => {
	const resolvedExtraData = extraData as {
		currentLyricIndex: number
		handleJumpToLyric: (index: number) => void
		enableOldSchoolStyleLyric: boolean
		onPressBackground?: () => void
		currentTime: SharedValue<number>
	}
	const {
		currentLyricIndex,
		handleJumpToLyric,
		enableOldSchoolStyleLyric,
		onPressBackground,
		currentTime,
	} = resolvedExtraData ?? {}

	if (item.isPaddingItem) {
		return (
			<Pressable
				style={{ height: windowHeight / 2 }}
				onPress={onPressBackground}
			/>
		)
	}
	if (!extraData) throw new Error('Extradata 不存在')

	if (enableOldSchoolStyleLyric) {
		return (
			<OldSchoolLyricLineItem
				item={item}
				isHighlighted={index === currentLyricIndex}
				index={index}
				jumpToThisLyric={handleJumpToLyric}
				onPressBackground={onPressBackground}
				currentTime={currentTime}
			/>
		)
	}
	return (
		<ModernLyricLineItem
			item={item}
			isHighlighted={index === currentLyricIndex}
			index={index}
			jumpToThisLyric={handleJumpToLyric}
			onPressBackground={onPressBackground}
			currentTime={currentTime}
		/>
	)
}

const SCROLL_DIRECTION_THRESHOLD = 8

const Lyrics = memo(function Lyrics({
	currentIndex,
	onPressBackground,
}: {
	currentIndex: number
	onPressBackground?: () => void
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

	const { position: currentTime } = useSmoothProgress()

	const {
		data: lyrics,
		isPending,
		isError,
		error,
	} = useSmartFetchLyrics(currentIndex === 1, track ?? undefined)
	const [preferredLyricType, setPreferredLyricType] = useState<
		'translation' | 'romaji'
	>('translation')

	const finalLyrics = useMemo(() => {
		if (!lyrics?.lrc) return []

		const currentLyrics = lyrics
		try {
			// 判断可用性
			const hasTranslation = !!currentLyrics.tlyric
			const hasRomaji = !!currentLyrics.romalrc

			// 确定当前应该显示什么
			// 如果没有翻译，但有罗马音，强制显示罗马音
			// 如果没有罗马音，但有翻译，强制显示翻译
			// 如果都有，则根据用户偏好显示
			let activeType = preferredLyricType
			if (hasTranslation && !hasRomaji) activeType = 'translation'
			else if (!hasTranslation && hasRomaji) activeType = 'romaji'
			else if (!hasTranslation && !hasRomaji) activeType = 'translation' // fallback

			const secondaryLyrics =
				activeType === 'romaji' ? currentLyrics.romalrc : currentLyrics.tlyric

			// 主播亲测这样 hack 没问题！
			const mergedSpl = currentLyrics.lrc + '\n' + (secondaryLyrics ?? '')
			const { lines: parsedLines } = parseSpl(mergedSpl)

			const paddingTimestamp =
				(parsedLines.at(-1)?.startTime ?? 0) + Number.EPSILON
			return [
				...parsedLines,
				{
					startTime: paddingTimestamp,
					endTime: paddingTimestamp,
					content: '',
					translations: [],
					isDynamic: false,
					spans: [],
					isPaddingItem: true,
				} as LyricLine & { isPaddingItem?: boolean },
			]
		} catch (e) {
			toastAndLogError('解析歌词失败', e, 'Player.PlayerLyrics')
			return []
		}
	}, [lyrics, preferredLyricType])
	const {
		currentLyricIndex,
		onUserScrollEnd,
		onUserScrollStart,
		handleJumpToLyric,
	} = useLyricSync(
		(finalLyrics as (LyricLine & { isPaddingItem?: boolean })[]).filter(
			(l) => !l.isPaddingItem,
		),
		flashListRef,
		lyrics?.misc?.userOffset ?? 0,
	)

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
		const currentLyrics = lyrics
		const newOffset = (currentLyrics.misc?.userOffset ?? 0) + delta
		queryClient.setQueryData(
			lyricsQueryKeys.smartFetchLyrics(track.uniqueKey),
			() => {
				return {
					...currentLyrics,
					misc: {
						...currentLyrics.misc,
						userOffset: newOffset,
					},
				}
			},
		)
	}

	const handleCloseOffsetMenu = async () => {
		setOffsetMenuVisible(false)
		if (!lyrics || !track) return
		const currentLyrics = lyrics
		const saveResult = await lyricService.saveLyricsToFile(
			{
				...currentLyrics,
				misc: {
					...currentLyrics.misc,
					userOffset: currentLyrics.misc?.userOffset,
				},
			},
			track.uniqueKey,
		)
		if (saveResult.isErr()) {
			toastAndLogError('保存歌词偏移量失败', saveResult.error, 'Lyrics')
			return
		}
		console.log('保存歌词偏移量成功:', currentLyrics.misc?.userOffset)
	}

	const handleEditLyrics = useCallback(() => {
		if (!track || !lyrics) return
		useModalStore.getState().open('EditLyrics', {
			uniqueKey: track.uniqueKey,
			lyrics: lyrics,
		})
	}, [track, lyrics])

	const handleOpenOffsetMenu = useCallback(() => {
		setOffsetMenuVisible(true)
	}, [])

	const keyExtractor = useCallback(
		(item: LyricLine, index: number) => `${index}_${item.startTime}`,
		[],
	)

	const extraData = useMemo(
		() => ({
			currentLyricIndex,
			handleJumpToLyric,
			enableOldSchoolStyleLyric,
			onPressBackground,
			currentTime,
		}),
		[
			currentLyricIndex,
			handleJumpToLyric,
			enableOldSchoolStyleLyric,
			onPressBackground,
			currentTime,
		],
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
		if (!lyrics.lrc) {
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
						{lyrics ? '原始歌词：' : ''}
						{lyrics.lrc}
						{lyrics.tlyric ? `\n\n翻译歌词：${lyrics.tlyric}` : ''}
					</Text>
				</Animated.ScrollView>
			)
		}
		return (
			<AnimatedFlashList
				nestedScrollEnabled
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
		<View
			style={styles.lyricsContainer}
			testID='player-lyrics-view'
		>
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
				showTranslationToggle={!!lyrics?.tlyric && !!lyrics?.romalrc}
				translationType={
					// 这里的逻辑要和上面 finalLyrics 里的一致，或者更简单一点，因为只有当两者都有的时候才会显示 toggle
					// 而当两者都有的时候，activeType 就是 preferredLyricType
					preferredLyricType
				}
				onToggleTranslation={() =>
					setPreferredLyricType((prev) =>
						prev === 'translation' ? 'romaji' : 'translation',
					)
				}
			/>

			{/* 歌词偏移量调整面板 */}
			<LyricsOffsetControl
				visible={offsetMenuVisible}
				anchor={offsetMenuAnchor}
				offset={lyrics?.misc?.userOffset ?? 0}
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

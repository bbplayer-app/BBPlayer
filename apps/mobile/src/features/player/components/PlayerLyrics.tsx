import { parseAndMergeLyrics, type LyricLine } from '@bbplayer/splash'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
	Pressable,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from 'react-native'
import { ActivityIndicator, Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedScrollHandler,
	useSharedValue,
	useDerivedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { LyricsControlOverlay } from '@/features/player/components/LyricsControlOverlay'
import useLyricSync from '@/features/player/hooks/useLyricSync'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useSmoothProgress from '@/hooks/player/useSmoothProgress'
import { lyricsQueryKeys, useSmartFetchLyrics } from '@/hooks/queries/lyrics'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { queryClient } from '@/lib/config/queryClient'
import lyricService from '@/lib/services/lyricService'
import { toastAndLogError } from '@/utils/error-handling'

import { LyricActionSheet } from './lyrics/LyricActionSheet'
import {
	ModernLyricLineItem,
	OldSchoolLyricLineItem,
} from './lyrics/LyricLineItem'
import { LyricsOffsetControl } from './lyrics/LyricsOffsetControl'

const SCROLL_DIRECTION_THRESHOLD = 8

const Lyrics = memo(function Lyrics({
	currentIndex,
	onPressBackground,
}: {
	currentIndex: number
	onPressBackground?: () => void
}) {
	const dimensions = useWindowDimensions()
	const windowHeight = dimensions.height
	const colors = useTheme().colors
	const scrollViewRef = useRef<Animated.ScrollView>(null)
	const [actionMenuVisible, setActionMenuVisible] = useState(false)
	const itemLayoutsRef = useRef<{ [index: number]: number }>({})

	const scrollToIndex = useCallback(
		(index: number, animated = true) => {
			const y = itemLayoutsRef.current[index]
			if (y !== undefined && scrollViewRef.current) {
				scrollViewRef.current.scrollTo({
					y: Math.max(0, y - windowHeight * 0.15),
					animated,
				})
			}
		},
		[windowHeight],
	)

	const [offsetMenuVisible, setOffsetMenuVisible] = useState(false)
	const [offsetMenuAnchor, setOffsetMenuAnchor] = useState<{
		x: number
		y: number
		width: number
		height: number
	} | null>(null)
	const scrollDirection = useSharedValue<'up' | 'down' | 'idle'>('idle')
	const lastScrollY = useSharedValue(0)
	const track = useCurrentTrack()
	const enableOldSchoolStyleLyric = useAppStore(
		(state) => state.settings.enableOldSchoolStyleLyric,
	)
	const enableVerbatimLyrics = useAppStore(
		(state) => state.settings.enableVerbatimLyrics,
	)

	const { position: currentTime } = useSmoothProgress()

	useEffect(() => {
		itemLayoutsRef.current = {}
	}, [track?.uniqueKey])

	const {
		data: lyrics,
		isPending,
		isError,
		error,
	} = useSmartFetchLyrics(currentIndex === 1, track ?? undefined)
	const [preferredLyricType, setPreferredLyricType] = useState<
		'translation' | 'romaji'
	>('translation')

	const [tempOffset, setTempOffset] = useState(0)

	useEffect(() => {
		if (lyrics?.misc?.userOffset !== undefined) {
			setTempOffset(lyrics.misc.userOffset)
		} else {
			setTempOffset(0)
		}
	}, [lyrics?.misc?.userOffset])

	const offsetSharedValue = useSharedValue(0)
	useEffect(() => {
		offsetSharedValue.set(tempOffset)
	}, [tempOffset, offsetSharedValue])

	const adjustedCurrentTime = useDerivedValue(() => {
		return currentTime.value - offsetSharedValue.value
	})

	// so bro I trust react compiler
	const finalLyrics = (() => {
		if (!lyrics?.lrc) return []

		let parsedLines
		try {
			parsedLines = parseAndMergeLyrics({
				lrc: lyrics.lrc,
				tlyric: lyrics.tlyric,
				romalrc: lyrics.romalrc,
			})
		} catch (e) {
			toastAndLogError('解析歌词失败', e, 'Player.PlayerLyrics')
			return null
		}

		if (parsedLines.length === 0) return null

		const lastLine = parsedLines.at(-1)
		const paddingTimestamp =
			(lastLine ? lastLine.startTime : 0) + Number.EPSILON
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
	})()

	const {
		currentLyricIndex,
		onUserScrollEnd,
		onUserScrollStart,
		handleJumpToLyric,
	} = useLyricSync(
		((finalLyrics ?? []) as (LyricLine & { isPaddingItem?: boolean })[]).filter(
			(l) => !l.isPaddingItem,
		),
		scrollToIndex,
		-tempOffset,
		currentIndex === 1,
	)

	const scrollHandler = useAnimatedScrollHandler({
		onScroll: (e) => {
			const currentY = e.contentOffset.y
			const deltaY = currentY - lastScrollY.get()

			// 检测滚动方向
			if (Math.abs(deltaY) > SCROLL_DIRECTION_THRESHOLD) {
				scrollDirection.set(deltaY > 0 ? 'up' : 'down')
			}

			lastScrollY.set(currentY)
		},
		onBeginDrag: () => {
			scheduleOnRN(onUserScrollStart)
		},
		onEndDrag: () => {
			scrollDirection.set('idle')
			scheduleOnRN(onUserScrollEnd)
		},
	})

	const handleChangeOffset = (delta: number) => {
		setTempOffset((prev) => prev + delta)
	}

	const handleCloseOffsetMenu = () => {
		setOffsetMenuVisible(false)
		if (!lyrics || !track) return

		requestAnimationFrame(async () => {
			const currentLyrics = lyrics
			const newLyrics = {
				...currentLyrics,
				misc: {
					...currentLyrics.misc,
					userOffset: tempOffset,
				},
			}
			queryClient.setQueryData(
				lyricsQueryKeys.smartFetchLyrics(track.uniqueKey),
				newLyrics,
			)

			const saveResult = await lyricService.saveLyricsToFile(
				newLyrics,
				track.uniqueKey,
			)
			if (saveResult.isErr()) {
				toastAndLogError('保存歌词偏移量失败', saveResult.error, 'Lyrics')
			}
		})
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
		if (lyrics.errorMessage) {
			return (
				<ScrollView
					style={styles.errorScrollView}
					contentContainerStyle={styles.errorContentContainer}
				>
					<Text
						variant='bodyMedium'
						style={styles.errorText}
					>
						{lyrics.errorMessage}
					</Text>
				</ScrollView>
			)
		}

		if (!lyrics.lrc || !finalLyrics) {
			return (
				<Animated.ScrollView
					contentContainerStyle={[
						styles.rawLyricsScrollViewContainer,
						{
							paddingTop: windowHeight * 0.05,
							paddingBottom: windowHeight * 0.5,
						},
					]}
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
			<Animated.ScrollView
				nestedScrollEnabled
				ref={scrollViewRef}
				contentContainerStyle={{
					justifyContent: 'center',
					pointerEvents:
						offsetMenuVisible || actionMenuVisible ? 'none' : 'auto',
					paddingTop: windowHeight * 0.02,
				}}
				showsVerticalScrollIndicator={false}
				scrollEventThrottle={30}
				onScroll={scrollHandler}
			>
				{(finalLyrics as (LyricLine & { isPaddingItem?: boolean })[]).map(
					(item, index) => {
						if (item.isPaddingItem) {
							return (
								<Pressable
									key='padding_item'
									style={{ height: windowHeight / 2 }}
									onPress={onPressBackground}
								/>
							)
						}

						return (
							<View
								// oxlint-disable-next-line eslint/react/no-array-index-key -- lyrics might have duplicate start times, index is needed for uniqueness
								key={`${index}_${item.startTime}`}
								onLayout={(e) => {
									itemLayoutsRef.current[index] = e.nativeEvent.layout.y
								}}
							>
								{enableOldSchoolStyleLyric ? (
									<OldSchoolLyricLineItem
										item={item}
										isHighlighted={index === currentLyricIndex}
										index={index}
										jumpToThisLyric={handleJumpToLyric}
										onPressBackground={onPressBackground}
										currentTime={adjustedCurrentTime}
										enableVerbatimLyrics={enableVerbatimLyrics}
										preferredLyricType={preferredLyricType}
									/>
								) : (
									<ModernLyricLineItem
										item={item}
										isHighlighted={index === currentLyricIndex}
										index={index}
										jumpToThisLyric={handleJumpToLyric}
										onPressBackground={onPressBackground}
										currentTime={adjustedCurrentTime}
										enableVerbatimLyrics={enableVerbatimLyrics}
										preferredLyricType={preferredLyricType}
									/>
								)}
							</View>
						)
					},
				)}
			</Animated.ScrollView>
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
					{renderLyrics()}
				</MaskedView>
			</View>

			{/* 播放器控件覆盖层 */}
			<LyricsControlOverlay
				scrollDirection={scrollDirection}
				offsetMenuVisible={offsetMenuVisible}
				onOpenActionMenu={(anchor) => {
					setOffsetMenuAnchor(anchor)
					setActionMenuVisible(true)
				}}
			/>

			<LyricActionSheet
				visible={actionMenuVisible}
				anchor={offsetMenuAnchor}
				onDismiss={() => setActionMenuVisible(false)}
				showTranslationToggle={!!lyrics?.tlyric && !!lyrics?.romalrc}
				translationType={preferredLyricType}
				onToggleTranslation={() =>
					setPreferredLyricType((prev) =>
						prev === 'translation' ? 'romaji' : 'translation',
					)
				}
				onEditLyrics={handleEditLyrics}
				onOpenOffsetMenu={handleOpenOffsetMenu}
			/>

			{/* 歌词偏移量调整面板 */}
			<LyricsOffsetControl
				visible={offsetMenuVisible}
				anchor={offsetMenuAnchor}
				offset={tempOffset}
				onChangeOffset={handleChangeOffset}
				onClose={handleCloseOffsetMenu}
			/>
		</View>
	)
})

const styles = StyleSheet.create({
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

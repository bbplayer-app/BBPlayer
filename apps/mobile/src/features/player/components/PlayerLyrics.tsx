import { parseSpl, type LyricLine } from '@bbplayer/splash'
import MaskedView from '@react-native-masked-view/masked-view'
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
import toast from '@/utils/toast'

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
	const offsetMenuAnchorRef = useRef<View>(null)
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

	const { secondaryLyrics: effectiveSecondaryLyrics, isMismatch } =
		useMemo(() => {
			if (!lyrics?.lrc) return { secondaryLyrics: undefined, isMismatch: false }

			const currentLyrics = lyrics
			// 判断可用性
			const hasTranslation = !!currentLyrics.tlyric
			const hasRomaji = !!currentLyrics.romalrc

			let activeType = preferredLyricType
			if (hasTranslation && !hasRomaji) activeType = 'translation'
			else if (!hasTranslation && hasRomaji) activeType = 'romaji'
			else if (!hasTranslation && !hasRomaji) activeType = 'translation'

			const candidateSecondaryLyrics =
				activeType === 'romaji' ? currentLyrics.romalrc : currentLyrics.tlyric

			if (!candidateSecondaryLyrics) {
				return { secondaryLyrics: undefined, isMismatch: false }
			}

			let mainParsed, secondaryParsed
			try {
				mainParsed = parseSpl(currentLyrics.lrc!)
				secondaryParsed = parseSpl(candidateSecondaryLyrics)
			} catch {
				// 解析失败，返回原始歌词
				return {
					secondaryLyrics: candidateSecondaryLyrics,
					isMismatch: false,
				}
			}

			const mainTimestamps = new Set(mainParsed.lines.map((l) => l.startTime))
			let matchCount = 0
			if (secondaryParsed.lines.length > 0) {
				for (const line of secondaryParsed.lines) {
					if (mainTimestamps.has(line.startTime)) {
						matchCount++
					}
				}

				const matchRatio = matchCount / secondaryParsed.lines.length

				// 如果匹配度低于 20%，则视为不匹配
				if (matchRatio < 0.2) {
					return { secondaryLyrics: undefined, isMismatch: true }
				}
			}

			return {
				secondaryLyrics: candidateSecondaryLyrics,
				isMismatch: false,
			}
		}, [lyrics, preferredLyricType])

	useEffect(() => {
		if (isMismatch) {
			toast.info('歌词时间轴不匹配，已自动隐藏翻译/音译', {
				duration: 3000,
			})
		}
	}, [isMismatch, track?.uniqueKey])

	// so bro I trust react compiler
	const finalLyrics = (() => {
		const lrc = lyrics?.lrc
		if (!lrc) return []

		// 主播亲测这样 hack 没问题！
		const mergedSpl = lrc + '\n' + (effectiveSecondaryLyrics ?? '')

		let parsedLines
		try {
			const result = parseSpl(mergedSpl)
			parsedLines = result.lines
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
			queryClient.setQueryData(
				lyricsQueryKeys.smartFetchLyrics(track.uniqueKey),
				() => {
					return {
						...currentLyrics,
						misc: {
							...currentLyrics.misc,
							userOffset: tempOffset,
						},
					}
				},
			)

			const saveResult = await lyricService.saveLyricsToFile(
				{
					...currentLyrics,
					misc: {
						...currentLyrics.misc,
						userOffset: tempOffset,
					},
				},
				track.uniqueKey,
			)
			if (saveResult.isErr()) {
				toastAndLogError('保存歌词偏移量失败', saveResult.error, 'Lyrics')
				return
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
					pointerEvents: offsetMenuVisible ? 'none' : 'auto',
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
				onEditLyrics={handleEditLyrics}
				onOpenOffsetMenu={handleOpenOffsetMenu}
				offsetMenuAnchorRef={offsetMenuAnchorRef}
				showTranslationToggle={!!lyrics?.tlyric && !!lyrics?.romalrc}
				translationType={preferredLyricType}
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

import type { ExtractedPalette } from '@bbplayer/image-theme-colors'
import ImageThemeColors from '@bbplayer/image-theme-colors'
import { Orpheus, useIsPlaying } from '@bbplayer/orpheus'
import { Computed, useObserveEffect } from '@legendapp/state/react'
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia'
import { useImage } from 'expo-image'
import { useObserve } from 'expo-observe'
import { router, useIsFocused } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	AppState,
	Platform,
	StyleSheet,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native'
import PagerView from 'react-native-pager-view'
import { SegmentedButtons, useTheme } from 'react-native-paper'
import {
	cancelAnimation,
	createAnimatedComponent,
	Easing,
	useDerivedValue,
	useEvent,
	useHandler,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Lyrics from '@/features/player/components/lyrics/PlayerLyrics'
import { PodcastSubtitles } from '@/features/player/components/lyrics/PodcastSubtitles'
import { PlayerChaptersSheet } from '@/features/player/components/main/PlayerChaptersSheet'
import { PlayerCommentsPane } from '@/features/player/components/main/PlayerCommentsPane'
import { PlayerHeader } from '@/features/player/components/main/PlayerHeader'
import PlayerMainTab from '@/features/player/components/main/PlayerMainTab'
import { PlayerFunctionalMenu } from '@/features/player/components/menu/PlayerFunctionalMenu'
import { FluidBackground } from '@/features/player/components/visuals/FluidBackground'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import useAppStore from '@/hooks/stores/useAppStore'
import { usePlayerChaptersSheetStore } from '@/hooks/stores/usePlayerChaptersSheetStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { useResponsiveLayout } from '@/hooks/ui/useResponsiveLayout'
import type { BilibiliCommentItem } from '@/types/apis/bilibili'
import { resolveBilibiliImageUrl, resolveTrackCover } from '@/utils/imageUrl'
import log, { reportErrorToSentry } from '@/utils/log'

const AnimatedPagerView = createAnimatedComponent(PagerView)

interface PageScrollEvent {
	offset: number
	position: number
}

function usePageScrollHandler(
	handlers: {
		onPageScroll: (e: PageScrollEvent, context: Record<string, unknown>) => void
	},
	dependencies?: unknown[],
) {
	const { context, doDependenciesDiffer } = useHandler(handlers, dependencies)
	const subscribeForEvents = ['onPageScroll']

	return useEvent(
		(event) => {
			'worklet'
			const { onPageScroll } = handlers
			if (onPageScroll && event.eventName.endsWith('onPageScroll')) {
				onPageScroll(event as unknown as PageScrollEvent, context)
			}
		},
		subscribeForEvents,
		doDependenciesDiffer,
	)
}

const logger = log.extend('App.Player')

export default function PlayerPage() {
	const theme = useTheme()
	const colors = theme.colors
	const insets = useSafeAreaInsets()
	const pagerRef = useRef<PagerView>(null)
	const currentTrack = useCurrentTrack()
	const { markInteractive } = useObserve()

	useEffect(() => {
		markInteractive()
	}, [markInteractive])
	const currentTrackCover = resolveBilibiliImageUrl(
		currentTrack
			? resolveTrackCover(currentTrack.uniqueKey, currentTrack.coverUrl)
			: null,
	)
	const coverRef = useImage(currentTrackCover ?? '', {
		onError: () => void 0,
	})
	const { width, height } = useWindowDimensions()
	const { isTwoPane } = useResponsiveLayout()
	const colorScheme = useColorScheme()
	const pureWhiteBackground = useAppStore(
		(state) => state.settings.pureWhiteBackground,
	)
	// 旧版 md3 / streamer 等存量值也回落到普通渐变。
	const isFluidBackground = useAppStore(
		(state) =>
			!state.settings.pureWhiteBackground &&
			state.settings.playerBackgroundStyle === 'fluid',
	)
	const isFocused = useIsFocused()
	const isPlaying = useIsPlaying()
	const [palette, setPalette] = useState<ExtractedPalette | null>(null)
	const [isForeground, setIsForeground] = useState(
		AppState.currentState === 'active',
	)
	const [isPreventingBack, setIsPreventingBack] = useState(true)

	const [index, setIndex] = useState(0)
	const [rightPane, setRightPane] = useState('lyrics')
	const [commentsBvid, setCommentsBvid] = useState<string | null>(null)
	const [commentReplyId, setCommentReplyId] = useState<number | null>(null)
	const bvid =
		currentTrack?.source === 'bilibili'
			? currentTrack.bilibiliMetadata.bvid
			: undefined
	const commentsOpen = isTwoPane && rightPane === 'comments' && !!bvid
	const onReplyPress = useCallback(
		(item: BilibiliCommentItem) => setCommentReplyId(item.rpid),
		[],
	)
	const openComments = useCallback(() => {
		if (!bvid) return
		setCommentsBvid(bvid)
		setRightPane('comments')
	}, [bvid])
	useEffect(() => {
		setRightPane('lyrics')
		setCommentsBvid(null)
		setCommentReplyId(null)
	}, [currentTrack?.uniqueKey])
	const suppressDesktopLyrics =
		isFocused && isForeground && (isTwoPane ? !commentsOpen : index === 1)

	useEffect(() => {
		if (Platform.OS !== 'android') return
		void Orpheus.setDesktopLyricsSuppressed(suppressDesktopLyrics).catch(
			(e) => {
				logger.error('更新桌面歌词临时隐藏状态失败', e)
			},
		)
	}, [suppressDesktopLyrics])

	useEffect(() => {
		return () => {
			if (Platform.OS !== 'android') return
			void Orpheus.setDesktopLyricsSuppressed(false).catch((e) => {
				logger.error('恢复桌面歌词显示失败', e)
			})
		}
	}, [])

	const dismissPlayer = () => {
		setIsPreventingBack(false)
		if (router.canGoBack()) {
			router.back()
		}
	}

	useObserveEffect(() => {
		if (
			playbackContextStore$.ready.get() &&
			!playbackContextStore$.context.sessionId.get()
		) {
			void usePlayerChaptersSheetStore.getState().close()
			void usePlayerQueueSheetStore.getState().close()
			setIsPreventingBack(false)
		}
	})

	useObserveEffect(() => {
		if (playbackContextStore$.context.mode.get() !== 'podcast')
			void usePlayerChaptersSheetStore.getState().close()
	})

	useEffect(() => {
		const { ready, context } = playbackContextStore$.peek()
		if (!isPreventingBack && ready && context === null) {
			if (router.canGoBack()) router.back()
			else router.replace('/')
		}
	}, [isPreventingBack])

	const handleDismiss = () => {
		if (!isTwoPane && index === 1) {
			pagerRef.current?.setPage(0)
			return
		}
		dismissPlayer()
	}

	useEffect(() => {
		const subscription = AppState.addEventListener('change', (nextAppState) => {
			setIsForeground(nextAppState === 'active')
		})

		return () => {
			subscription.remove()
		}
	}, [])

	const scrollX = useSharedValue(0)

	useObserveEffect(() => {
		if (playbackContextStore$.context.mode.get() === 'podcast') {
			pagerRef.current?.setPageWithoutAnimation(0)
			setIndex(0)
			scrollX.set(0)
		}
	})

	useEffect(() => {
		if (isTwoPane) {
			setIndex(0)
			scrollX.set(0)
		}
	}, [isTwoPane, scrollX])

	const [menuVisible, setMenuVisible] = useState(false)

	const jumpTo = (key: string) => {
		if (isTwoPane) return
		const targetIndex = key === 'lyrics' ? 1 : 0
		pagerRef.current?.setPage(targetIndex)
	}

	useEffect(() => {
		if (!coverRef || !isForeground || pureWhiteBackground) return

		let cancelled = false
		// 加载新封面时保留当前配色；新结果到达后由对应背景做过渡。
		ImageThemeColors.extractThemeColorAsync(coverRef)
			.then((result) => {
				if (!cancelled) setPalette(result ?? null)
			})
			.catch((e) => {
				if (cancelled) return
				logger.error('提取封面图片主题色失败', e)
				reportErrorToSentry(e, '提取封面图片主题色失败', 'App.Player')
			})
		return () => {
			cancelled = true
		}
	}, [coverRef, currentTrackCover, isForeground, pureWhiteBackground])

	const gradientMainColor = useSharedValue(colors.background)
	const gradientColors = useDerivedValue(() => [
		gradientMainColor.value,
		colors.background,
	])
	useEffect(() => {
		if (isFluidBackground || pureWhiteBackground) return
		const topColor =
			colorScheme === 'light'
				? (palette?.lightMuted?.hex ?? palette?.muted?.hex ?? colors.background)
				: (palette?.darkMuted?.hex ?? palette?.muted?.hex ?? colors.background)
		gradientMainColor.set(
			withTiming(topColor, {
				duration: isForeground && isFocused ? 400 : 0,
				easing: Easing.out(Easing.quad),
			}),
		)
		return () => cancelAnimation(gradientMainColor)
	}, [
		palette,
		colorScheme,
		colors.background,
		isFluidBackground,
		pureWhiteBackground,
		isForeground,
		isFocused,
		gradientMainColor,
	])

	const scrimColors = useMemo(() => {
		if (colorScheme !== 'light') {
			return ['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0)']
		} else {
			return ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0)']
		}
	}, [colorScheme])

	usePreventRemove(isPreventingBack, () => {
		if (menuVisible) {
			setMenuVisible(false)
			return
		}

		if (usePlayerChaptersSheetStore.getState().isOpen) {
			void usePlayerChaptersSheetStore.getState().close()
			return
		}

		if (usePlayerQueueSheetStore.getState().isOpen) {
			void usePlayerQueueSheetStore.getState().close()
			return
		}
		if (commentsOpen) {
			if (commentReplyId !== null) setCommentReplyId(null)
			else setRightPane('lyrics')
			return
		}
		if (!isTwoPane && index === 1) {
			pagerRef.current?.setPage(0)
			return
		}
		handleDismiss()
	})

	const scrimEndVec = vec(0, height * 0.5)

	const pageScrollHandler = usePageScrollHandler({
		onPageScroll: (e) => {
			'worklet'
			scrollX.set(e.offset + e.position)
		},
	})

	return (
		<View style={[styles.fullScreen, { backgroundColor: colors.background }]}>
			<View style={styles.fullScreen}>
				{isFluidBackground && (
					<FluidBackground
						palette={palette}
						fallbackColor={colors.background}
						colorScheme={colorScheme === 'light' ? 'light' : 'dark'}
						paused={!isFocused || !isPlaying}
					/>
				)}
				{!pureWhiteBackground && (
					<Canvas
						style={StyleSheet.absoluteFill}
						pointerEvents='none'
					>
						{!isFluidBackground && (
							<Rect
								x={0}
								y={0}
								width={width}
								height={height}
							>
								<LinearGradient
									start={vec(0, 0)}
									end={vec(0, height)}
									colors={gradientColors}
								/>
							</Rect>
						)}
						<Rect
							x={0}
							y={0}
							width={width}
							height={height}
						>
							<LinearGradient
								start={vec(0, 0)}
								end={scrimEndVec}
								colors={scrimColors}
							/>
						</Rect>
					</Canvas>
				)}

				<View
					style={[
						styles.container,
						{
							paddingTop: insets.top,
						},
					]}
				>
					<View
						style={[
							styles.innerContainer,
							{ pointerEvents: menuVisible ? 'none' : 'auto' },
						]}
					>
						<Computed>
							<PlayerHeader
								onMorePress={() => setMenuVisible(true)}
								onBack={handleDismiss}
								index={index}
								scrollX={scrollX}
							/>
						</Computed>
						<Computed>
							{() => {
								const podcast =
									playbackContextStore$.context.mode.get() === 'podcast'
								const main = (
									<PlayerMainTab
										embedded={isTwoPane}
										onOpenComments={isTwoPane ? openComments : undefined}
										jumpTo={jumpTo}
										imageRef={coverRef}
										onPresent={() => {}}
									/>
								)
								const reader = podcast ? (
									<PodcastSubtitles
										active={
											(isTwoPane ? !commentsOpen : index === 1) && isFocused
										}
										embedded={isTwoPane}
									/>
								) : (
									<Lyrics
										currentIndex={isTwoPane ? (commentsOpen ? 0 : 1) : index}
										embedded={isTwoPane}
										onPressBackground={
											isTwoPane ? undefined : () => jumpTo('main')
										}
									/>
								)
								return isTwoPane ? (
									<View
										style={styles.widePlayer}
										testID='player-two-pane'
										collapsable={false}
									>
										<View style={styles.playbackPane}>{main}</View>
										<View
											style={[
												styles.readerPane,
												{ borderLeftColor: colors.outlineVariant },
											]}
										>
											{bvid && (
												<SegmentedButtons
													value={commentsOpen ? 'comments' : 'lyrics'}
													onValueChange={(value) =>
														value === 'comments'
															? openComments()
															: setRightPane('lyrics')
													}
													style={{ paddingVertical: 8 }}
													buttons={[
														{
															value: 'lyrics',
															label: podcast ? '字幕' : '歌词',
															testID: 'player-pane-lyrics',
														},
														{
															value: 'comments',
															label: '评论',
															testID: 'player-pane-comments',
														},
													]}
												/>
											)}
											<View
												style={[styles.tabView, commentsOpen && styles.hidden]}
											>
												{reader}
											</View>
											{bvid && commentsBvid === bvid && (
												<View
													style={[
														styles.tabView,
														!commentsOpen && styles.hidden,
													]}
												>
													<PlayerCommentsPane
														bvid={bvid}
														replyId={commentReplyId}
														onReplyPress={onReplyPress}
														onBack={() => setCommentReplyId(null)}
													/>
												</View>
											)}
										</View>
									</View>
								) : (
									<AnimatedPagerView
										key={podcast ? 'podcast' : 'music'}
										ref={pagerRef}
										style={styles.tabView}
										initialPage={index}
										onPageScroll={pageScrollHandler}
										onPageSelected={(e) => setIndex(e.nativeEvent.position)}
									>
										<View
											key='main'
											style={styles.tabView}
										>
											{main}
										</View>
										<View
											key='lyrics'
											style={styles.tabView}
										>
											{reader}
										</View>
									</AnimatedPagerView>
								)
							}}
						</Computed>
					</View>

					<PlayerChaptersSheet />
					<PlayerFunctionalMenu
						menuVisible={menuVisible}
						setMenuVisible={setMenuVisible}
					/>
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	fullScreen: {
		flex: 1,
	},
	container: {
		flex: 1,
	},
	innerContainer: {
		flex: 1,
	},
	widePlayer: {
		flex: 1,
		minHeight: 0,
		width: '100%',
		alignSelf: 'center',
		flexDirection: 'row',
		paddingBottom: 8,
	},
	playbackPane: { width: '42%', minHeight: 0 },
	readerPane: {
		flex: 1,
		minWidth: 0,
		borderLeftWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 24,
	},
	hidden: { display: 'none' },
	tabView: {
		flex: 1,
	},
})

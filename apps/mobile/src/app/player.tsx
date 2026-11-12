import type { ExtractedPalette } from '@bbplayer/image-theme-colors'
import ImageThemeColors from '@bbplayer/image-theme-colors'
import { Orpheus, useIsPlaying } from '@bbplayer/orpheus'
import { Computed, useObserveEffect } from '@legendapp/state/react'
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia'
import { useImage } from 'expo-image'
import { useObserve } from 'expo-observe'
import { router, useIsFocused } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
	AppState,
	Platform,
	StyleSheet,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native'
import PagerView from 'react-native-pager-view'
import { useTheme } from 'react-native-paper'
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

const PALETTE_CACHE_LIMIT = 8
const paletteCache = new Map<string, ExtractedPalette>()

function readCachedPalette(key: string) {
	if (!key) return undefined

	const cached = paletteCache.get(key)

	if (!cached) return undefined

	// 重新插入，维持 LRU 顺序。
	paletteCache.delete(key)
	paletteCache.set(key, cached)

	return cached
}

function writeCachedPalette(key: string, palette: ExtractedPalette) {
	if (!key) return

	paletteCache.delete(key)
	paletteCache.set(key, palette)

	const oldest = paletteCache.keys().next()

	if (paletteCache.size > PALETTE_CACHE_LIMIT && !oldest.done) {
		paletteCache.delete(oldest.value)
	}
}

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

	// 当前 ImageRef 对应的封面 URL。expo-image 在新图解码完成前会继续返回上一张图，
	// 只有 ref 真正替换后才能认为新 URL 的封面已就绪。
	const [loadedCoverUrl, setLoadedCoverUrl] = useState<string | null>(null)

	useEffect(() => {
		setLoadedCoverUrl(coverRef ? (currentTrackCover ?? null) : null)
		// currentTrackCover 是有意省略的：它变化时 ImageRef 仍指向上一张封面，
		// 若此时记录成新 URL，就会把上一首的提色结果缓存到新封面上。
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, [coverRef])

	const [isForeground, setIsForeground] = useState(
		AppState.currentState === 'active',
	)

	const [isPreventingBack, setIsPreventingBack] = useState(true)

	const [index, setIndex] = useState(0)
	const suppressDesktopLyrics = isFocused && isForeground && index === 1

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
		if (index === 1) {
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

	const [menuVisible, setMenuVisible] = useState(false)

	const jumpTo = (key: string) => {
		const targetIndex = key === 'lyrics' ? 1 : 0
		pagerRef.current?.setPage(targetIndex)
	}

	useEffect(() => {
		if (!loadedCoverUrl || pureWhiteBackground) return

		const cached = readCachedPalette(loadedCoverUrl)

		if (cached) {
			setPalette(cached)

			return
		}

		if (!coverRef || !isForeground) return

		let cancelled = false
		// 加载新封面时保留当前配色；新结果到达后由对应背景做过渡。
		ImageThemeColors.extractThemeColorAsync(coverRef)
			.then((result) => {
				if (cancelled) return

				setPalette(result ?? null)

				if (result) writeCachedPalette(loadedCoverUrl, result)
			})
			.catch((e) => {
				if (cancelled) return
				logger.error('提取封面图片主题色失败', e)
				reportErrorToSentry(e, '提取封面图片主题色失败', 'App.Player')
			})

		return () => {
			cancelled = true
		}
	}, [coverRef, loadedCoverUrl, isForeground, pureWhiteBackground])

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

		if (index === 1) {
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
							<AnimatedPagerView
								key={
									playbackContextStore$.context.mode.get() === 'podcast'
										? 'podcast'
										: 'music'
								}
								ref={pagerRef}
								style={styles.tabView}
								initialPage={0}
								onPageScroll={pageScrollHandler}
								onPageSelected={(e) => setIndex(e.nativeEvent.position)}
							>
								{[
									<View
										key='main'
										style={styles.tabView}
									>
										<PlayerMainTab
											jumpTo={jumpTo}
											imageRef={coverRef}
											onPresent={() => {}}
										/>
									</View>,
									<View
										key='lyrics'
										style={styles.tabView}
									>
										{playbackContextStore$.context.mode.get() === 'podcast' ? (
											<PodcastSubtitles active={index === 1 && isFocused} />
										) : (
											<Lyrics
												currentIndex={index}
												onPressBackground={() => jumpTo('main')}
											/>
										)}
									</View>,
								]}
							</AnimatedPagerView>
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
	tabView: {
		flex: 1,
	},
})

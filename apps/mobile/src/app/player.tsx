import type { ExtractedPalette } from '@bbplayer/image-theme-colors'
import ImageThemeColors from '@bbplayer/image-theme-colors'
import { Computed, useObserveEffect } from '@legendapp/state/react'
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia'
import { useImage } from 'expo-image'
import { useObserve } from 'expo-observe'
import { router, useIsFocused } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
	AppState,
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
	// 旧版 md3 / streamer 等存量值也回落到普通渐变。
	const isFluidBackground = useAppStore(
		(state) => state.settings.playerBackgroundStyle === 'fluid',
	)
	const isFocused = useIsFocused()
	const [palette, setPalette] = useState<ExtractedPalette | null>(null)
	const [isForeground, setIsForeground] = useState(
		AppState.currentState === 'active',
	)
	const [isPreventingBack, setIsPreventingBack] = useState(true)

	const [index, setIndex] = useState(0)

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
		const targetIndex =
			key === 'lyrics' &&
			playbackContextStore$.context.mode.peek() !== 'podcast'
				? 1
				: 0
		pagerRef.current?.setPage(targetIndex)
	}

	useEffect(() => {
		if (!coverRef || !isForeground) return

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
	}, [coverRef, currentTrackCover, isForeground])

	const gradientMainColor = useSharedValue(colors.background)
	const gradientColors = useDerivedValue(() => [
		gradientMainColor.value,
		colors.background,
	])
	useEffect(() => {
		if (isFluidBackground) return
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
		<View style={styles.fullScreen}>
			<View style={styles.fullScreen}>
				{isFluidBackground && (
					<FluidBackground
						palette={palette}
						fallbackColor={colors.background}
						colorScheme={colorScheme === 'light' ? 'light' : 'dark'}
						paused={!isFocused}
					/>
				)}
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
								index={
									playbackContextStore$.context.mode.get() === 'podcast'
										? 0
										: index
								}
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
								scrollEnabled={
									playbackContextStore$.context.mode.get() !== 'podcast'
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
									...(playbackContextStore$.context.mode.get() === 'podcast'
										? []
										: [
												<View
													key='lyrics'
													style={styles.tabView}
												>
													<Lyrics
														currentIndex={index}
														onPressBackground={() => jumpTo('main')}
													/>
												</View>,
											]),
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

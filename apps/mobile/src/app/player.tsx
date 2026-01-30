import type { TrueSheet } from '@lodev09/react-native-true-sheet'
import ImageThemeColors from '@roitium/expo-image-theme-colors'
import {
	Canvas,
	Group,
	LinearGradient,
	Rect,
	vec,
} from '@shopify/react-native-skia'
import { useImage } from 'expo-image'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
	AppState,
	StyleSheet,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native'
import { useTheme } from 'react-native-paper'
import {
	Easing,
	useDerivedValue,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabView } from 'react-native-tab-view'

import PlayerQueueModal from '@/components/modals/PlayerQueueModal'
import { PlayerFunctionalMenu } from '@/features/player/components/PlayerFunctionalMenu'
import { PlayerHeader } from '@/features/player/components/PlayerHeader'
import Lyrics from '@/features/player/components/PlayerLyrics'
import PlayerMainTab from '@/features/player/components/PlayerMainTab'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import useAppStore from '@/hooks/stores/useAppStore'
import log, { reportErrorToSentry } from '@/utils/log'
import toast from '@/utils/toast'

const logger = log.extend('App.Player')

const routes = [
	{ key: 'main', title: 'Main' },
	{ key: 'lyrics', title: 'Lyrics' },
]

export default function PlayerPage() {
	const theme = useTheme()
	const colors = theme.colors
	const insets = useSafeAreaInsets()
	const sheetRef = useRef<TrueSheet>(null)
	const currentTrack = useCurrentTrack()
	const coverRef = useImage(currentTrack?.coverUrl ?? '', {
		onError: () => void 0,
	})
	const { width, height } = useWindowDimensions()
	const colorScheme = useColorScheme()
	const playerBackgroundStyle = useAppStore(
		(state) => state.settings.playerBackgroundStyle,
	)
	const setSettings = useAppStore((state) => state.setSettings)
	const [isForeground, setIsForeground] = useState(
		AppState.currentState === 'active',
	)

	useEffect(() => {
		const subscription = AppState.addEventListener('change', (nextAppState) => {
			setIsForeground(nextAppState === 'active')
		})

		return () => {
			subscription.remove()
		}
	}, [])

	const realHeight = useMemo(() => {
		return height + insets.top + insets.bottom
	}, [height, insets.bottom, insets.top])

	const gradientMainColor = useSharedValue(colors.background)

	const [index, setIndex] = useState(0)
	const [menuVisible, setMenuVisible] = useState(false)

	const gradientColors = useDerivedValue(() => {
		if (playerBackgroundStyle !== 'gradient') {
			return [colors.background, colors.background]
		}
		return [gradientMainColor.value, colors.background]
	})

	useEffect(() => {
		if (!coverRef || playerBackgroundStyle === 'md3' || !isForeground) {
			if (playerBackgroundStyle !== 'gradient' && !isForeground) {
				gradientMainColor.set(colors.background)
			}
			return
		}
		ImageThemeColors.extractThemeColorAsync(coverRef)
			.then((palette) => {
				const animationConfig = {
					duration: 400,
					easing: Easing.out(Easing.quad),
				}

				if (playerBackgroundStyle === 'gradient') {
					let topColor: string
					if (colorScheme === 'dark') {
						topColor =
							palette.darkMuted?.hex ?? palette.muted?.hex ?? colors.background
					} else {
						topColor =
							palette.lightMuted?.hex ?? palette.muted?.hex ?? colors.background
					}

					gradientMainColor.set(withTiming(topColor, animationConfig))
				}
			})
			.catch((e) => {
				logger.error('提取封面图片主题色失败', e)
				reportErrorToSentry(e, '提取封面图片主题色失败', 'App.Player')
			})
	}, [
		colorScheme,
		colors.background,
		coverRef,
		gradientMainColor,
		isForeground,
		playerBackgroundStyle,
	])

	const renderScene = ({
		route,
		jumpTo,
	}: {
		route: { key: string; title: string }
		jumpTo: (key: string) => void
	}) => {
		switch (route.key) {
			case 'main':
				return (
					<PlayerMainTab
						sheetRef={sheetRef}
						jumpTo={jumpTo}
						imageRef={coverRef}
						onPresent={() => setQueueVisible(true)}
					/>
				)
			case 'lyrics':
				return <Lyrics currentIndex={index} />
		}
	}

	const scrimColors = useMemo(() => {
		if (playerBackgroundStyle !== 'gradient')
			return ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']
		if (colorScheme === 'dark') {
			return ['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0)']
		} else {
			return ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0)']
		}
	}, [colorScheme, playerBackgroundStyle])

	const [queueVisible, setQueueVisible] = useState(false)

	usePreventRemove(index === 1 || menuVisible || queueVisible, () => {
		if (menuVisible) {
			setMenuVisible(false)
			return
		}
		if (queueVisible) {
			const sheet = sheetRef.current
			if (!sheet) {
				setQueueVisible(false)
				return
			}
			sheet
				.dismiss()
				.catch(() => {
					// Ignore error if view not found or already dismissed
				})
				.finally(() => {
					setQueueVisible(false)
				})
			return
		}
		if (index === 1) {
			setIndex(0)
		}
	})

	const scrimEndVec = vec(0, realHeight * 0.5)

	useEffect(() => {
		// @ts-expect-error -- 虽然我们项目内已经移除了 streamer 选项，但部分存量用户可能还在这个选项，需要帮他回退
		if (playerBackgroundStyle === 'streamer') {
			toast.show(
				'因为会对性能造成较大影响，并且也不好看，所以我们移除了流光效果，已为您回退到渐变模式',
			)
			setSettings({ playerBackgroundStyle: 'gradient' })
		}
	}, [playerBackgroundStyle, setSettings])

	const FallbackBackground = useMemo(
		() => (
			<View
				style={[
					StyleSheet.absoluteFill,
					{ backgroundColor: colors.background },
				]}
			/>
		),
		[colors.background],
	)

	return (
		<>
			{isForeground ? (
				<Canvas style={StyleSheet.absoluteFill}>
					<Rect
						x={0}
						y={0}
						width={width}
						height={realHeight}
						color={colors.background}
					/>
					{playerBackgroundStyle === 'gradient' && (
						<Group>
							<Rect
								x={0}
								y={0}
								width={width}
								height={realHeight}
							>
								<LinearGradient
									start={vec(0, 0)}
									end={vec(0, realHeight)}
									colors={gradientColors}
									positions={[0, 1]}
								/>
							</Rect>
							<Rect
								x={0}
								y={0}
								width={width}
								height={realHeight}
							>
								<LinearGradient
									start={vec(0, 0)}
									end={scrimEndVec}
									colors={scrimColors}
								/>
							</Rect>
						</Group>
					)}
				</Canvas>
			) : (
				FallbackBackground
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
					<PlayerHeader
						onMorePress={() => setMenuVisible(true)}
						index={index}
					/>
					<TabView
						style={styles.tabView}
						navigationState={{ index, routes }}
						renderScene={renderScene}
						onIndexChange={setIndex}
						initialLayout={{ width: width }}
						lazy={({ route }) => route.key === 'lyrics'}
						renderTabBar={() => null}
					/>
				</View>

				<PlayerFunctionalMenu
					menuVisible={menuVisible}
					setMenuVisible={setMenuVisible}
				/>

				<PlayerQueueModal
					sheetRef={sheetRef}
					isVisible={queueVisible}
					onDidDismiss={() => setQueueVisible(false)}
					onDidPresent={() => setQueueVisible(true)}
				/>
			</View>
		</>
	)
}

const styles = StyleSheet.create({
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

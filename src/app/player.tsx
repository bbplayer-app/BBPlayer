import PlayerQueueModal from '@/components/modals/PlayerQueueModal'
import backgroundStreamerShader from '@/features/player/components/BGStreamerShader'
import { PlayerFunctionalMenu } from '@/features/player/components/PlayerFunctionalMenu'
import { PlayerHeader } from '@/features/player/components/PlayerHeader'
import Lyrics from '@/features/player/components/PlayerLyrics'
import PlayerMainTab from '@/features/player/components/PlayerMainTab'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import useAppStore from '@/hooks/stores/useAppStore'
import log, { reportErrorToSentry } from '@/utils/log'
import toast from '@/utils/toast'
import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import ImageThemeColors from '@roitium/expo-image-theme-colors'
import {
	Canvas,
	Group,
	LinearGradient,
	Rect,
	Shader,
	Skia,
	vec,
} from '@shopify/react-native-skia'
import { useImage } from 'expo-image'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
	StyleSheet,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native'
import { useTheme } from 'react-native-paper'
import {
	cancelAnimation,
	Easing,
	useDerivedValue,
	useSharedValue,
	withRepeat,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabView } from 'react-native-tab-view'

const logger = log.extend('App.Player')

const routes = [
	{ key: 'main', title: 'Main' },
	{ key: 'lyrics', title: 'Lyrics' },
]

export default function PlayerPage() {
	const theme = useTheme()
	const colors = theme.colors
	const insets = useSafeAreaInsets()
	const sheetRef = useRef<BottomSheetMethods>(null)
	const currentTrack = useCurrentTrack()
	const coverRef = useImage(currentTrack?.coverUrl ?? '')
	const { width, height } = useWindowDimensions()
	const colorScheme = useColorScheme()
	const playerBackgroundStyle = useAppStore(
		(state) => state.settings.playerBackgroundStyle,
	)
	const setSettings = useAppStore((state) => state.setSettings)

	const realHeight = useMemo(() => {
		return height + insets.top + insets.bottom
	}, [height, insets.bottom, insets.top])

	const gradientMainColor = useSharedValue(colors.background)

	const shaderTime = useSharedValue(0)
	const streamerColor1 = useSharedValue(colors.background)
	const streamerColor2 = useSharedValue(colors.background)

	const [index, setIndex] = useState(0)
	const [menuVisible, setMenuVisible] = useState(false)

	useEffect(() => {
		if (playerBackgroundStyle !== 'streamer') {
			cancelAnimation(shaderTime)
			shaderTime.value = 0
			return
		}
		shaderTime.value = withRepeat(
			withTiming(30000, { duration: 30000, easing: Easing.linear }),
			-1,
			false,
		)

		return () => cancelAnimation(shaderTime)
	}, [playerBackgroundStyle, shaderTime])

	const gradientColors = useDerivedValue(() => {
		if (playerBackgroundStyle !== 'gradient') {
			return [colors.background, colors.background]
		}
		return [gradientMainColor.value, colors.background]
	})

	const streamerUniforms = useDerivedValue(() => {
		const shaderTimeValue = shaderTime.value / 1000.0

		return {
			time: shaderTimeValue,
			resolution: [width, realHeight],
			color1: Skia.Color(streamerColor1.value),
			color2: Skia.Color(streamerColor2.value),
		}
	}, [shaderTime, streamerColor1, streamerColor2, width, realHeight])

	useEffect(() => {
		if (!coverRef || playerBackgroundStyle === 'md3') {
			if (playerBackgroundStyle !== 'gradient') {
				gradientMainColor.set(colors.background)
			}
			if (playerBackgroundStyle !== 'streamer') {
				streamerColor1.set(colors.background)
				streamerColor2.set(colors.background)
			}
			return
		}
		ImageThemeColors.extractThemeColorAsync(coverRef)
			.then((palette) => {
				const md3Bg = colors.background
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

				if (playerBackgroundStyle === 'streamer') {
					let c1_hex: string, c2_hex: string
					if (colorScheme === 'dark') {
						c2_hex = palette.darkMuted?.hex ?? palette.muted?.hex ?? md3Bg
						c1_hex = md3Bg
					} else {
						c2_hex = palette.lightMuted?.hex ?? palette.muted?.hex ?? md3Bg
						c1_hex = md3Bg
					}
					streamerColor1.set(withTiming(c1_hex, animationConfig))
					streamerColor2.set(withTiming(c2_hex, animationConfig))
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
		playerBackgroundStyle,
		streamerColor1,
		streamerColor2,
	])

	const renderScene = useMemo(
		() =>
			// eslint-disable-next-line react/display-name
			({
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
							/>
						)
					case 'lyrics':
						return <Lyrics currentIndex={index} />
				}
			},
		[coverRef, index],
	)

	const scrimColors = useMemo(() => {
		if (playerBackgroundStyle !== 'gradient')
			return ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']
		if (colorScheme === 'dark') {
			return ['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0)']
		} else {
			return ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0)']
		}
	}, [colorScheme, playerBackgroundStyle])

	usePreventRemove(index === 1, () => setIndex(0))

	const scrimEndVec = vec(0, realHeight * 0.5)

	useEffect(() => {
		if (backgroundStreamerShader || playerBackgroundStyle !== 'streamer') return

		toast.error('无法加载流光效果着色器，已自动回退到渐变模式')
		setSettings({ playerBackgroundStyle: 'gradient' })
	}, [playerBackgroundStyle, setSettings])

	return (
		<>
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

				{playerBackgroundStyle === 'streamer' && backgroundStreamerShader && (
					<Group opacity={0.3}>
						<Rect
							x={0}
							y={0}
							width={width}
							height={realHeight}
						>
							<Shader
								source={backgroundStreamerShader}
								uniforms={streamerUniforms}
							/>
						</Rect>
					</Group>
				)}
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

				<PlayerQueueModal sheetRef={sheetRef} />
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

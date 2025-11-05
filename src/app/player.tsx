import PlayerQueueModal from '@/components/modals/PlayerQueueModal'
import { PlayerFunctionalMenu } from '@/features/player/components/PlayerFunctionalMenu'
import { PlayerHeader } from '@/features/player/components/PlayerHeader'
import Lyrics from '@/features/player/components/PlayerLyrics'
import PlayerMainTab from '@/features/player/components/PlayerMainTab'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import log, { reportErrorToSentry } from '@/utils/log'
import ImageThemeColors from '@bbplayer-app/expo-image-theme-colors'
import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
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
	StyleSheet,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native'
import { useTheme } from 'react-native-paper'
import {
	Easing,
	interpolateColor,
	useDerivedValue,
	useSharedValue,
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

	const realHeight = useMemo(() => {
		return height + insets.top + insets.bottom
	}, [height, insets.bottom, insets.top])

	const gradientMainColor = useSharedValue(colors.background)
	const gradientBottomColor = useSharedValue(colors.background)

	const [index, setIndex] = useState(0)
	const [menuVisible, setMenuVisible] = useState(false)

	const gradientColors = useDerivedValue(() => {
		return [gradientMainColor.value, gradientBottomColor.value]
	})

	useEffect(() => {
		if (!coverRef) return
		ImageThemeColors.extractThemeColorAsync(coverRef)
			.then((palette) => {
				let topColor: string
				if (colorScheme === 'dark') {
					topColor =
						palette.darkMuted?.hex ?? palette.muted?.hex ?? colors.background
				} else {
					topColor =
						palette.lightMuted?.hex ?? palette.muted?.hex ?? colors.background
				}

				const bottomColor = interpolateColor(
					0.3,
					[0, 1],
					[colors.background, topColor],
				)

				const animationConfig = {
					duration: 400,
					easing: Easing.out(Easing.quad),
				}

				gradientMainColor.set(withTiming(topColor, animationConfig))
				gradientBottomColor.set(withTiming(bottomColor, animationConfig))
			})
			.catch((e) => {
				logger.error('提取封面图片主题色失败', e)
				reportErrorToSentry(e, '提取封面图片主题色失败', 'App.Player')
			})
	})

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
						return <Lyrics />
				}
			},
		[coverRef],
	)

	const scrimColors = useMemo(() => {
		if (colorScheme === 'dark') {
			return ['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0)']
		} else {
			return ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0)']
		}
	}, [colorScheme])

	const scrimEndVec = vec(0, realHeight * 0.5)

	return (
		<>
			<Canvas style={StyleSheet.absoluteFill}>
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
			</Canvas>

			{/* ... 你的其他 UI (View, TabView, etc.) ... */}
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

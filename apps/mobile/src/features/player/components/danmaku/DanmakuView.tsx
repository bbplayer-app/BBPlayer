import { useIsPlaying } from '@bbplayer/orpheus'
import { Canvas, Skia, Picture, FontStyle } from '@shopify/react-native-skia'
import { useEffect } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import {
	useAnimatedReaction,
	useDerivedValue,
	useSharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import useDanmakuLoader from '@/features/player/hooks/danmaku/useDanmakuLoader'
import { useDanmakuRender } from '@/features/player/hooks/danmaku/useDanmakuRender'
import useSmoothProgress from '@/hooks/player/useSmoothProgress'

interface DanmakuViewProps {
	bvid: string
	cid: number | undefined
	width: number
	height: number
	enable: boolean
}

const fontMgr = Skia.FontMgr.System()
const familyName = Platform.select({
	ios: 'PingFang SC',
	android: 'sans-serif',
	default: 'sans-serif',
})
const typeface = fontMgr.matchFamilyStyle(familyName, FontStyle.Bold)
const customFontMgr = Skia.TypefaceFontProvider.Make()
customFontMgr.registerFont(typeface, 'BBPlayerFont')

export const DanmakuView = ({
	bvid,
	cid,
	width,
	height,
	enable,
}: DanmakuViewProps) => {
	const { position } = useSmoothProgress()
	const currentTimeMs = useDerivedValue(() => position.value * 1000)
	const isPlaying = useIsPlaying()

	const loaderTime = useSharedValue(0)

	const { rawDataSV } = useDanmakuLoader(bvid, cid, loaderTime)

	const { picture, resetEngine } = useDanmakuRender({
		rawDataSV,
		currentTime: currentTimeMs,
		isPlaying,
		fontMgr: customFontMgr,
		width,
		height,
		fontFamilyName: 'BBPlayerFont',
		enabled: enable,
	})

	useEffect(() => {
		resetEngine(0)
	}, [bvid, cid, resetEngine])

	useAnimatedReaction(
		() => position.value,
		(current, previous) => {
			if (previous === null) return

			const diff = Math.abs(current - previous)
			if (diff > 1.0) {
				scheduleOnRN(resetEngine, current * 1000)
				loaderTime.set(current * 1000)
			} else {
				const currentInt = Math.floor(current)
				if (currentInt % 5 === 0 && Math.floor(previous) !== currentInt) {
					loaderTime.set(current * 1000)
				}
			}
		},
		[position],
	)

	if (!picture) return null

	return (
		<View
			style={StyleSheet.absoluteFill}
			pointerEvents='none'
		>
			<Canvas style={{ flex: 1 }}>
				<Picture picture={picture} />
			</Canvas>
		</View>
	)
}

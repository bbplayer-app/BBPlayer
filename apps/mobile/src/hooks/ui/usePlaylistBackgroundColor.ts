import type { ExtractedPalette } from '@bbplayer/image-theme-colors'
import ImageThemeColors from '@bbplayer/image-theme-colors'
import type { ImageRef } from 'expo-image'
import { useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'

import { hexToHsl, hslToString } from '@/utils/color'
import { reportErrorToSentry } from '@/utils/log'

function getDominantColor(
	palette: ExtractedPalette | undefined,
	isDarkMode: boolean,
): string | undefined {
	if (!palette) return undefined
	if (isDarkMode) {
		return palette.darkMuted?.hex ?? palette.muted?.hex
	} else {
		return palette.lightMuted?.hex ?? palette.muted?.hex
	}
}

function computeLightenedColor(
	hexColor: string | undefined,
	lightenAmount = 10,
): string | undefined {
	if (!hexColor) return undefined

	const hsl = hexToHsl(hexColor)
	const newLightness = Math.min(hsl.l + lightenAmount, 100)
	return hslToString(hsl.h, hsl.s, newLightness)
}

export interface PlaylistBackgroundColorResult {
	backgroundColor: string
	nowPlayingBarColor: string | undefined
}

/**
 * 供播放列表使用，根据封面提取主题色和对应的 NowPlayingBar 颜色
 */
export function usePlaylistBackgroundColor(
	imageRef: ImageRef | null | undefined,
	isDarkMode: boolean,
	fallbackColor: string,
): PlaylistBackgroundColorResult {
	const [palette, setPalette] = useState<ExtractedPalette | undefined>(
		undefined,
	)
	const [appState, setAppState] = useState(AppState.currentState)

	useEffect(() => {
		const subscription = AppState.addEventListener('change', (nextAppState) => {
			setAppState(nextAppState)
		})
		return () => {
			subscription.remove()
		}
	}, [])

	useEffect(() => {
		if (!imageRef) {
			setPalette(undefined)
			return
		}

		if (appState !== 'active') {
			return
		}

		let isCancelled = false

		const extract = async () => {
			try {
				const result = await ImageThemeColors.extractThemeColorAsync(imageRef)
				if (!isCancelled) {
					setPalette(result)
				}
			} catch (e) {
				if (!isCancelled) {
					reportErrorToSentry(e, '提取图片主题色失败', 'Hooks.useImageColor')
				}
			}
		}

		void extract()

		return () => {
			isCancelled = true
		}
	}, [imageRef, appState])

	const result = useMemo<PlaylistBackgroundColorResult>(() => {
		const dominantColor = getDominantColor(palette, isDarkMode)
		const backgroundColor = dominantColor ?? fallbackColor

		const nowPlayingBarColor = isDarkMode
			? computeLightenedColor(dominantColor)
			: computeLightenedColor(dominantColor, -10)

		return {
			backgroundColor,
			nowPlayingBarColor,
		}
	}, [palette, isDarkMode, fallbackColor])

	return result
}

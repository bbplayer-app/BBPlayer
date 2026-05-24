import type { ExtractedPalette } from '@bbplayer/image-theme-colors'
import ImageThemeColors from '@bbplayer/image-theme-colors'
import type { ImageRef } from 'expo-image'
import { useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'

import { clampHslLightness, hexToHsl, hslToString } from '@/utils/color'
import { reportErrorToSentry } from '@/utils/log'

const DARK_BACKGROUND_MIN_LIGHTNESS = 10
const DARK_BACKGROUND_MAX_LIGHTNESS = 18
const LIGHT_BACKGROUND_MIN_LIGHTNESS = 90
const LIGHT_BACKGROUND_MAX_LIGHTNESS = 96
const DARK_BAR_MIN_LIGHTNESS = 16
const DARK_BAR_MAX_LIGHTNESS = 24
const LIGHT_BAR_MIN_LIGHTNESS = 86
const LIGHT_BAR_MAX_LIGHTNESS = 92
const BACKGROUND_MAX_SATURATION = 38

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

function computeBackgroundColor(
	hexColor: string | undefined,
	isDarkMode: boolean,
	fallbackColor: string,
): string {
	if (!hexColor) return fallbackColor

	if (isDarkMode) {
		return clampHslLightness(
			hexColor,
			DARK_BACKGROUND_MIN_LIGHTNESS,
			DARK_BACKGROUND_MAX_LIGHTNESS,
			BACKGROUND_MAX_SATURATION,
		)
	}

	return clampHslLightness(
		hexColor,
		LIGHT_BACKGROUND_MIN_LIGHTNESS,
		LIGHT_BACKGROUND_MAX_LIGHTNESS,
		BACKGROUND_MAX_SATURATION,
	)
}

function computeNowPlayingBarColor(
	hexColor: string | undefined,
	isDarkMode: boolean,
): string | undefined {
	if (!hexColor) return undefined

	if (isDarkMode) {
		return clampHslLightness(
			hexColor,
			DARK_BAR_MIN_LIGHTNESS,
			DARK_BAR_MAX_LIGHTNESS,
			BACKGROUND_MAX_SATURATION,
		)
	}

	return clampHslLightness(
		hexColor,
		LIGHT_BAR_MIN_LIGHTNESS,
		LIGHT_BAR_MAX_LIGHTNESS,
		BACKGROUND_MAX_SATURATION,
	)
}

export interface PlaylistBackgroundColorResult {
	backgroundColor: string
	nowPlayingBarColor: string | undefined
	primaryButtonColor?: string
	primaryButtonTextColor?: string
	secondaryButtonContainerColor?: string
	secondaryButtonIconColor?: string
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
					if (result) {
						setPalette(result)
					} else {
						setPalette(undefined)
					}
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
		const backgroundColor = computeBackgroundColor(
			dominantColor,
			isDarkMode,
			fallbackColor,
		)

		const nowPlayingBarColor = computeNowPlayingBarColor(
			dominantColor,
			isDarkMode,
		)

		let primaryButtonColor: string | undefined
		let primaryButtonTextColor: string | undefined
		let secondaryButtonContainerColor: string | undefined
		let secondaryButtonIconColor: string | undefined

		if (dominantColor) {
			const hsl = hexToHsl(dominantColor)
			primaryButtonColor = hslToString(
				hsl.h,
				Math.max(hsl.s, 40),
				isDarkMode ? 50 : 40,
			)
			primaryButtonTextColor = '#FFFFFF'
			secondaryButtonContainerColor = hslToString(
				hsl.h,
				Math.max(hsl.s, 40),
				isDarkMode ? 22 : 88,
			)
			secondaryButtonIconColor = hslToString(
				hsl.h,
				Math.max(hsl.s, 50),
				isDarkMode ? 75 : 30,
			)
		}

		return {
			backgroundColor,
			nowPlayingBarColor,
			primaryButtonColor,
			primaryButtonTextColor,
			secondaryButtonContainerColor,
			secondaryButtonIconColor,
		}
	}, [palette, isDarkMode, fallbackColor])

	return result
}

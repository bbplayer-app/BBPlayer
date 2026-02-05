import ImageThemeColors from '@roitium/expo-image-theme-colors'
import type { ImageRef } from 'expo-image'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

import { reportErrorToSentry } from '@/utils/log'

// Assuming the type based on previous usage, or I import it if possible.
// Since I can't easily see the type definition from the library, I'll use 'any' for now or try to use return type inference.
// But better to define a local interface matching what we saw.
export interface ThemeColorPalette {
	darkMuted?: { hex: string }
	muted?: { hex: string }
	lightMuted?: { hex: string }
	darkVibrant?: { hex: string }
	vibrant?: { hex: string }
	lightVibrant?: { hex: string }
	average?: { hex: string }
	dominant?: { hex: string }
}

export function useImageColor(imageRef: ImageRef | null | undefined) {
	const [palette, setPalette] = useState<ThemeColorPalette | undefined>(
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
					setPalette(result as ThemeColorPalette)
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

	return palette
}

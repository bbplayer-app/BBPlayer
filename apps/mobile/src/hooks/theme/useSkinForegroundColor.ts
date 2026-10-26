import Color from 'color'
import { useTheme } from 'react-native-paper'

import useAppStore from '@/hooks/stores/useAppStore'
import useSkinStore from '@/hooks/stores/useSkinStore'

import useActiveSkin from './useActiveSkin'

const getSkinForegroundColor = (
	color: string | null | undefined,
	colorMode: string | null | undefined,
	fallback: string,
) => {
	if (color) {
		try {
			return Color(color).hex()
		} catch {
			// Fall through to the skin's semantic color mode.
		}
	}

	if (colorMode === 'dark') return '#FFFFFF'
	if (colorMode === 'light') return '#212121'
	return fallback
}

export default function useSkinForegroundColor(): string {
	const fallback = useTheme().colors.onSurface
	const activeSkin = useActiveSkin()
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	const skinColors = activeSkin?.skins[activeSkinIndex]?.colors
	const pureWhiteBackground = useAppStore(
		(state) => state.settings.pureWhiteBackground,
	)
	if (pureWhiteBackground) return fallback

	return getSkinForegroundColor(
		skinColors?.color,
		skinColors?.colorMode,
		fallback,
	)
}

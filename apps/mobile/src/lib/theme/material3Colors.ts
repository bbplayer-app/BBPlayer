import { Color } from 'expo-router'
import type { ColorSchemeName } from 'react-native'
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper'
import type { MD3Colors } from 'react-native-paper/lib/typescript/types'

/**
 * Build a React Native Paper MD3Colors object from Expo Router's dynamic Material 3 colors.
 */
export function buildMaterial3PaperColors(
	colorScheme: ColorSchemeName,
): MD3Colors {
	const d = Color.android.dynamic
	const fallback =
		colorScheme === 'dark' ? MD3DarkTheme.colors : MD3LightTheme.colors

	return {
		primary: typeof d.primary === 'string' ? d.primary : fallback.primary,
		primaryContainer:
			typeof d.primaryContainer === 'string'
				? d.primaryContainer
				: fallback.primaryContainer,
		secondary:
			typeof d.secondary === 'string' ? d.secondary : fallback.secondary,
		secondaryContainer:
			typeof d.secondaryContainer === 'string'
				? d.secondaryContainer
				: fallback.secondaryContainer,
		tertiary: typeof d.tertiary === 'string' ? d.tertiary : fallback.tertiary,
		tertiaryContainer:
			typeof d.tertiaryContainer === 'string'
				? d.tertiaryContainer
				: fallback.tertiaryContainer,
		surface: typeof d.surface === 'string' ? d.surface : fallback.surface,
		surfaceVariant:
			typeof d.surfaceVariant === 'string'
				? d.surfaceVariant
				: fallback.surfaceVariant,
		background:
			typeof d.background === 'string' ? d.background : fallback.background,
		error: typeof d.error === 'string' ? d.error : fallback.error,
		errorContainer:
			typeof d.errorContainer === 'string'
				? d.errorContainer
				: fallback.errorContainer,
		onPrimary:
			typeof d.onPrimary === 'string' ? d.onPrimary : fallback.onPrimary,
		onPrimaryContainer:
			typeof d.onPrimaryContainer === 'string'
				? d.onPrimaryContainer
				: fallback.onPrimaryContainer,
		onSecondary:
			typeof d.onSecondary === 'string' ? d.onSecondary : fallback.onSecondary,
		onSecondaryContainer:
			typeof d.onSecondaryContainer === 'string'
				? d.onSecondaryContainer
				: fallback.onSecondaryContainer,
		onTertiary:
			typeof d.onTertiary === 'string' ? d.onTertiary : fallback.onTertiary,
		onTertiaryContainer:
			typeof d.onTertiaryContainer === 'string'
				? d.onTertiaryContainer
				: fallback.onTertiaryContainer,
		onSurface:
			typeof d.onSurface === 'string' ? d.onSurface : fallback.onSurface,
		onSurfaceVariant:
			typeof d.onSurfaceVariant === 'string'
				? d.onSurfaceVariant
				: fallback.onSurfaceVariant,
		onError: typeof d.onError === 'string' ? d.onError : fallback.onError,
		onErrorContainer:
			typeof d.onErrorContainer === 'string'
				? d.onErrorContainer
				: fallback.onErrorContainer,
		onBackground:
			typeof d.onBackground === 'string'
				? d.onBackground
				: fallback.onBackground,
		outline: typeof d.outline === 'string' ? d.outline : fallback.outline,
		outlineVariant:
			typeof d.outlineVariant === 'string'
				? d.outlineVariant
				: fallback.outlineVariant,
		// Renamed in Expo Router: surfaceInverse → inverseSurface
		inverseSurface:
			typeof d.surfaceInverse === 'string'
				? d.surfaceInverse
				: fallback.inverseSurface,
		inverseOnSurface:
			typeof d.onSurfaceInverse === 'string'
				? d.onSurfaceInverse
				: fallback.inverseOnSurface,
		inversePrimary:
			typeof d.primaryInverse === 'string'
				? d.primaryInverse
				: fallback.inversePrimary,
		shadow: fallback.shadow,
		scrim: fallback.scrim,
		// Not available from Expo Router dynamic colors — use Paper defaults
		surfaceDisabled: fallback.surfaceDisabled,
		onSurfaceDisabled: fallback.onSurfaceDisabled,
		backdrop: fallback.backdrop,
		elevation: fallback.elevation,
	}
}

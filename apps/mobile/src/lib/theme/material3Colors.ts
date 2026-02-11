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
		primary: (d.primary as string) ?? fallback.primary,
		primaryContainer:
			(d.primaryContainer as string) ?? fallback.primaryContainer,
		secondary: (d.secondary as string) ?? fallback.secondary,
		secondaryContainer:
			(d.secondaryContainer as string) ?? fallback.secondaryContainer,
		tertiary: (d.tertiary as string) ?? fallback.tertiary,
		tertiaryContainer:
			(d.tertiaryContainer as string) ?? fallback.tertiaryContainer,
		surface: (d.surface as string) ?? fallback.surface,
		surfaceVariant: (d.surfaceVariant as string) ?? fallback.surfaceVariant,
		background: (d.background as string) ?? fallback.background,
		error: (d.error as string) ?? fallback.error,
		errorContainer: (d.errorContainer as string) ?? fallback.errorContainer,
		onPrimary: (d.onPrimary as string) ?? fallback.onPrimary,
		onPrimaryContainer:
			(d.onPrimaryContainer as string) ?? fallback.onPrimaryContainer,
		onSecondary: (d.onSecondary as string) ?? fallback.onSecondary,
		onSecondaryContainer:
			(d.onSecondaryContainer as string) ?? fallback.onSecondaryContainer,
		onTertiary: (d.onTertiary as string) ?? fallback.onTertiary,
		onTertiaryContainer:
			(d.onTertiaryContainer as string) ?? fallback.onTertiaryContainer,
		onSurface: (d.onSurface as string) ?? fallback.onSurface,
		onSurfaceVariant:
			(d.onSurfaceVariant as string) ?? fallback.onSurfaceVariant,
		onError: (d.onError as string) ?? fallback.onError,
		onErrorContainer:
			(d.onErrorContainer as string) ?? fallback.onErrorContainer,
		onBackground: (d.onBackground as string) ?? fallback.onBackground,
		outline: (d.outline as string) ?? fallback.outline,
		outlineVariant: (d.outlineVariant as string) ?? fallback.outlineVariant,
		// Renamed in Expo Router: surfaceInverse → inverseSurface
		inverseSurface: (d.surfaceInverse as string) ?? fallback.inverseSurface,
		inverseOnSurface:
			(d.onSurfaceInverse as string) ?? fallback.inverseOnSurface,
		inversePrimary: (d.primaryInverse as string) ?? fallback.inversePrimary,
		shadow: fallback.shadow,
		scrim: fallback.scrim,
		// Not available from Expo Router dynamic colors — use Paper defaults
		surfaceDisabled: fallback.surfaceDisabled,
		onSurfaceDisabled: fallback.onSurfaceDisabled,
		backdrop: fallback.backdrop,
		elevation: fallback.elevation,
	}
}

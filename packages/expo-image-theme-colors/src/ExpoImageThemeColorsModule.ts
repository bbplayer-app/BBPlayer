import { NativeModule, requireNativeModule, type SharedRef } from 'expo'

import type { ExtractedPalette } from './ExpoImageThemeColors.types'
import type { ImageRef } from './ImageRef'

declare class ExpoImageThemeColorsModule extends NativeModule {
	extractThemeColorAsync(
		source: string | SharedRef<'image'> | ImageRef,
	): Promise<ExtractedPalette>
}

export default requireNativeModule<ExpoImageThemeColorsModule>(
	'ExpoImageThemeColors',
)

import { NativeModule, requireNativeModule, SharedRef } from 'expo'

import { ExtractedPalette } from './ExpoImageThemeColors.types'
import { ImageRef } from './ImageRef'

declare class ExpoImageThemeColorsModule extends NativeModule {
	extractThemeColorAsync(
		source: string | SharedRef<'image'> | ImageRef,
	): Promise<ExtractedPalette>
}

export default requireNativeModule<ExpoImageThemeColorsModule>(
	'ExpoImageThemeColors',
)

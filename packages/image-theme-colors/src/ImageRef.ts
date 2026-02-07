import { SharedRef } from 'expo'

import ExpoImageThemeColors from './ExpoImageThemeColorsModule'

/**
 * A reference to a native instance of the image.
 */
export declare class ImageRef extends SharedRef<'image'> {
	/**
	 * Width of the image.
	 */
	width: number

	/**
	 * Height of the image.
	 */
	height: number
}

export default ExpoImageThemeColors.ImageRef as typeof ImageRef

@file:OptIn(EitherType::class)

package expo.modules.imagethemecolors

import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import androidx.palette.graphics.Palette
import expo.modules.kotlin.apifeatures.EitherType
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.exception.toCodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.sharedobjects.SharedRef
import expo.modules.kotlin.types.Either
import expo.modules.kotlin.types.EitherOfFour
import expo.modules.kotlin.types.EitherOfThree
import expo.modules.kotlin.types.toKClass

internal class ImageLoadingFailedException(cause: CodedException?) :
    CodedException(message = "Could not load the image from sharedRef", cause)

class ExpoImageThemeColorsModule : Module() {
    companion object {
        private const val TAG = "ExpoImageThemeColor"
    }

    override fun definition() = ModuleDefinition {
        Name("ExpoImageThemeColors")

        AsyncFunction("extractThemeColorAsync") Coroutine { imageSource: EitherOfFour<String, SharedRef<Bitmap>, SharedRef<Drawable>, Int>
            ->
            val bitmap = when {
                imageSource.`is`(Int::class) -> {
                    android.util.Log.w(TAG, "Received Integer input for image source. This usually indicates a race condition where the image was released. Returning null.")
                    return@Coroutine null
                }
                imageSource.`is`(String::class) -> getBitmapFromUrl(imageSource.get(String::class))
                imageSource.`is`(toKClass<SharedRef<Bitmap>>()) -> imageSource.get(toKClass<SharedRef<Bitmap>>()).ref
                else -> (imageSource.get(toKClass<SharedRef<Drawable>>()).ref as? BitmapDrawable)?.bitmap
                    ?: throw Exceptions.IllegalArgument("Shared drawable cannot be converted to a bitmap.")
            }
            android.util.Log.d(TAG, "get bitmap")

            val palette = Palette.from(bitmap).generate()

            return@Coroutine mapOf(
                "width" to bitmap.width,
                "height" to bitmap.height,
                "dominant" to palette.dominantSwatch.toSwatchMap(),
                "vibrant" to palette.vibrantSwatch.toSwatchMap(),
                "lightVibrant" to palette.lightVibrantSwatch.toSwatchMap(),
                "darkVibrant" to palette.darkVibrantSwatch.toSwatchMap(),
                "muted" to palette.mutedSwatch.toSwatchMap(),
                "lightMuted" to palette.lightMutedSwatch.toSwatchMap(),
                "darkMuted" to palette.darkMutedSwatch.toSwatchMap()
            )
        }
    }

    private fun getBitmapFromUrl(urlString: String): Bitmap {
        try {
            val url = java.net.URL(urlString)
            return android.graphics.BitmapFactory.decodeStream(url.openStream())
        } catch (e: Exception) {
            throw ImageLoadingFailedException(e.toCodedException())
        }
    }



    private fun Int.toHexColor(): String {
        return String.format("#%06X", (0xFFFFFF and this))
    }

    private fun Palette.Swatch?.toSwatchMap(): Map<String, Any>? {
        if (this == null) {
            return null
        }

        return mapOf(
            "hex" to this.rgb.toHexColor(),
            "titleTextColor" to this.titleTextColor.toHexColor(),
            "bodyTextColor" to this.bodyTextColor.toHexColor(),
            "population" to this.population
        )
    }
}
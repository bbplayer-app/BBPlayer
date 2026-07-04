@file:OptIn(EitherType::class)

package expo.modules.imagethemecolors

import android.graphics.Bitmap
import android.graphics.Bitmap.Config
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import androidx.palette.graphics.Palette
import expo.modules.kotlin.apifeatures.EitherType
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.toCodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.sharedobjects.SharedRef
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

        AsyncFunction("extractThemeColorAsync") Coroutine { imageSource: EitherOfThree<String, SharedRef<Bitmap>, SharedRef<Drawable>>
            ->
            val bitmap = when {
                imageSource.`is`(String::class) -> getBitmapFromUrl(imageSource.get(String::class))
                imageSource.`is`(toKClass<SharedRef<Bitmap>>()) -> imageSource.get(toKClass<SharedRef<Bitmap>>()).ref
                else -> drawableToBitmap(imageSource.get(toKClass<SharedRef<Drawable>>()).ref)
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

    private fun drawableToBitmap(drawable: Drawable): Bitmap {
        try {
            if (drawable is BitmapDrawable) return drawable.bitmap

            val width = drawable.intrinsicWidth.coerceAtLeast(1)
            val height = drawable.intrinsicHeight.coerceAtLeast(1)
            val bitmap = Bitmap.createBitmap(width, height, Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            return bitmap
        } catch (e: Exception) {
            throw CodedException(
                message = "Failed to convert drawable to bitmap: ${e.message}",
                cause = null
            )
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
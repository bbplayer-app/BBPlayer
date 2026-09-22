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
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.sharedobjects.SharedRef
import expo.modules.kotlin.types.EitherOfThree
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.kotlin.types.toKClass

internal class ImageLoadingFailedException(cause: CodedException?) :
    CodedException(message = "Could not load the image from sharedRef", cause)

@OptimizedRecord
class SwatchRecord : Record {
    @Field
    var hex: String = ""

    @Field
    var titleTextColor: String = ""

    @Field
    var bodyTextColor: String = ""

    @Field
    var population: Int = 0
}

@OptimizedRecord
class PaletteRecord : Record {
    @Field
    var width: Int = 0

    @Field
    var height: Int = 0

    @Field
    var dominant: SwatchRecord? = null

    @Field
    var vibrant: SwatchRecord? = null

    @Field
    var lightVibrant: SwatchRecord? = null

    @Field
    var darkVibrant: SwatchRecord? = null

    @Field
    var muted: SwatchRecord? = null

    @Field
    var lightMuted: SwatchRecord? = null

    @Field
    var darkMuted: SwatchRecord? = null
}

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

            return@Coroutine PaletteRecord().apply {
                width = bitmap.width
                height = bitmap.height
                dominant = palette.dominantSwatch.toSwatchRecord()
                vibrant = palette.vibrantSwatch.toSwatchRecord()
                lightVibrant = palette.lightVibrantSwatch.toSwatchRecord()
                darkVibrant = palette.darkVibrantSwatch.toSwatchRecord()
                muted = palette.mutedSwatch.toSwatchRecord()
                lightMuted = palette.lightMutedSwatch.toSwatchRecord()
                darkMuted = palette.darkMutedSwatch.toSwatchRecord()
            }
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

    private fun Palette.Swatch?.toSwatchRecord(): SwatchRecord? {
        if (this == null) {
            return null
        }

        val swatch = this
        return SwatchRecord().apply {
            hex = swatch.rgb.toHexColor()
            titleTextColor = swatch.titleTextColor.toHexColor()
            bodyTextColor = swatch.bodyTextColor.toHexColor()
            population = swatch.population
        }
    }
}
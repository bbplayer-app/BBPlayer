package expo.modules.orpheus.utils

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.util.Log
import androidx.media3.common.MediaMetadata
import androidx.media3.common.util.BitmapLoader
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.ListeningExecutorService
import com.google.common.util.concurrent.MoreExecutors
import java.util.concurrent.Executors

@androidx.media3.common.util.UnstableApi
class GlideBitmapLoader(private val context: Context) : BitmapLoader {
    private val executorService: ListeningExecutorService =
        MoreExecutors.listeningDecorator(Executors.newSingleThreadExecutor())

    override fun loadBitmapFromMetadata(metadata: MediaMetadata): ListenableFuture<Bitmap> {
        val uri = metadata.artworkUri ?:
        return executorService.submit<Bitmap> {
            throw IllegalArgumentException("Metadata artworkUri is null")
        }
        return loadBitmap(uri)
    }

    override fun supportsMimeType(mimeType: String): Boolean {
        return true
    }

    override fun decodeBitmap(data: ByteArray): ListenableFuture<Bitmap> {
        return executorService.submit<Bitmap> {
            throw UnsupportedOperationException("Not implemented for raw bytes")
        }
    }

    override fun loadBitmap(uri: Uri): ListenableFuture<Bitmap> {
        return executorService.submit<Bitmap> {
            Log.d("GlideBitmapLoader", "load image $uri")
            val glideBitmap = Glide.with(context)
                .asBitmap()
                .load(uri)
                .diskCacheStrategy(DiskCacheStrategy.NONE)
                .submit(512, 512)
                .get()

            if (glideBitmap != null && !glideBitmap.isRecycled) {
                val safeBitmap = glideBitmap.copy(Bitmap.Config.ARGB_8888, false)

                return@submit safeBitmap
            } else {
                throw IllegalStateException("Bitmap load failed or recycled")
            }
        }
    }
}
package expo.modules.orpheus.util

import android.content.Context
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.cache.ContentMetadata
import expo.modules.orpheus.manager.DownloadCache
import java.io.Closeable

@UnstableApi
object PlayerCacheSource {
    class Stream internal constructor(
        val length: Long,
        val total: Long,
        private val dataSource: DataSource,
    ) : Closeable {
        fun read(buffer: ByteArray, max: Int = buffer.size): Int {
            val n = dataSource.read(buffer, 0, max.coerceAtMost(buffer.size))
            return if (n == C.RESULT_END_OF_INPUT) -1 else n
        }

        override fun close() {
            runCatching { dataSource.close() }
        }
    }

    fun open(context: Context, uri: String, start: Long, endInclusive: Long?): Stream {
        val dataSource = DownloadUtil.getPlayerDataSourceFactory(context).createDataSource()
        val total = knownLength(context, uri)
        val startOffset = start.coerceAtLeast(0)
        val specLength =
            if (endInclusive != null) (endInclusive - startOffset + 1).coerceAtLeast(0)
            else C.LENGTH_UNSET.toLong()
        val spec = DataSpec.Builder()
            .setUri(Uri.parse(uri))
            .setPosition(startOffset)
            .setLength(specLength)
            .build()
        val opened = try {
            dataSource.open(spec)
        } catch (error: Throwable) {
            runCatching { dataSource.close() }
            throw error
        }
        val openedLength = if (opened == C.LENGTH_UNSET.toLong()) -1L else opened
        return Stream(openedLength, total, dataSource)
    }

    fun knownLength(context: Context, uri: String): Long {
        val caches = arrayOf(
            DownloadCache.getStableCache(context),
            DownloadCache.getLruCache(context),
        )
        for (cache in caches) {
            val length = ContentMetadata.getContentLength(cache.getContentMetadata(uri))
            if (length != C.LENGTH_UNSET.toLong()) return length
        }
        return -1L
    }
}

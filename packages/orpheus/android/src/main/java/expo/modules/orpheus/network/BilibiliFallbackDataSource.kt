package expo.modules.orpheus.network

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.TransferListener
import java.io.IOException
import java.io.InterruptedIOException
import java.net.SocketTimeoutException

internal data class BilibiliStreamUrls(val urls: List<String>)

/** Tries API-provided mirrors of the same audio representation without rewriting signed URLs. */
@UnstableApi
internal class BilibiliFallbackDataSource(private val factory: DataSource.Factory) : DataSource {
    private val listeners = mutableListOf<TransferListener>()
    private var upstream: DataSource? = null
    private var originalSpec: DataSpec? = null
    private var candidates: List<String> = emptyList()
    private var nextCandidate = 0
    private var bytesRead = 0L

    override fun addTransferListener(transferListener: TransferListener) {
        listeners.add(transferListener)
        upstream?.addTransferListener(transferListener)
    }

    override fun open(dataSpec: DataSpec): Long {
        originalSpec = dataSpec
        candidates = (dataSpec.customData as? BilibiliStreamUrls)?.urls.orEmpty()
        nextCandidate = 0
        bytesRead = 0
        return openNext(null)
    }

    private fun openNext(previousError: IOException?): Long {
        val spec = checkNotNull(originalSpec)
        var lastError = previousError
        do {
            val source = factory.createDataSource()
            upstream = source
            listeners.forEach(source::addTransferListener)
            val nextSpec = spec.subrange(bytesRead).let {
                if (candidates.isEmpty()) it else it.withUri(Uri.parse(candidates[nextCandidate++]))
            }
            try {
                return source.open(nextSpec)
            } catch (error: IOException) {
                lastError?.let(error::addSuppressed)
                lastError = error
                closeFailedSource(error)
                if (!canRetry(error)) throw error
            }
        } while (nextCandidate < candidates.size)
        throw checkNotNull(lastError)
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0
        val spec = checkNotNull(originalSpec)
        if (spec.length != C.LENGTH_UNSET.toLong() && bytesRead == spec.length) {
            return C.RESULT_END_OF_INPUT
        }
        while (true) {
            try {
                val count = checkNotNull(upstream).read(buffer, offset, length)
                if (count > 0) bytesRead += count
                return count
            } catch (error: IOException) {
                if (!canRetry(error)) throw error
                closeFailedSource(error)
                // Keep the original byte range and cache key when switching mirrors mid-stream.
                openNext(error)
            }
        }
    }

    private fun canRetry(error: IOException): Boolean {
        if (nextCandidate >= candidates.size || Thread.currentThread().isInterrupted) return false
        if (error is InterruptedIOException && error !is SocketTimeoutException) return false
        if (error is HttpDataSource.InvalidResponseCodeException) {
            return error.responseCode in setOf(403, 404, 408, 410, 429) ||
                error.responseCode in 500..599
        }
        return true
    }

    private fun closeFailedSource(error: IOException) {
        val source = upstream
        upstream = null
        try {
            source?.close()
        } catch (closeError: IOException) {
            error.addSuppressed(closeError)
        }
    }

    override fun getUri(): Uri? = upstream?.uri

    override fun getResponseHeaders(): Map<String, List<String>> =
        upstream?.responseHeaders.orEmpty()

    override fun close() {
        val source = upstream
        upstream = null
        originalSpec = null
        candidates = emptyList()
        source?.close()
    }
}

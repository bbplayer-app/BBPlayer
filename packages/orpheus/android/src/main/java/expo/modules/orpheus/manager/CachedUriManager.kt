package expo.modules.orpheus.manager

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.cache.Cache
import androidx.media3.datasource.cache.CacheSpan
import androidx.media3.datasource.cache.ContentMetadata
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap

@UnstableApi
object CachedUriManager : Cache.Listener {
    private val fullyCachedUris = Collections.newSetFromMap(ConcurrentHashMap<String, Boolean>())
    private var isInitialized = false
    private val scope = CoroutineScope(Dispatchers.IO)

    @Synchronized
    fun initialize(context: Context) {
        if (isInitialized) return
        
        val lruCache = DownloadCache.getLruCache(context)
        lruCache.addListener(CachedUriManager.javaClass.simpleName, this)
        
        scope.launch {
            val keys = lruCache.keys
            for (key in keys) {
                checkIfFullyCached(lruCache, key)
            }
        }
        
        isInitialized = true
    }

    fun isFullyCached(uri: String): Boolean {
        return fullyCachedUris.contains(uri)
    }

    private fun checkIfFullyCached(cache: Cache, key: String) {
        val metadata = cache.getContentMetadata(key)
        val expectedLength = ContentMetadata.getContentLength(metadata)

        if (expectedLength != C.LENGTH_UNSET.toLong()) {
            val spans = cache.getCachedSpans(key)
            var totalCachedBytes = 0L
            for (span in spans) {
                totalCachedBytes += span.length
            }

            if (totalCachedBytes >= expectedLength) {
                fullyCachedUris.add(key)
            } else {
                fullyCachedUris.remove(key)
            }
        }
    }

    override fun onSpanAdded(cache: Cache, span: CacheSpan) {
        val key = span.key ?: return
        scope.launch {
            checkIfFullyCached(cache, key)
        }
    }

    override fun onSpanRemoved(cache: Cache, span: CacheSpan) {
        val key = span.key ?: return
        fullyCachedUris.remove(key)
    }

    override fun onSpanTouched(cache: Cache, oldSpan: CacheSpan, newSpan: CacheSpan) {
    }
}

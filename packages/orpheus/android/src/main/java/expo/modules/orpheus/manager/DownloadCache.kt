package expo.modules.orpheus.manager

import android.content.Context
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import java.io.File

@UnstableApi
object DownloadCache {
    private const val STABLE_CACHE_DIR = "media_download"
    private const val LRU_CACHE_DIR = "media_cache_lru"

    private var stableCache: SimpleCache? = null
    private var lruCache: SimpleCache? = null

    @Synchronized
    fun getStableCache(context: Context): SimpleCache {
        if (stableCache == null) {
            val cacheDir = File(context.filesDir, STABLE_CACHE_DIR)
            val evictor = NoOpCacheEvictor()
            val databaseProvider = StandaloneDatabaseProvider(context)
            stableCache = SimpleCache(cacheDir, evictor, databaseProvider)
        }
        return stableCache!!
    }

    @Synchronized
    fun getLruCache(context: Context): SimpleCache {
        if (lruCache == null) {
            val cacheDir = File(context.cacheDir, LRU_CACHE_DIR)
            val evictor = LeastRecentlyUsedCacheEvictor(256 * 1024 * 1024)
            val databaseProvider = StandaloneDatabaseProvider(context)
            lruCache = SimpleCache(cacheDir, evictor, databaseProvider)
        }
        return lruCache!!
    }

    /**
     * 清空 Media3 在线播放 LRU 缓存。
     *
     * 只处理 orpheus 自己持有的缓存；`cacheDir` 中的其他缓存由 `@bbplayer/native` 负责清理。
     */
    @Synchronized
    fun clearLruCache(context: Context) {
        val mediaCache = getLruCache(context)
        mediaCache.keys.toList().forEach(mediaCache::removeResource)
    }
}
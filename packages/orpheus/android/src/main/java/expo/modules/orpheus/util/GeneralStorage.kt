package expo.modules.orpheus.util

import android.content.Context
import android.util.Log
import androidx.media3.common.MediaItem
import com.tencent.mmkv.MMKV
import expo.modules.orpheus.model.TrackRecord
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

object GeneralStorage {
    private var kv: MMKV? = null
    private val json = Json { ignoreUnknownKeys = true }
    private const val KEY_RESTORE_POSITION_ENABLED = "config_restore_position_enabled"

    private const val KEY_LOUDNESS_NORMALIZATION_ENABLED = "config_loudness_normalization_enabled"
    private const val KEY_SAVED_QUEUE = "saved_queue_json_list"
    private const val KEY_SAVED_INDEX = "saved_index"
    private const val KEY_SAVED_POSITION = "saved_position"
    private const val KEY_SAVED_REPEAT_MODE = "saved_repeat_mode"
    private const val KEY_SAVED_SHUFFLE_MODE = "saved_shuffle_mode"
    private const val KEY_AUTOPLAY_ON_START_ENABLED = "config_autoplay_on_start_enabled"
    private const val KEY_DESKTOP_LYRICS_SHOWN = "state_desktop_lyrics_shown"
    private const val KEY_DESKTOP_LYRICS_LOCKED = "state_desktop_lyrics_locked"


    @Synchronized
    fun initialize(context: Context) {
        if (kv == null) {
            MMKV.initialize(context)
            kv = MMKV.mmkvWithID("player_queue_store")
        }
    }

    private val safeKv: MMKV
        get() = kv ?: throw IllegalStateException("MediaItemStorer not initialized")

    fun setRestoreEnabled(enabled: Boolean) {
        try {
            safeKv.encode(KEY_RESTORE_POSITION_ENABLED, enabled)
        } catch (e: Exception) {
            Log.e("MediaItemStorer", "Failed to set restore position enabled", e)
        }
    }

    fun setLoudnessNormalizationEnabled(enabled: Boolean) {
        try {
            safeKv.encode(KEY_LOUDNESS_NORMALIZATION_ENABLED, enabled)
        } catch (e: Exception) {
            Log.e("MediaItemStorer", "Failed to set loudness normalization enabled", e)
        }
    }

    fun isRestoreEnabled(): Boolean {
        return safeKv.decodeBool(KEY_RESTORE_POSITION_ENABLED, false)
    }

    fun isLoudnessNormalizationEnabled(): Boolean {
        return safeKv.decodeBool(KEY_LOUDNESS_NORMALIZATION_ENABLED, true)
    }

    fun isAutoplayOnStartEnabled(): Boolean {
        return safeKv.decodeBool(KEY_AUTOPLAY_ON_START_ENABLED, false)
    }

    fun setAutoplayOnStartEnabled(enabled: Boolean) {
        try {
            safeKv.encode(KEY_AUTOPLAY_ON_START_ENABLED, enabled)
        } catch (e: Exception) {
            Log.e("MediaItemStorer", "Failed to set autoplay on start enabled", e)
        }
    }

    fun saveQueue(mediaItems: List<MediaItem>) {
        try {
            val jsonList = mediaItems.mapNotNull { item ->
                item.mediaMetadata.extras?.getString("track_json")
            }

            val jsonListString = json.encodeToString(jsonList)
            safeKv.encode(KEY_SAVED_QUEUE, jsonListString)

        } catch (e: Exception) {
            Log.e("MediaItemStorer", "Failed to save queue", e)
        }
    }

    fun restoreQueue(context: Context): List<MediaItem> {
        return try {
            val jsonListString = kv?.decodeString(KEY_SAVED_QUEUE)

            if (jsonListString.isNullOrEmpty()) return emptyList()

            val trackJsonList: List<String> = json.decodeFromString(jsonListString)

            trackJsonList.mapNotNull { trackJson ->
                try {
                    val track = json.decodeFromString<TrackRecord>(trackJson)

                    track.toMediaItem(context)

                } catch (e: Exception) {
                    Log.e("MediaItemStorer", "Failed to parse track json: $trackJson", e)
                    null
                }
            }
        } catch (e: Exception) {
            Log.e("MediaItemStorer", "Failed to restore queue", e)
            emptyList()
        }
    }

    fun savePosition(index: Int, position: Long) {
        safeKv.encode(KEY_SAVED_INDEX, index)
        safeKv.encode(KEY_SAVED_POSITION, position)
    }

    fun saveRepeatMode(repeatMode: Int) = safeKv.encode(KEY_SAVED_REPEAT_MODE, repeatMode)
    fun saveShuffleMode(shuffleMode: Boolean) = safeKv.encode(KEY_SAVED_SHUFFLE_MODE, shuffleMode)

    fun getSavedIndex() = kv?.decodeInt(KEY_SAVED_INDEX, 0) ?: 0
    fun getSavedPosition() = kv?.decodeLong(KEY_SAVED_POSITION, 0L) ?: 0L
    fun getRepeatMode() = kv?.decodeInt(KEY_SAVED_REPEAT_MODE, 0) ?: 0
    fun getShuffleMode() = kv?.decodeBool(KEY_SAVED_SHUFFLE_MODE, false) ?: false

    fun isDesktopLyricsShown() = kv?.decodeBool(KEY_DESKTOP_LYRICS_SHOWN, false) ?: false
    fun setDesktopLyricsShown(shown: Boolean) = safeKv.encode(KEY_DESKTOP_LYRICS_SHOWN, shown)

    fun isDesktopLyricsLocked() = kv?.decodeBool(KEY_DESKTOP_LYRICS_LOCKED, false) ?: false
    fun setDesktopLyricsLocked(locked: Boolean) = safeKv.encode(KEY_DESKTOP_LYRICS_LOCKED, locked)
}
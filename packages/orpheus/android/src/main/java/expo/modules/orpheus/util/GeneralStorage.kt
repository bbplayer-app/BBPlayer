package expo.modules.orpheus.util

import expo.modules.bbplayernative.telemetry.NativeLog

import android.content.Context
import androidx.core.graphics.toColorInt
import androidx.media3.common.MediaItem
import com.tencent.mmkv.MMKV
import expo.modules.orpheus.manager.EQ_BAND_COUNT
import expo.modules.orpheus.manager.EQ_MAX_GAIN_DB
import expo.modules.orpheus.manager.EQ_MIN_GAIN_DB
import expo.modules.orpheus.manager.EqualizerConfigHolder
import expo.modules.orpheus.model.TrackRecord
import expo.modules.orpheus.telemetry.LogTags
import expo.modules.orpheus.telemetry.OrpheusTelemetry
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

object GeneralStorage {
    private var kv: MMKV? = null
    private val json = Json { ignoreUnknownKeys = true }
    private var lastSavedQueueSnapshot: List<String>? = null
    private const val KEY_RESTORE_POSITION_ENABLED = "config_restore_position_enabled"
    private const val KEY_BILIBILI_CDN = "config_bilibili_cdn"

    private const val KEY_EQUALIZER_ENABLED = "config_equalizer_enabled"
    private const val KEY_EQUALIZER_PREAMP_DB = "config_equalizer_preamp_db"
    private const val KEY_EQUALIZER_LIMITER_ENABLED = "config_equalizer_limiter_enabled"
    private const val KEY_EQUALIZER_GAINS_JSON = "config_equalizer_gains_json"
    private const val KEY_EQUALIZER_ACTIVE_PRESET_ID = "config_equalizer_active_preset_id"
    private const val KEY_CUSTOM_EQUALIZER_PRESETS_JSON = "config_custom_equalizer_presets_json"

    private const val DEFAULT_EQUALIZER_GAINS_JSON = "[0,0,0,0,0,0,0,0,0,0]"
    private const val DEFAULT_EQUALIZER_ACTIVE_PRESET_ID = "flat"
    private const val DEFAULT_CUSTOM_EQUALIZER_PRESETS_JSON = "[]"

    private const val KEY_LOUDNESS_NORMALIZATION_ENABLED = "config_loudness_normalization_enabled"
    private const val KEY_SAVED_QUEUE = "saved_queue_json_list"
    private const val KEY_SAVED_INDEX = "saved_index"
    private const val KEY_SAVED_POSITION = "saved_position"
    private const val KEY_SAVED_REPEAT_MODE = "saved_repeat_mode"
    private const val KEY_SAVED_SHUFFLE_MODE = "saved_shuffle_mode"
    private const val KEY_AUTOPLAY_ON_START_ENABLED = "config_autoplay_on_start_enabled"
    private const val KEY_NOTIFICATION_ARTWORK_ENABLED = "config_notification_artwork_enabled"
    private const val KEY_SPECTRUM_VISUALIZER_ENABLED = "config_spectrum_visualizer_enabled"
    private const val KEY_DESKTOP_LYRICS_SHOWN = "state_desktop_lyrics_shown"
    private const val KEY_DESKTOP_LYRICS_LOCKED = "state_desktop_lyrics_locked"
    private const val KEY_STATUS_BAR_LYRICS_ENABLED = "config_status_bar_lyrics_enabled"
    private const val KEY_STATUS_BAR_LYRICS_PROVIDER = "config_status_bar_lyrics_provider"
    private const val KEY_CAR_LYRICS_ENABLED = "config_car_lyrics_enabled"
    private const val KEY_DESKTOP_LYRICS_DISPLAY_MODE = "config_desktop_lyrics_display_mode"
    private const val KEY_DESKTOP_LYRICS_HIGHLIGHT_COLOR = "config_desktop_lyrics_highlight_color"
    private const val KEY_DESKTOP_LYRICS_TEXT_SIZE = "config_desktop_lyrics_text_size"
    private const val KEY_DESKTOP_LYRICS_Y = "config_desktop_lyrics_y"

    // 功耗测量用的开关，在音频调试页设置，重启 App 后生效
    private const val KEY_TEST_FORCE_MEDIA_CODEC = "debug_test_force_media_codec"


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
            NativeLog.error(LogTags.STORAGE, "storage.restore_position.set_failed", error = e)
        }
    }

    fun setLoudnessNormalizationEnabled(enabled: Boolean) {
        try {
            safeKv.encode(KEY_LOUDNESS_NORMALIZATION_ENABLED, enabled)
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.loudness.set_failed", error = e)
        }
    }

    fun isRestoreEnabled(): Boolean {
        return safeKv.decodeBool(KEY_RESTORE_POSITION_ENABLED, false)
    }

    fun getPreferredBilibiliCdn() = kv?.decodeString(KEY_BILIBILI_CDN, "auto") ?: "auto"

    fun setPreferredBilibiliCdn(preference: String) {
        val value = preference.takeIf { it in setOf("auto", "ali", "tencent", "huawei", "akamai") } ?: "auto"
        safeKv.encode(KEY_BILIBILI_CDN, value)
    }

    fun isLoudnessNormalizationEnabled(): Boolean {
        return safeKv.decodeBool(KEY_LOUDNESS_NORMALIZATION_ENABLED, true)
    }

    fun isAutoplayOnStartEnabled(): Boolean {
        return safeKv.decodeBool(KEY_AUTOPLAY_ON_START_ENABLED, false)
    }

    fun isNotificationArtworkEnabled() = kv?.decodeBool(KEY_NOTIFICATION_ARTWORK_ENABLED, true) ?: true

    fun setNotificationArtworkEnabled(enabled: Boolean) = safeKv.encode(KEY_NOTIFICATION_ARTWORK_ENABLED, enabled)

    fun setAutoplayOnStartEnabled(enabled: Boolean) {
        try {
            safeKv.encode(KEY_AUTOPLAY_ON_START_ENABLED, enabled)
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.autoplay.set_failed", error = e)
        }
    }

    fun isSpectrumVisualizerEnabled(): Boolean {
        return safeKv.decodeBool(KEY_SPECTRUM_VISUALIZER_ENABLED, false)
    }

    fun setSpectrumVisualizerEnabled(enabled: Boolean) {
        try {
            safeKv.encode(KEY_SPECTRUM_VISUALIZER_ENABLED, enabled)
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.spectrum.set_failed", error = e)
        }
    }

    /** 测量用：不用 FFmpeg，PCM 也交给 MediaCodec 解码 */
    fun isEqualizerEnabled(): Boolean = kv?.decodeBool(KEY_EQUALIZER_ENABLED, false) ?: false

    fun setEqualizerEnabled(enabled: Boolean) {
        try {
            safeKv.encode(KEY_EQUALIZER_ENABLED, enabled)
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.equalizer.enabled.set_failed", error = e)
        }
    }

    fun getEqualizerPreampDb(): Float = sanitizeEqualizerGain(kv?.decodeFloat(KEY_EQUALIZER_PREAMP_DB, 0f) ?: 0f)

    fun setEqualizerPreampDb(preampDb: Float) {
        try {
            safeKv.encode(KEY_EQUALIZER_PREAMP_DB, sanitizeEqualizerGain(preampDb))
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.equalizer.preamp.set_failed", error = e)
        }
    }

    fun isEqualizerLimiterEnabled(): Boolean = kv?.decodeBool(KEY_EQUALIZER_LIMITER_ENABLED, true) ?: true

    fun setEqualizerLimiterEnabled(enabled: Boolean) {
        try {
            safeKv.encode(KEY_EQUALIZER_LIMITER_ENABLED, enabled)
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.equalizer.limiter.set_failed", error = e)
        }
    }

    fun getEqualizerGainsJson(): String =
        kv?.decodeString(KEY_EQUALIZER_GAINS_JSON, DEFAULT_EQUALIZER_GAINS_JSON) ?: DEFAULT_EQUALIZER_GAINS_JSON

    fun setEqualizerGainsJson(value: String) {
        try {
            safeKv.encode(KEY_EQUALIZER_GAINS_JSON, value)
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.equalizer.gains.set_failed", error = e)
        }
    }

    /** 按 10 个频段解析已持久化的增益，损坏的 JSON 和非有限数都安全回退到 0 dB */
    fun getEqualizerGains(): FloatArray {
        val parsed = try {
            json.decodeFromString<List<Float>>(getEqualizerGainsJson())
        } catch (e: Exception) {
            NativeLog.warning(LogTags.STORAGE, "storage.equalizer.gains.parse_failed", error = e)
            return FloatArray(EQ_BAND_COUNT)
        }
        return FloatArray(EQ_BAND_COUNT) { index ->
            sanitizeEqualizerGain(parsed.getOrElse(index) { 0f })
        }
    }

    fun setEqualizerGains(gainsDb: FloatArray) {
        val sanitized = FloatArray(EQ_BAND_COUNT) { index ->
            sanitizeEqualizerGain(gainsDb.getOrElse(index) { 0f })
        }
        setEqualizerGainsJson(json.encodeToString(sanitized.toList()))
    }

    /** 读取时把空串还原为 null，表示当前增益不属于任何预设 */
    fun getEqualizerActivePresetId(): String? {
        val raw = kv?.decodeString(KEY_EQUALIZER_ACTIVE_PRESET_ID, DEFAULT_EQUALIZER_ACTIVE_PRESET_ID)
            ?: DEFAULT_EQUALIZER_ACTIVE_PRESET_ID
        return raw.takeIf { it.isNotBlank() }
    }

    fun setEqualizerActivePresetId(presetId: String?) {
        try {
            safeKv.encode(KEY_EQUALIZER_ACTIVE_PRESET_ID, presetId ?: "")
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.equalizer.preset.set_failed", error = e)
        }
    }

    fun getCustomEqualizerPresetsJson(): String =
        kv?.decodeString(KEY_CUSTOM_EQUALIZER_PRESETS_JSON, DEFAULT_CUSTOM_EQUALIZER_PRESETS_JSON)
            ?: DEFAULT_CUSTOM_EQUALIZER_PRESETS_JSON

    fun setCustomEqualizerPresetsJson(value: String) {
        try {
            safeKv.encode(KEY_CUSTOM_EQUALIZER_PRESETS_JSON, value)
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.equalizer.presets.set_failed", error = e)
        }
    }

    /** 冷启动时一次性把持久化状态写进 DSP 共用配置，避免逐项更新时反复重算滤波系数 */
    fun restoreEqualizerConfigToHolder() {
        EqualizerConfigHolder.update(
            enabled = isEqualizerEnabled(),
            preampDb = getEqualizerPreampDb(),
            limiterEnabled = isEqualizerLimiterEnabled(),
            gainsDb = getEqualizerGains(),
        )
    }

    private fun sanitizeEqualizerGain(value: Float): Float =
        if (!value.isFinite()) 0f else value.coerceIn(EQ_MIN_GAIN_DB, EQ_MAX_GAIN_DB)

    fun isTestForceMediaCodec(): Boolean = safeKv.decodeBool(KEY_TEST_FORCE_MEDIA_CODEC, false)

    fun setTestForceMediaCodec(enabled: Boolean) {
        safeKv.encode(KEY_TEST_FORCE_MEDIA_CODEC, enabled)
    }

    fun saveQueue(mediaItems: List<MediaItem>) {
        try {
            val jsonList = mediaItems.mapNotNull { item ->
                item.mediaMetadata.extras?.getString("track_json")
            }

            if (jsonList == lastSavedQueueSnapshot) return
            lastSavedQueueSnapshot = jsonList

            val jsonListString = json.encodeToString(jsonList)
            safeKv.encode(KEY_SAVED_QUEUE, jsonListString)

        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.queue.save_failed", error = e)
        }
    }

    fun restoreQueue(context: Context): List<MediaItem> {
        return try {
            val jsonListString = kv?.decodeString(KEY_SAVED_QUEUE)

            if (jsonListString.isNullOrEmpty()) return emptyList()
            // 启动时就 OOM 的情况下，这是 JS 侧日志还没开启前唯一能留下的线索
            OrpheusTelemetry.update("restoredQueueChars" to jsonListString.length)

            val trackJsonList: List<String> = json.decodeFromString(jsonListString)
            lastSavedQueueSnapshot = trackJsonList

            trackJsonList.mapNotNull { trackJson ->
                try {
                    val track = json.decodeFromString<TrackRecord>(trackJson)

                    track.toMediaItem(context)

                } catch (e: Exception) {
                    NativeLog.error(
                        LogTags.STORAGE,
                        "storage.track.parse_failed",
                        mapOf(
                            "storage.track_json_length" to trackJson.length,
                        ),
                        e,
                    )
                    null
                }
            }
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.queue.restore_failed", error = e)
            emptyList()
        }
    }

    fun savePosition(index: Int, position: Long) {
        safeKv.encode(KEY_SAVED_INDEX, index)
        safeKv.encode(KEY_SAVED_POSITION, position)
    }

    fun saveRepeatMode(repeatMode: Int) = safeKv.encode(KEY_SAVED_REPEAT_MODE, repeatMode)
    fun saveShuffleMode(shuffleMode: Boolean) = safeKv.encode(KEY_SAVED_SHUFFLE_MODE, shuffleMode)
    fun getShuffleMode() = kv?.decodeBool(KEY_SAVED_SHUFFLE_MODE, false) ?: false

    fun getSavedIndex() = kv?.decodeInt(KEY_SAVED_INDEX, 0) ?: 0
    fun getSavedPosition() = kv?.decodeLong(KEY_SAVED_POSITION, 0L) ?: 0L
    fun getRepeatMode() = kv?.decodeInt(KEY_SAVED_REPEAT_MODE, 0) ?: 0

    fun isDesktopLyricsShown() = kv?.decodeBool(KEY_DESKTOP_LYRICS_SHOWN, false) ?: false
    fun setDesktopLyricsShown(shown: Boolean) = safeKv.encode(KEY_DESKTOP_LYRICS_SHOWN, shown)

    fun isDesktopLyricsLocked() = kv?.decodeBool(KEY_DESKTOP_LYRICS_LOCKED, false) ?: false
    fun setDesktopLyricsLocked(locked: Boolean) = safeKv.encode(KEY_DESKTOP_LYRICS_LOCKED, locked)

    fun isStatusBarLyricsEnabled() = kv?.decodeBool(KEY_STATUS_BAR_LYRICS_ENABLED, false) ?: false
    fun setStatusBarLyricsEnabled(enabled: Boolean) = safeKv.encode(KEY_STATUS_BAR_LYRICS_ENABLED, enabled)

    /** Returns "superlyric", "lyricon", or "meizu" */
    fun getStatusBarLyricsProvider() = kv?.decodeString(KEY_STATUS_BAR_LYRICS_PROVIDER, "superlyric") ?: "superlyric"
    fun setStatusBarLyricsProvider(provider: String) = safeKv.encode(KEY_STATUS_BAR_LYRICS_PROVIDER, provider)

    fun isCarLyricsEnabled() = kv?.decodeBool(KEY_CAR_LYRICS_ENABLED, false) ?: false
    fun setCarLyricsEnabled(enabled: Boolean) = safeKv.encode(KEY_CAR_LYRICS_ENABLED, enabled)

    /**
     * Desktop Lyrics Display Mode:
     * 0: Translation
     * 1: Romaji
     * 2: None
     */
    fun getDesktopLyricsMode() = kv?.decodeInt(KEY_DESKTOP_LYRICS_DISPLAY_MODE, 0) ?: 0
    fun setDesktopLyricsMode(mode: Int) = safeKv.encode(KEY_DESKTOP_LYRICS_DISPLAY_MODE, mode)

    fun getDesktopLyricsHighlightColor() = kv?.decodeInt(KEY_DESKTOP_LYRICS_HIGHLIGHT_COLOR, "#FFC107".toColorInt()) ?: "#FFC107".toColorInt()
    fun setDesktopLyricsHighlightColor(color: Int) = safeKv.encode(KEY_DESKTOP_LYRICS_HIGHLIGHT_COLOR, color)

    fun getDesktopLyricsTextSize() = kv?.decodeFloat(KEY_DESKTOP_LYRICS_TEXT_SIZE, 18f) ?: 18f
    fun setDesktopLyricsTextSize(size: Float) = safeKv.encode(KEY_DESKTOP_LYRICS_TEXT_SIZE, size)

    fun getDesktopLyricsY() = kv?.decodeInt(KEY_DESKTOP_LYRICS_Y, 200) ?: 200
    fun setDesktopLyricsY(y: Int) = safeKv.encode(KEY_DESKTOP_LYRICS_Y, y)

    fun exportConfig(): Map<String, Any> {
        return mapOf(
            KEY_BILIBILI_CDN to getPreferredBilibiliCdn(),
            KEY_RESTORE_POSITION_ENABLED to isRestoreEnabled(),
            KEY_LOUDNESS_NORMALIZATION_ENABLED to isLoudnessNormalizationEnabled(),
            KEY_AUTOPLAY_ON_START_ENABLED to isAutoplayOnStartEnabled(),
            KEY_SPECTRUM_VISUALIZER_ENABLED to isSpectrumVisualizerEnabled(),
            KEY_EQUALIZER_ENABLED to isEqualizerEnabled(),
            KEY_EQUALIZER_PREAMP_DB to getEqualizerPreampDb(),
            KEY_EQUALIZER_LIMITER_ENABLED to isEqualizerLimiterEnabled(),
            KEY_EQUALIZER_GAINS_JSON to getEqualizerGainsJson(),
            KEY_EQUALIZER_ACTIVE_PRESET_ID to (getEqualizerActivePresetId() ?: ""),
            KEY_CUSTOM_EQUALIZER_PRESETS_JSON to getCustomEqualizerPresetsJson(),
            KEY_STATUS_BAR_LYRICS_ENABLED to isStatusBarLyricsEnabled(),
            KEY_STATUS_BAR_LYRICS_PROVIDER to getStatusBarLyricsProvider(),
            KEY_CAR_LYRICS_ENABLED to isCarLyricsEnabled(),
            KEY_DESKTOP_LYRICS_DISPLAY_MODE to getDesktopLyricsMode(),
            KEY_DESKTOP_LYRICS_HIGHLIGHT_COLOR to getDesktopLyricsHighlightColor(),
            KEY_DESKTOP_LYRICS_TEXT_SIZE to getDesktopLyricsTextSize(),
            KEY_DESKTOP_LYRICS_Y to getDesktopLyricsY(),
        )
    }

    fun importConfig(data: Map<String, Any>) {
        (data[KEY_BILIBILI_CDN] as? String)?.let { setPreferredBilibiliCdn(it) }
        (data[KEY_RESTORE_POSITION_ENABLED] as? Boolean)?.let { setRestoreEnabled(it) }
        (data[KEY_LOUDNESS_NORMALIZATION_ENABLED] as? Boolean)?.let { setLoudnessNormalizationEnabled(it) }
        (data[KEY_AUTOPLAY_ON_START_ENABLED] as? Boolean)?.let { setAutoplayOnStartEnabled(it) }
        (data[KEY_SPECTRUM_VISUALIZER_ENABLED] as? Boolean)?.let { setSpectrumVisualizerEnabled(it) }
        (data[KEY_EQUALIZER_ENABLED] as? Boolean)?.let { setEqualizerEnabled(it) }
        (data[KEY_EQUALIZER_PREAMP_DB] as? Number)?.let { setEqualizerPreampDb(it.toFloat()) }
        (data[KEY_EQUALIZER_LIMITER_ENABLED] as? Boolean)?.let { setEqualizerLimiterEnabled(it) }
        (data[KEY_EQUALIZER_GAINS_JSON] as? String)?.let { setEqualizerGainsJson(it) }
        (data[KEY_EQUALIZER_ACTIVE_PRESET_ID] as? String)?.let { presetId ->
            setEqualizerActivePresetId(presetId.ifEmpty { null })
        }
        (data[KEY_CUSTOM_EQUALIZER_PRESETS_JSON] as? String)?.let { setCustomEqualizerPresetsJson(it) }
        (data[KEY_STATUS_BAR_LYRICS_ENABLED] as? Boolean)?.let { setStatusBarLyricsEnabled(it) }
        (data[KEY_STATUS_BAR_LYRICS_PROVIDER] as? String)?.let { setStatusBarLyricsProvider(it) }
        (data[KEY_CAR_LYRICS_ENABLED] as? Boolean)?.let { setCarLyricsEnabled(it) }
        (data[KEY_DESKTOP_LYRICS_DISPLAY_MODE] as? Int)?.let { setDesktopLyricsMode(it) }
        (data[KEY_DESKTOP_LYRICS_HIGHLIGHT_COLOR] as? Int)?.let { setDesktopLyricsHighlightColor(it) }
        (data[KEY_DESKTOP_LYRICS_TEXT_SIZE] as? Float)?.let { setDesktopLyricsTextSize(it) }
        (data[KEY_DESKTOP_LYRICS_Y] as? Int)?.let { setDesktopLyricsY(it) }
        restoreEqualizerConfigToHolder()
    }
}

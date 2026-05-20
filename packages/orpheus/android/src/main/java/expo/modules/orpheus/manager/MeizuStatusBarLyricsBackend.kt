package expo.modules.orpheus.manager

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import expo.modules.orpheus.R

private const val TAG = "MeizuStatusBarLyrics"

/**
 * Flyme/Meizu status-bar lyric implementation.
 *
 * Flyme listens for ticker lyric broadcasts, and some versions still require
 * a ticker notification update to refresh the status-bar text reliably.
 */
class MeizuStatusBarLyricsBackend(context: Context) : StatusBarLyricsBackend(context) {
    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private val appName: String by lazy {
        runCatching {
            val appInfo = context.applicationInfo
            context.packageManager.getApplicationLabel(appInfo).toString()
        }.getOrDefault(context.packageName)
    }

    private val flagAlwaysShowTicker: Int by lazy {
        getNotificationFlag("FLAG_ALWAYS_SHOW_TICKER", FLAG_ALWAYS_SHOW_TICKER_FALLBACK)
    }

    private val flagOnlyUpdateTicker: Int by lazy {
        getNotificationFlag("FLAG_ONLY_UPDATE_TICKER", FLAG_ONLY_UPDATE_TICKER_FALLBACK)
    }

    private var lastText: String? = null

    override val isAvailable: Boolean
        get() = true

    override fun renderLyricFrame(frame: StatusBarLyricFrame?) {
        if (frame == null) {
            onStop()
            return
        }

        val line = frame.line
        val text = line.text.takeIf { it.isNotBlank() } ?: run {
            onStop()
            return
        }
        val translation = line.translation?.takeIf { it.isNotBlank() }
            ?: line.romaji?.takeIf { it.isNotBlank() }

        if (text == lastText) return
        lastText = text

        try {
            sendLyricBroadcast(text)
            postTickerNotification(text, translation)
            Log.d(TAG, "[render] text=\"$text\"")
        } catch (e: Exception) {
            Log.e(TAG, "[render] Failed: ${e.message}")
        }
    }

    // Flyme ticker is line-by-line; progress is ignored.
    override fun updateProgress(positionMs: Long) = Unit

    override fun setPlaybackState(isPlaying: Boolean) {
        if (!isPlaying) return
        lastText?.let { text ->
            runCatching {
                sendLyricBroadcast(text)
                postTickerNotification(text, null)
            }.onFailure { e ->
                Log.e(TAG, "[setPlaybackState] Failed: ${e.message}")
            }
        }
    }

    override fun onStop() {
        lastText = null

        try {
            val intent = Intent(ACTION_CLEAR_LYRIC).apply {
                putExtra(EXTRA_TICKER_PACKAGE, context.packageName)
                putExtra(EXTRA_PACKAGE, context.packageName)
            }
            sendFlymeBroadcast(intent)
            notificationManager.cancel(NOTIFICATION_ID)
        } catch (e: Exception) {
            Log.e(TAG, "[onStop] Failed: ${e.message}")
        }
    }

    private fun sendLyricBroadcast(text: String) {
        val intent = Intent(ACTION_SEND_LYRIC).apply {
            putExtra(EXTRA_TICKER_TEXT, text)
            putExtra(EXTRA_LYRIC, text)
            putExtra(EXTRA_TEXT, text)
            putExtra(EXTRA_CONTENT, text)
            putExtra(EXTRA_TICKER_PACKAGE, context.packageName)
            putExtra(EXTRA_PACKAGE, context.packageName)
            putExtra(EXTRA_TICKER_APP_NAME, appName)
            putExtra(EXTRA_APP_NAME, appName)
        }

        sendFlymeBroadcast(intent)
    }

    private fun sendFlymeBroadcast(intent: Intent) {
        context.sendBroadcast(intent)
        context.sendBroadcast(Intent(intent).setPackage(SYSTEM_UI_PACKAGE))
    }

    @Suppress("DEPRECATION")
    private fun postTickerNotification(text: String, translation: String?) {
        ensureNotificationChannel()

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, CHANNEL_ID)
        } else {
            Notification.Builder(context)
        }

        val notification = builder
            .setSmallIcon(R.drawable.outline_translate_24)
            .setContentTitle(text)
            .setContentText(translation.orEmpty())
            .setTicker(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setLocalOnly(true)
            .setDefaults(0)
            .setPriority(Notification.PRIORITY_MAX)
            .setCategory(Notification.CATEGORY_STATUS)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            notification.extras.putBoolean("ticker_icon_switch", false)
            notification.extras.putInt("ticker_icon", R.drawable.outline_translate_24)
        }

        notification.flags = notification.flags or Notification.FLAG_NO_CLEAR
        notification.flags = notification.flags or flagAlwaysShowTicker
        notification.flags = notification.flags or flagOnlyUpdateTicker

        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (notificationManager.getNotificationChannel(CHANNEL_ID) != null) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            "Flyme 状态栏歌词",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "用于向 Flyme 状态栏推送歌词"
            setSound(null, null)
            enableVibration(false)
            setShowBadge(false)
        }

        notificationManager.createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL_ID = "bbplayer_flyme_status_bar_lyrics"
        const val NOTIFICATION_ID = 0x4242504c
        const val FLAG_ALWAYS_SHOW_TICKER_FALLBACK = 0x1000000
        const val FLAG_ONLY_UPDATE_TICKER_FALLBACK = 0x2000000
        const val ACTION_SEND_LYRIC = "com.meizu.flyme.ticker.ACTION_SEND"
        const val ACTION_CLEAR_LYRIC = "com.meizu.flyme.ticker.ACTION_CLEAR"
        const val SYSTEM_UI_PACKAGE = "com.android.systemui"
        const val EXTRA_TICKER_TEXT = "ticker_text"
        const val EXTRA_LYRIC = "lyric"
        const val EXTRA_TEXT = "text"
        const val EXTRA_CONTENT = "content"
        const val EXTRA_TICKER_PACKAGE = "ticker_package"
        const val EXTRA_PACKAGE = "package"
        const val EXTRA_TICKER_APP_NAME = "ticker_app_name"
        const val EXTRA_APP_NAME = "app_name"

        fun getNotificationFlag(name: String, fallback: Int): Int {
            return runCatching {
                val field = Notification::class.java.getDeclaredField(name)
                field.isAccessible = true
                field.getInt(null)
            }.getOrElse {
                Log.w(TAG, "Flyme ticker flag not found: $name, fallback=$fallback")
                fallback
            }
        }
    }
}

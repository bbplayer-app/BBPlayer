package expo.modules.orpheus.service

import android.app.ForegroundServiceStartNotAllowedException
import android.os.Build
import android.os.Bundle
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaNotification
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList
import expo.modules.bbplayernative.telemetry.NativeLog
import expo.modules.orpheus.telemetry.LogTags

/**
 * 封面异步加载完成后，Media3 会在回调里更新通知并调用 startForegroundService。
 * 这时应用可能已在后台，Android 12+ 会抛 ForegroundServiceStartNotAllowedException。
 * Media3 只在同步更新通知的路径上捕获它，这条异步路径没有捕获，会直接导致崩溃（Media3 1.10.1 仍是如此）。
 *
 * 这里按 Media3 同步路径的做法处理：记一条日志后忽略，等下次允许时再进前台。
 */
@UnstableApi
class ForegroundSafeNotificationProvider(
    private val delegate: MediaNotification.Provider,
) : MediaNotification.Provider {
    override fun createNotification(
        mediaSession: MediaSession,
        customLayout: ImmutableList<CommandButton>,
        actionFactory: MediaNotification.ActionFactory,
        onNotificationChangedCallback: MediaNotification.Provider.Callback,
    ): MediaNotification = delegate.createNotification(mediaSession, customLayout, actionFactory) { notification ->
        try {
            onNotificationChangedCallback.onNotificationChanged(notification)
        } catch (e: IllegalStateException) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || e !is ForegroundServiceStartNotAllowedException) throw e
            NativeLog.warning(LogTags.SERVICE, "player.notification.foreground_not_allowed", error = e)
        }
    }

    override fun handleCustomCommand(session: MediaSession, action: String, extras: Bundle): Boolean =
        delegate.handleCustomCommand(session, action, extras)
}

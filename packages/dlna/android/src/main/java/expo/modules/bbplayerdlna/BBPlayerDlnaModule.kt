package expo.modules.bbplayerdlna

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CastOptions : Record {
    @Field
    val controlURL: String = ""

    @Field
    val title: String = ""

    @Field
    val mime: String = "audio/mp4"

    @Field
    val sourceUrl: String? = null

    @Field
    val filePath: String? = null

    @Field
    val headersJson: String? = null

    @Field
    val renderingControlURL: String? = null
}

class BBPlayerDlnaModule : Module() {
    private var proxy: DlnaHttpProxy? = null
    private var currentControlURL: String? = null
    private var currentRenderingControlURL: String? = null
    private var volumeReceiver: BroadcastReceiver? = null
    private var syncingVolume = false
    private var pushingVolume = false
    private var lastSpeakerVolume: Int? = null

    override fun definition() = ModuleDefinition {
        Name("BBPlayerDlna")

        AsyncFunction("discoverAsync") Coroutine { timeoutMs: Int ->
            val context = requireContext()
            withContext(Dispatchers.IO) {
                SsdpDiscovery.discover(context, timeoutMs)
            }
        }

        AsyncFunction("castAsync") Coroutine { options: CastOptions ->
            val context = requireContext()
            withContext(Dispatchers.IO) {
                if (proxy == null) {
                    proxy = DlnaHttpProxy(context.applicationContext)
                }
                val source = when {
                    !options.filePath.isNullOrBlank() && options.filePath!!.startsWith("content://") ->
                        DlnaHttpProxy.Source.Content(options.filePath!!)
                    !options.filePath.isNullOrBlank() ->
                        DlnaHttpProxy.Source.LocalFile(options.filePath!!)
                    !options.sourceUrl.isNullOrBlank() ->
                        DlnaHttpProxy.Source.Remote(
                            options.sourceUrl!!,
                            parseHeaders(options.headersJson),
                        )
                    else -> throw IllegalArgumentException("castAsync needs sourceUrl or filePath")
                }
                val listenUrl = proxy!!.start(source, options.mime)
                UpnpSoap.play(options.controlURL, listenUrl, options.title, options.mime)
                currentControlURL = options.controlURL
                attachVolume(context, options.renderingControlURL)
                mapOf(
                    "listenUrl" to listenUrl,
                    "controlURL" to options.controlURL,
                    "title" to options.title,
                )
            }
        }

        AsyncFunction("stopCastAsync") Coroutine { ->
            withContext(Dispatchers.IO) {
                val url = currentControlURL
                currentControlURL = null
                detachVolume(requireContext())
                var stopError: Throwable? = null
                if (url != null) {
                    val first = runCatching { UpnpSoap.stop(url) }
                    if (first.isFailure) {
                        val second = runCatching { UpnpSoap.stop(url) }
                        if (second.isFailure) {
                            stopError = second.exceptionOrNull() ?: first.exceptionOrNull()
                        }
                    }
                }
                proxy?.stop()
                if (stopError != null) throw stopError
            }
        }

        AsyncFunction("getStatusAsync") Coroutine { ->
            withContext(Dispatchers.IO) {
                val url = currentControlURL ?: return@withContext null
                val status = UpnpSoap.getStatus(url, currentRenderingControlURL)
                val volume = status["volume"] as? Int
                if (volume != null) {
                    alignPhoneToSpeaker(requireContext(), volume)
                }
                status
            }
        }

        AsyncFunction("pauseCastAsync") Coroutine { ->
            withContext(Dispatchers.IO) {
                val url = currentControlURL ?: throw IllegalStateException("Not casting")
                UpnpSoap.pause(url)
            }
        }

        AsyncFunction("resumeCastAsync") Coroutine { ->
            withContext(Dispatchers.IO) {
                val url = currentControlURL ?: throw IllegalStateException("Not casting")
                UpnpSoap.resume(url)
            }
        }

        AsyncFunction("seekCastAsync") Coroutine { seconds: Double ->
            withContext(Dispatchers.IO) {
                val url = currentControlURL ?: throw IllegalStateException("Not casting")
                UpnpSoap.seek(url, seconds)
            }
        }

        Function("isCasting") {
            currentControlURL != null
        }
    }

    private fun requireContext(): Context =
        appContext.reactContext ?: throw IllegalStateException("React context is not available")

    private fun attachVolume(context: Context, renderingControlURL: String?) {
        if (renderingControlURL.isNullOrBlank()) {
            detachVolume(context)
            return
        }
        currentRenderingControlURL = renderingControlURL
        val app = context.applicationContext
        if (volumeReceiver == null) {
            runCatching {
                val speaker = UpnpSoap.getVolume(renderingControlURL)
                applyPhoneVolume(app, speaker)
                lastSpeakerVolume = speaker
            }
            val receiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context, intent: Intent) {
                    if (syncingVolume) return
                    if (intent.action != "android.media.VOLUME_CHANGED_ACTION") return
                    val stream = intent.getIntExtra("android.media.EXTRA_VOLUME_STREAM_TYPE", -1)
                    if (stream != AudioManager.STREAM_MUSIC) return
                    val url = currentRenderingControlURL ?: return
                    val percent = phoneVolumePercent(ctx)
                    pushingVolume = true
                    Thread {
                        try {
                            runCatching { UpnpSoap.setVolume(url, percent) }
                            lastSpeakerVolume = percent
                        } finally {
                            pushingVolume = false
                        }
                    }.apply { isDaemon = true; start() }
                }
            }
            val filter = IntentFilter("android.media.VOLUME_CHANGED_ACTION")
            if (Build.VERSION.SDK_INT >= 33) {
                app.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                app.registerReceiver(receiver, filter)
            }
            volumeReceiver = receiver
        }
    }

    private fun detachVolume(context: Context) {
        val receiver = volumeReceiver ?: return
        runCatching { context.applicationContext.unregisterReceiver(receiver) }
        volumeReceiver = null
        currentRenderingControlURL = null
        lastSpeakerVolume = null
    }

    private fun alignPhoneToSpeaker(context: Context, speakerVolume: Int) {
        if (pushingVolume || lastSpeakerVolume == speakerVolume) return
        applyPhoneVolume(context, speakerVolume)
        lastSpeakerVolume = speakerVolume
    }

    private fun applyPhoneVolume(context: Context, percent: Int) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        if (max <= 0) return
        val target = (percent.coerceIn(0, 100) * max + 50) / 100
        if (am.getStreamVolume(AudioManager.STREAM_MUSIC) == target) return
        syncingVolume = true
        try {
            am.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
        } finally {
            syncingVolume = false
        }
    }

    private fun phoneVolumePercent(context: Context): Int {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        if (max <= 0) return 0
        return (am.getStreamVolume(AudioManager.STREAM_MUSIC) * 100 + max / 2) / max
    }

    private fun parseHeaders(json: String?): Map<String, String> {
        val result = LinkedHashMap<String, String>()
        if (json.isNullOrBlank()) return result
        val obj = org.json.JSONObject(json)
        val keys = obj.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            result[key] = obj.optString(key)
        }
        return result
    }
}

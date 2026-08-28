package expo.modules.bbplayernative

import android.content.Context
import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.media.MediaPlayer
import android.net.Uri
import android.view.Surface
import android.view.TextureView
import android.view.ViewGroup
import android.widget.FrameLayout
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlin.math.max

class BootSplashVideoViewModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("BBPlayerBootSplashVideo")

        View(BootSplashVideoView::class) {
            Prop("sourceUri", null as String?) { view: BootSplashVideoView, sourceUri: String? ->
                view.sourceUri = sourceUri
            }

            Prop("autoPlay") { view: BootSplashVideoView, autoPlay: Boolean ->
                view.autoPlay = autoPlay
            }

            Prop("loop") { view: BootSplashVideoView, loop: Boolean ->
                view.loop = loop
            }

            Prop("muted") { view: BootSplashVideoView, muted: Boolean ->
                view.muted = muted
            }

            Prop("contentFit") { view: BootSplashVideoView, contentFit: String ->
                view.contentFit = contentFit
            }

            Events("onPlaybackEnd", "onPlaybackError")

            OnViewDidUpdateProps { view: BootSplashVideoView ->
                view.applyChanges()
            }

            AsyncFunction("replay") { view: BootSplashVideoView ->
                view.replay()
            }

            OnViewDestroys { view: BootSplashVideoView ->
                view.cleanup()
            }
        }
    }
}

class BootSplashVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private val textureView = TextureView(context)
    private var surface: Surface? = null
    private var player: MediaPlayer? = null
    private var preparedSourceUri: String? = null
    private var isPrepared = false
    private var videoWidth = 0
    private var videoHeight = 0

    val onPlaybackEnd by EventDispatcher()
    val onPlaybackError by EventDispatcher()

    var sourceUri: String? = null
    var autoPlay = true
    var loop = false
    var muted = true
    var contentFit = "cover"

    init {
        addView(
            textureView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
        textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
                surface = Surface(surfaceTexture)
                applyChanges()
            }

            override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
                updateTextureTransform()
            }

            override fun onSurfaceTextureDestroyed(surfaceTexture: SurfaceTexture): Boolean {
                releasePlayer()
                surface?.release()
                surface = null
                return true
            }

            override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) = Unit
        }
    }

    fun applyChanges() {
        val source = sourceUri?.takeIf { it.isNotBlank() }
        if (source == null || surface == null) {
            if (source == null) releasePlayer()
            return
        }

        if (preparedSourceUri != source) {
            prepare(source)
        } else {
            updatePlayerConfiguration()
            updateTextureTransform()
        }
    }

    fun replay() {
        val currentPlayer = player
        if (currentPlayer == null || !isPrepared) {
            preparedSourceUri = null
            applyChanges()
            return
        }
        currentPlayer.seekTo(0)
        currentPlayer.start()
    }

    fun cleanup() {
        textureView.surfaceTextureListener = null
        releasePlayer()
        surface?.release()
        surface = null
    }

    private fun prepare(source: String) {
        releasePlayer()
        preparedSourceUri = source

        val currentSurface = surface ?: return
        val mediaPlayer = MediaPlayer()
        player = mediaPlayer
        mediaPlayer.setSurface(currentSurface)
        mediaPlayer.setOnPreparedListener {
            isPrepared = true
            updatePlayerConfiguration()
            if (autoPlay) it.start()
        }
        mediaPlayer.setOnVideoSizeChangedListener { _, width, height ->
            videoWidth = width
            videoHeight = height
            textureView.surfaceTexture?.setDefaultBufferSize(width, height)
            updateTextureTransform()
        }
        mediaPlayer.setOnCompletionListener {
            if (!loop) onPlaybackEnd(emptyMap<String, Any>())
        }
        mediaPlayer.setOnErrorListener { _, what, extra ->
            onPlaybackError(mapOf("what" to what, "extra" to extra))
            true
        }

        try {
            val uri = Uri.parse(source)
            if (uri.scheme == null) {
                mediaPlayer.setDataSource(source)
            } else {
                mediaPlayer.setDataSource(context, uri)
            }
            mediaPlayer.prepareAsync()
        } catch (error: Exception) {
            onPlaybackError(mapOf("message" to (error.message ?: "Unable to load video")))
            releasePlayer()
        }
    }

    private fun updatePlayerConfiguration() {
        player?.let { mediaPlayer ->
            mediaPlayer.isLooping = loop
            val volume = if (muted) 0f else 1f
            mediaPlayer.setVolume(volume, volume)
            if (autoPlay && isPrepared && !mediaPlayer.isPlaying) mediaPlayer.start()
        }
    }

    private fun updateTextureTransform() {
        if (videoWidth <= 0 || videoHeight <= 0 || width <= 0 || height <= 0) return

        val scale = when (contentFit) {
            "contain" -> minOf(width.toFloat() / videoWidth, height.toFloat() / videoHeight)
            else -> max(width.toFloat() / videoWidth, height.toFloat() / videoHeight)
        }
        val scaledWidth = videoWidth * scale
        val scaledHeight = videoHeight * scale
        val matrix = Matrix().apply {
            setScale(scale, scale)
            postTranslate((width - scaledWidth) / 2f, (height - scaledHeight) / 2f)
        }
        textureView.setTransform(matrix)
    }

    private fun releasePlayer() {
        player?.reset()
        player?.release()
        player = null
        preparedSourceUri = null
        isPrepared = false
        videoWidth = 0
        videoHeight = 0
    }
}

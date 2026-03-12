/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.impl

import android.media.session.PlaybackState
import android.os.Build
import android.os.SharedMemory
import android.util.Log
import androidx.annotation.RequiresApi
import io.github.proify.lyricon.lyric.model.Song
import io.github.proify.lyricon.provider.IRemotePlayer
import io.github.proify.lyricon.provider.ProviderConstants
import io.github.proify.lyricon.provider.RemotePlayer
import io.github.proify.lyricon.provider.deflate
import io.github.proify.lyricon.provider.json
import io.github.proify.lyricon.provider.service.RemoteServiceBinder
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.encodeToStream
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean

@RequiresApi(Build.VERSION_CODES.O_MR1)
internal class RemotePlayerProxy : RemotePlayer, RemoteServiceBinder<IRemotePlayer?> {

    @Volatile
    var allowSending: Boolean = false

    @Volatile
    private var iRemotePlayer: IRemotePlayer? = null

    @Volatile
    private var positionSharedMemory: SharedMemory? = null

    @Volatile
    private var positionByteBuffer: ByteBuffer? = null

    private val positionActive = AtomicBoolean(false)

    override fun bindRemoteService(service: IRemotePlayer?) {
        if (ProviderConstants.DEBUG) Log.d(TAG, "Binding remote service: ${service != null}")

        clearBinding()
        iRemotePlayer = service

        runCatching {
            service?.positionMemory?.also { memory ->
                positionSharedMemory = memory
                positionByteBuffer = memory.mapReadWrite()
                positionActive.set(true)
            }
        }.onFailure { e ->
            Log.e(TAG, "Failed to map shared memory for position sync", e)
        }
    }

    @OptIn(ExperimentalSerializationApi::class)
    override fun setSong(song: Song?): Boolean = executeRemoteCall { service ->
        val bytes = song?.let {
            val outputStream = ByteArrayOutputStream()
            json.encodeToStream(it, outputStream)
            outputStream.use {
                outputStream.toByteArray().deflate()
            }
        }
        service.setSong(bytes)
    }

    override fun setPlaybackState(playing: Boolean): Boolean =
        executeRemoteCall { it.setPlaybackState(playing) }

    override fun seekTo(position: Long): Boolean =
        executeRemoteCall { it.seekTo(position.coerceAtLeast(0)) }

    override fun setPosition(position: Long): Boolean {
        if (!positionActive.get()) return false
        return try {
            positionByteBuffer?.putLong(0, position.coerceAtLeast(0))
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set position", e)
            false
        }
    }

    override fun setPositionUpdateInterval(interval: Int): Boolean =
        executeRemoteCall { it.setPositionUpdateInterval(interval) }

    override fun sendText(text: String?): Boolean =
        executeRemoteCall { it.sendText(text) }

    override fun setDisplayTranslation(displayTranslation: Boolean): Boolean =
        executeRemoteCall { it.setDisplayTranslation(displayTranslation) }

    override fun setDisplayRoma(displayRoma: Boolean): Boolean =
        executeRemoteCall { it.setDisplayRoma(displayRoma) }

    override fun setPlaybackState(state: PlaybackState?): Boolean =
        executeRemoteCall {
            it.setPlaybackState2(state)
        }

    override val isActive: Boolean
        get() = iRemotePlayer?.asBinder()?.isBinderAlive == true

    private fun clearBinding() {
        positionActive.set(false)

        positionByteBuffer?.let {
            runCatching { SharedMemory.unmap(it) }.getOrElse { it ->
                Log.e(TAG, "Failed to unmap shared memory", it)
            }
            positionByteBuffer = null
        }

        positionSharedMemory?.let {
            runCatching { it.close() }.getOrElse { it ->
                Log.e(TAG, "Failed to close shared memory", it)
            }
            positionSharedMemory = null
        }

        iRemotePlayer = null
    }

    private inline fun executeRemoteCall(block: (IRemotePlayer) -> Any?): Boolean {
        if (!allowSending) return false

        val service = iRemotePlayer ?: return false
        return try {
            val result = block(service)
            (result as? Boolean) ?: true
        } catch (e: Exception) {
            Log.e(TAG, "Remote call failed: ${e.message}", e)
            false
        }
    }

    private companion object {
        private const val TAG = "RemotePlayerProxy"
    }
}
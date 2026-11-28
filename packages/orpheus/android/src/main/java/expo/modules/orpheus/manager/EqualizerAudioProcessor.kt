package expo.modules.orpheus.manager

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor.AudioFormat
import androidx.media3.common.audio.AudioProcessor.StreamMetadata
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import java.nio.ByteOrder

@UnstableApi
class EqualizerAudioProcessor(
    private val configHolder: EqualizerConfigHolder = EqualizerConfigHolder,
) : BaseAudioProcessor() {
    private val dsp = EqualizerDsp(configHolder)
    private var frameSize = 0
    private var pendingTail = ByteArray(0)
    private var pendingTailSize = 0
    private var frameScratch = ByteBuffer.allocateDirect(0).order(ByteOrder.nativeOrder())
    private var wasEnabled = false

    override fun onConfigure(inputAudioFormat: AudioFormat): AudioFormat {
        val supportedEncoding = inputAudioFormat.encoding == C.ENCODING_PCM_16BIT ||
            inputAudioFormat.encoding == C.ENCODING_PCM_FLOAT
        val bytesPerFrame = inputAudioFormat.bytesPerFrame
        if (
            !supportedEncoding ||
            inputAudioFormat.sampleRate <= 0 ||
            inputAudioFormat.channelCount <= 0 ||
            bytesPerFrame <= 0
        ) {
            return AudioFormat.NOT_SET
        }
        frameSize = bytesPerFrame
        pendingTail = ByteArray(bytesPerFrame)
        pendingTailSize = 0
        frameScratch = ByteBuffer.allocateDirect(bytesPerFrame).order(ByteOrder.nativeOrder())
        wasEnabled = false
        dsp.configure(inputAudioFormat.sampleRate, inputAudioFormat.channelCount)
        return inputAudioFormat
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        if (inputBuffer.remaining() <= 0) return
        val enabled = configHolder.get().enabled
        if (enabled != wasEnabled) {
            wasEnabled = enabled
            pendingTailSize = 0
            dsp.reset()
        }
        if (!enabled || frameSize <= 0) {
            val output = replaceOutputBuffer(inputBuffer.remaining())
            output.order(ByteOrder.nativeOrder())
            output.put(inputBuffer)
            output.flip()
            return
        }
        val available = pendingTailSize + inputBuffer.remaining()
        if (available < frameSize) {
            appendToPendingTail(inputBuffer)
            return
        }
        val fullFrameBytes = available - available % frameSize
        val output = replaceOutputBuffer(fullFrameBytes)
        output.order(ByteOrder.nativeOrder())
        var cursor = inputBuffer.position()
        val inputLimit = inputBuffer.limit()
        if (pendingTailSize > 0) {
            val needed = frameSize - pendingTailSize
            frameScratch.clear()
            frameScratch.put(pendingTail, 0, pendingTailSize)
            for (index in 0 until needed) {
                frameScratch.put(inputBuffer.get(cursor + index))
            }
            frameScratch.flip()
            cursor += needed
            pendingTailSize = 0
            dispatchProcess(frameScratch, output)
        }
        val remainingBytes = inputLimit - cursor
        val wholeBytes = remainingBytes - remainingBytes % frameSize
        if (wholeBytes > 0) {
            val slice = inputBuffer.duplicate()
            slice.position(cursor)
            slice.limit(cursor + wholeBytes)
            dispatchProcess(slice, output)
            cursor += wholeBytes
        }
        val tailBytes = inputLimit - cursor
        for (index in 0 until tailBytes) {
            pendingTail[pendingTailSize + index] = inputBuffer.get(cursor + index)
        }
        pendingTailSize += tailBytes
        inputBuffer.position(inputLimit)
        output.flip()
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onFlush() {
        pendingTailSize = 0
        wasEnabled = false
        dsp.reset()
    }

    override fun onFlush(streamMetadata: StreamMetadata) {
        pendingTailSize = 0
        wasEnabled = false
        dsp.reset()
    }

    override fun onReset() {
        pendingTailSize = 0
        wasEnabled = false
        dsp.reset()
    }

    private fun dispatchProcess(input: ByteBuffer, output: ByteBuffer) {
        when (inputAudioFormat.encoding) {
            C.ENCODING_PCM_16BIT -> dsp.processPcm16(input, output)
            C.ENCODING_PCM_FLOAT -> dsp.processPcmFloat(input, output)
            else -> output.put(input)
        }
    }

    private fun appendToPendingTail(inputBuffer: ByteBuffer) {
        while (inputBuffer.hasRemaining()) {
            pendingTail[pendingTailSize] = inputBuffer.get()
            pendingTailSize += 1
        }
    }
}

package expo.modules.orpheus.manager

import android.os.SystemClock
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.ForwardingAudioSink
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/**
 * 从播放器自己的 PCM 数据计算频谱，替代系统 Visualizer。
 *
 * 播放线程把解码后的 PCM（混成单声道）连同时间戳写进环形缓冲；读取时按当前实际播放位置
 * 取最近 [FFT_SIZE] 个采样做 FFT。PCM 写进 AudioTrack 后要几百毫秒才真正播出，
 * 所以不能直接取最新数据，否则频谱会比声音超前。
 *
 * 只有 [isCapturing] 为 true（频谱开关打开）时才会写入。offload 时拿不到 PCM，频谱为 0。
 */
object SpectrumAnalyzer {
    const val FFT_SIZE = 1024

    // 环形缓冲至少要装下这么久的 PCM：AudioTrack 缓冲（Media3 默认最多 750ms）加上输出延迟，再留足余量
    private const val RING_MIN_SECONDS = 4
    private const val ANCHOR_COUNT = 256

    @Volatile
    var isCapturing = false
        set(value) {
            field = value
            if (!value) clear()
        }

    private val lock = Any()

    // 以下字段由 lock 保护
    // 按采样率分配（取 2 的幂，方便取模），48kHz 下约 5.5 秒
    private var ring = FloatArray(0)
    private var ringMask = -1
    private var framesWritten = 0L
    private var sampleRate = 0

    // 每个写入块的起始帧序号与对应的媒体时间，用来把播放位置换算成环形缓冲里的位置
    private val anchorFrames = LongArray(ANCHOR_COUNT)
    private val anchorTimesUs = LongArray(ANCHOR_COUNT)
    private var anchorCount = 0
    private var anchorHead = 0

    private var positionUs = C.TIME_UNSET
    private var positionRealtimeNs = 0L
    private var isPlaying = false
    private var speed = 1f

    // 以下只在读取线程（JS 线程）使用
    private val window = FloatArray(FFT_SIZE) { i ->
        (0.5 - 0.5 * cos(2 * PI * i / (FFT_SIZE - 1))).toFloat()
    }
    private val cosTable = FloatArray(FFT_SIZE / 2) { i -> cos(2 * PI * i / FFT_SIZE).toFloat() }
    private val sinTable = FloatArray(FFT_SIZE / 2) { i -> sin(2 * PI * i / FFT_SIZE).toFloat() }
    private val re = FloatArray(FFT_SIZE)
    private val im = FloatArray(FFT_SIZE)

    internal fun onConfigure(sampleRate: Int) = synchronized(lock) {
        this.sampleRate = sampleRate
        val ringSize = Integer.highestOneBit(maxOf(sampleRate, 1) * RING_MIN_SECONDS - 1) shl 1
        if (ring.size != ringSize) {
            ring = FloatArray(ringSize)
            ringMask = ringSize - 1
            framesWritten = 0
        }
        resetLocked()
    }

    internal fun clear() = synchronized(lock) { resetLocked() }

    private fun resetLocked() {
        anchorCount = 0
        anchorHead = 0
        positionUs = C.TIME_UNSET
    }

    internal fun onPositionUpdated(positionUs: Long) = synchronized(lock) {
        this.positionUs = positionUs
        positionRealtimeNs = SystemClock.elapsedRealtimeNanos()
    }

    internal fun onPlayingChanged(playing: Boolean) = synchronized(lock) {
        if (isPlaying && !playing) {
            // 暂停时把外推的位置固定下来
            positionUs = currentPositionLocked()
            positionRealtimeNs = SystemClock.elapsedRealtimeNanos()
        }
        isPlaying = playing
        positionRealtimeNs = SystemClock.elapsedRealtimeNanos()
    }

    internal fun onSpeedChanged(speed: Float) = synchronized(lock) {
        positionUs = currentPositionLocked()
        positionRealtimeNs = SystemClock.elapsedRealtimeNanos()
        this.speed = speed
    }

    /** 播放线程调用：把一块 PCM 混成单声道写入环形缓冲 */
    internal fun write(buffer: ByteBuffer, presentationTimeUs: Long, encoding: Int, channelCount: Int) {
        // 解码器输出 24/32 位时（如 Hi-Res FLAC），DefaultAudioSink 要到内部才转换，这里拿到的还是原始编码
        val bytesPerSample = when (encoding) {
            C.ENCODING_PCM_16BIT -> 2
            C.ENCODING_PCM_24BIT -> 3
            C.ENCODING_PCM_32BIT, C.ENCODING_PCM_FLOAT -> 4
            else -> return
        }
        if (channelCount <= 0) return
        val data = buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
        val frames = data.remaining() / (bytesPerSample * channelCount)
        if (frames == 0) return

        synchronized(lock) {
            if (ring.isEmpty()) return // 还没 configure
            anchorFrames[anchorHead] = framesWritten
            anchorTimesUs[anchorHead] = presentationTimeUs
            anchorHead = (anchorHead + 1) % ANCHOR_COUNT
            if (anchorCount < ANCHOR_COUNT) anchorCount++

            var index = (framesWritten and ringMask.toLong()).toInt()
            for (frame in 0 until frames) {
                var sum = 0f
                for (channel in 0 until channelCount) {
                    sum += readSample(data, encoding)
                }
                ring[index] = sum / channelCount
                index = (index + 1) and ringMask
            }
            framesWritten += frames
        }
    }

    private fun readSample(data: ByteBuffer, encoding: Int): Float = when (encoding) {
        C.ENCODING_PCM_16BIT -> data.short / 32768f
        C.ENCODING_PCM_24BIT -> {
            val low = data.get().toInt() and 0xFF
            val mid = data.get().toInt() and 0xFF
            val high = data.get().toInt() // 最高字节带符号
            ((high shl 16) or (mid shl 8) or low) / 8388608f
        }
        C.ENCODING_PCM_32BIT -> data.int / 2147483648f
        else -> data.float
    }

    /**
     * 读取线程调用：把当前播放位置的频谱幅度（0 dBFS 正弦波约为 1.0）写进 [destination]。
     * 没有可用数据时填 0。
     */
    fun getSpectrumData(destination: FloatArray) {
        if (!copyCurrentWindow()) {
            destination.fill(0f)
            return
        }

        fft()

        // Hann 窗的相干增益是 0.5，再乘 2 换算成单边谱，使满幅正弦波的峰值约为 1
        val scale = 4f / FFT_SIZE
        val outputSize = minOf(destination.size, FFT_SIZE / 2)
        for (i in 0 until outputSize) {
            destination[i] = hypot(re[i], im[i]) * scale
        }
        if (outputSize < destination.size) {
            destination.fill(0f, outputSize, destination.size)
        }
    }

    private fun copyCurrentWindow(): Boolean = synchronized(lock) {
        if (!isCapturing || sampleRate <= 0 || anchorCount == 0) return false
        val nowUs = currentPositionLocked()
        if (nowUs == C.TIME_UNSET) return false

        // 找时间不晚于当前位置的最新一块
        var anchor = -1
        for (k in 0 until anchorCount) {
            val i = (anchorHead - 1 - k + ANCHOR_COUNT) % ANCHOR_COUNT
            if (anchorTimesUs[i] <= nowUs) {
                anchor = i
                break
            }
        }
        if (anchor < 0) return false

        val offsetFrames = (nowUs - anchorTimesUs[anchor]) * sampleRate / 1_000_000L
        val endFrame = minOf(anchorFrames[anchor] + offsetFrames, framesWritten)
        val startFrame = endFrame - FFT_SIZE
        if (startFrame < 0 || startFrame < framesWritten - ring.size) return false

        var index = (startFrame and ringMask.toLong()).toInt()
        for (i in 0 until FFT_SIZE) {
            re[i] = ring[index] * window[i]
            im[i] = 0f
            index = (index + 1) and ringMask
        }
        true
    }

    private fun currentPositionLocked(): Long {
        if (positionUs == C.TIME_UNSET || !isPlaying) return positionUs
        val elapsedUs = (SystemClock.elapsedRealtimeNanos() - positionRealtimeNs) / 1000
        return positionUs + (elapsedUs * speed).toLong()
    }

    /** 原地迭代基 2 FFT */
    private fun fft() {
        val n = FFT_SIZE
        var j = 0
        for (i in 1 until n) {
            var bit = n shr 1
            while (j and bit != 0) {
                j = j xor bit
                bit = bit shr 1
            }
            j = j xor bit
            if (i < j) {
                val tr = re[i]; re[i] = re[j]; re[j] = tr
                val ti = im[i]; im[i] = im[j]; im[j] = ti
            }
        }

        var len = 2
        while (len <= n) {
            val half = len shr 1
            val step = n / len
            var start = 0
            while (start < n) {
                for (k in 0 until half) {
                    val wr = cosTable[k * step]
                    val wi = -sinTable[k * step]
                    val a = start + k
                    val b = a + half
                    val xr = re[b] * wr - im[b] * wi
                    val xi = re[b] * wi + im[b] * wr
                    re[b] = re[a] - xr
                    im[b] = im[a] - xi
                    re[a] += xr
                    im[a] += xi
                }
                start += len
            }
            len = len shl 1
        }
    }
}

/**
 * 把交给 AudioSink 的 PCM 转给 [SpectrumAnalyzer]，其余行为完全不变。
 * offload 时收到的是压缩数据，直接跳过。
 */
@UnstableApi
class SpectrumCaptureAudioSink(sink: AudioSink) : ForwardingAudioSink(sink) {
    private var pcmEncoding = C.ENCODING_INVALID
    private var channelCount = 0

    // 返回 false 时渲染器会用同一个 buffer 再调用一次，只在第一次时采集
    private var bufferPending = false

    override fun configure(inputFormat: Format, specifiedBufferSize: Int, outputChannels: IntArray?) {
        super.configure(inputFormat, specifiedBufferSize, outputChannels)
        pcmEncoding = if (inputFormat.sampleMimeType == MimeTypes.AUDIO_RAW) {
            inputFormat.pcmEncoding
        } else {
            C.ENCODING_INVALID
        }
        channelCount = inputFormat.channelCount
        bufferPending = false
        SpectrumAnalyzer.onConfigure(inputFormat.sampleRate)
    }

    override fun handleBuffer(
        buffer: ByteBuffer,
        presentationTimeUs: Long,
        encodedAccessUnitCount: Int
    ): Boolean {
        if (!bufferPending && SpectrumAnalyzer.isCapturing && pcmEncoding != C.ENCODING_INVALID) {
            SpectrumAnalyzer.write(buffer, presentationTimeUs, pcmEncoding, channelCount)
        }
        val consumed = super.handleBuffer(buffer, presentationTimeUs, encodedAccessUnitCount)
        bufferPending = !consumed
        return consumed
    }

    override fun getCurrentPositionUs(sourceEnded: Boolean): Long {
        val positionUs = super.getCurrentPositionUs(sourceEnded)
        if (positionUs != AudioSink.CURRENT_POSITION_NOT_SET && SpectrumAnalyzer.isCapturing) {
            SpectrumAnalyzer.onPositionUpdated(positionUs)
        }
        return positionUs
    }

    override fun play() {
        super.play()
        SpectrumAnalyzer.onPlayingChanged(true)
    }

    override fun pause() {
        super.pause()
        SpectrumAnalyzer.onPlayingChanged(false)
    }

    override fun setPlaybackParameters(playbackParameters: PlaybackParameters) {
        super.setPlaybackParameters(playbackParameters)
        SpectrumAnalyzer.onSpeedChanged(getPlaybackParameters().speed)
    }

    override fun flush() {
        super.flush()
        bufferPending = false
        SpectrumAnalyzer.clear()
    }

    override fun reset() {
        super.reset()
        bufferPending = false
        SpectrumAnalyzer.clear()
    }
}

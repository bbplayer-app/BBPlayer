package expo.modules.orpheus.manager

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sign
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tanh

const val EQ_BAND_COUNT = 10

val EQ_FREQUENCIES = doubleArrayOf(
    31.0,
    62.0,
    125.0,
    250.0,
    500.0,
    1000.0,
    2000.0,
    4000.0,
    8000.0,
    16000.0,
)

const val EQ_MIN_GAIN_DB = -12.0f
const val EQ_MAX_GAIN_DB = 12.0f

private const val EQ_PEAKING_Q = 1.4142135623730951
private const val EQ_BYPASS_GAIN_DB = 0.01
private const val EQ_NYQUIST_RATIO = 0.45
private const val EQ_COEFFICIENT_COUNT = 5
private const val EQ_PREAMP_RAMP_SAMPLES = 96
private const val EQ_SOFT_LIMIT_THRESHOLD = 0.85
private const val EQ_SOFT_LIMIT_RANGE = 0.145
private const val EQ_SOFT_LIMIT_CEILING = 0.9949999999999999
private const val EQ_PCM16_SAMPLE_SCALE = 32768.0
private const val EQ_PCM16_MAX = 32767
private const val EQ_PCM16_MIN = -32768
private const val EQ_SQRT_2 = 1.4142135623730951
private const val EQ_PCM16_BYTES_PER_SAMPLE = 2
private const val EQ_PCM_FLOAT_BYTES_PER_SAMPLE = 4

private val EQ_IDENTITY_COEFFICIENTS = doubleArrayOf(1.0, 0.0, 0.0, 0.0, 0.0)

private fun sanitizeEqGain(value: Float): Float =
    if (!value.isFinite()) 0f else value.coerceIn(EQ_MIN_GAIN_DB, EQ_MAX_GAIN_DB)

class EqualizerState(
    val enabled: Boolean = false,
    preampDb: Float = 0f,
    val limiterEnabled: Boolean = true,
    gainsDb: FloatArray = FloatArray(EQ_BAND_COUNT),
    val version: Long = 0L,
) {
    val preampDb: Float = sanitizeEqGain(preampDb)

    private val gainsInternal: FloatArray = FloatArray(EQ_BAND_COUNT) { index ->
        sanitizeEqGain(if (index < gainsDb.size) gainsDb[index] else 0f)
    }

    val gainsDb: FloatArray
        get() = gainsInternal.copyOf()

    fun copyOfGains(): FloatArray = gainsInternal.copyOf()

    fun gainAt(index: Int): Float =
        if (index in gainsInternal.indices) gainsInternal[index] else 0f
}

object EqualizerConfigHolder {
    private val stateRef = AtomicReference(EqualizerState())
    private val versionCounter = AtomicLong(0L)

    fun get(): EqualizerState = stateRef.get()

    fun update(
        enabled: Boolean,
        preampDb: Float,
        limiterEnabled: Boolean,
        gainsDb: FloatArray,
    ): EqualizerState = publish {
        EqualizerState(
            enabled = enabled,
            preampDb = preampDb,
            limiterEnabled = limiterEnabled,
            gainsDb = gainsDb,
            version = versionCounter.incrementAndGet(),
        )
    }

    fun setEnabled(enabled: Boolean): EqualizerState = publish { state ->
        copyState(state, enabled = enabled)
    }

    fun setPreampDb(preampDb: Float): EqualizerState = publish { state ->
        copyState(state, preampDb = preampDb)
    }

    fun setLimiterEnabled(limiterEnabled: Boolean): EqualizerState =
        publish { state ->
            copyState(state, limiterEnabled = limiterEnabled)
        }

    fun setBandGain(index: Int, gainDb: Float): EqualizerState {
        if (index !in 0 until EQ_BAND_COUNT) return stateRef.get()
        return publish { state ->
            val gains = state.copyOfGains()
            gains[index] = gainDb
            copyState(state, gainsDb = gains)
        }
    }

    fun setBands(gainsDb: FloatArray): EqualizerState = publish { state ->
        copyState(state, gainsDb = gainsDb)
    }

    fun resetFlat(): EqualizerState = publish { state ->
        copyState(state, preampDb = 0f, gainsDb = FloatArray(EQ_BAND_COUNT))
    }

    private fun publish(transform: (EqualizerState) -> EqualizerState): EqualizerState {
        while (true) {
            val current = stateRef.get()
            val next = transform(current)
            if (stateRef.compareAndSet(current, next)) return next
        }
    }

    private fun copyState(
        state: EqualizerState,
        enabled: Boolean = state.enabled,
        preampDb: Float = state.preampDb,
        limiterEnabled: Boolean = state.limiterEnabled,
        gainsDb: FloatArray = state.copyOfGains(),
    ): EqualizerState = EqualizerState(
        enabled = enabled,
        preampDb = preampDb,
        limiterEnabled = limiterEnabled,
        gainsDb = gainsDb,
        version = versionCounter.incrementAndGet(),
    )
}

class EqualizerDsp(
    private val configHolder: EqualizerConfigHolder = EqualizerConfigHolder,
) {
    private var sampleRate = 0
    private var channelCount = 0
    private var coefficients = DoubleArray(EQ_BAND_COUNT * EQ_COEFFICIENT_COUNT)
    private var z1 = DoubleArray(0)
    private var z2 = DoubleArray(0)
    private var appliedVersion = Long.MIN_VALUE
    private var targetPreampGain = 1.0
    private var currentPreampGain = 1.0
    private var preampStep = 0.0
    private var preampRampRemaining = 0
    private var limiterEnabled = true

    fun configure(sampleRate: Int, channelCount: Int) {
        val stateSize = if (channelCount > 0) channelCount * EQ_BAND_COUNT else 0
        if (
            this.sampleRate == sampleRate &&
            this.channelCount == channelCount &&
            z1.size == stateSize
        ) {
            return
        }
        this.sampleRate = sampleRate
        this.channelCount = channelCount
        z1 = DoubleArray(stateSize)
        z2 = DoubleArray(stateSize)
        appliedVersion = Long.MIN_VALUE
        targetPreampGain = 1.0
        currentPreampGain = 1.0
        preampStep = 0.0
        preampRampRemaining = 0
        if (sampleRate > 0 && channelCount > 0) {
            applyState(configHolder.get())
        }
    }

    fun reset() {
        z1.fill(0.0)
        z2.fill(0.0)
        appliedVersion = Long.MIN_VALUE
        targetPreampGain = 1.0
        currentPreampGain = 1.0
        preampStep = 0.0
        preampRampRemaining = 0
        limiterEnabled = true
    }

    fun processPcm16(input: ByteBuffer, output: ByteBuffer) {
        val src = input.duplicate().order(ByteOrder.nativeOrder())
        val dst = output.duplicate().order(ByteOrder.nativeOrder())
        val state = configHolder.get()
        if (state.enabled) applyState(state)
        if (!state.enabled || sampleRate <= 0 || channelCount <= 0) {
            copyRemaining(src, dst)
            commitPositions(input, output, src, dst)
            return
        }
        val frameBytes = channelCount * EQ_PCM16_BYTES_PER_SAMPLE
        val frameCount = src.remaining() / frameBytes
        for (frame in 0 until frameCount) {
            val preamp = advancePreampGain()
            for (channel in 0 until channelCount) {
                val sample = src.getShort().toDouble() / EQ_PCM16_SAMPLE_SCALE
                val processed = softLimit(filterBands(sample * preamp, channel))
                val encoded = (processed * EQ_PCM16_SAMPLE_SCALE)
                    .roundToInt()
                    .coerceIn(EQ_PCM16_MIN, EQ_PCM16_MAX)
                dst.putShort(encoded.toShort())
            }
        }
        commitPositions(input, output, src, dst)
    }

    fun processPcmFloat(input: ByteBuffer, output: ByteBuffer) {
        val src = input.duplicate().order(ByteOrder.nativeOrder())
        val dst = output.duplicate().order(ByteOrder.nativeOrder())
        val state = configHolder.get()
        if (state.enabled) applyState(state)
        if (!state.enabled || sampleRate <= 0 || channelCount <= 0) {
            copyRemaining(src, dst)
            commitPositions(input, output, src, dst)
            return
        }
        val frameBytes = channelCount * EQ_PCM_FLOAT_BYTES_PER_SAMPLE
        val frameCount = src.remaining() / frameBytes
        for (frame in 0 until frameCount) {
            val preamp = advancePreampGain()
            for (channel in 0 until channelCount) {
                val raw = src.getFloat().toDouble()
                val sample = if (raw.isFinite()) raw else 0.0
                val processed = softLimit(filterBands(sample * preamp, channel))
                dst.putFloat(processed.toFloat())
            }
        }
        commitPositions(input, output, src, dst)
    }

    fun softLimit(sample: Double): Double {
        if (sample.isNaN()) return 0.0
        if (!sample.isFinite()) {
            return if (sample > 0.0) EQ_SOFT_LIMIT_CEILING else -EQ_SOFT_LIMIT_CEILING
        }
        if (!limiterEnabled) return sample.coerceIn(-1.0, 1.0)
        val magnitude = abs(sample)
        if (magnitude <= EQ_SOFT_LIMIT_THRESHOLD) return sample
        val shaped = EQ_SOFT_LIMIT_THRESHOLD +
            EQ_SOFT_LIMIT_RANGE *
            tanh((magnitude - EQ_SOFT_LIMIT_THRESHOLD) / EQ_SOFT_LIMIT_RANGE)
        return sign(sample) * shaped.coerceAtMost(EQ_SOFT_LIMIT_CEILING)
    }

    private fun applyState(state: EqualizerState) {
        limiterEnabled = state.limiterEnabled
        if (sampleRate <= 0 || channelCount <= 0) return
        if (state.version != appliedVersion) {
            val gains = state.copyOfGains()
            for (band in 0 until EQ_BAND_COUNT) {
                val designed = designBand(band, gains[band].toDouble())
                val offset = band * EQ_COEFFICIENT_COUNT
                for (index in 0 until EQ_COEFFICIENT_COUNT) {
                    coefficients[offset + index] = designed[index]
                }
            }
            appliedVersion = state.version
        }
        val target = dbToLinear(state.preampDb.toDouble())
        if (target != targetPreampGain) {
            targetPreampGain = target
            preampStep = (target - currentPreampGain) / EQ_PREAMP_RAMP_SAMPLES
            preampRampRemaining = EQ_PREAMP_RAMP_SAMPLES
        }
    }

    private fun designBand(band: Int, gainDb: Double): DoubleArray {
        if (sampleRate <= 0 || !gainDb.isFinite() || abs(gainDb) < EQ_BYPASS_GAIN_DB) {
            return EQ_IDENTITY_COEFFICIENTS
        }
        val frequency = EQ_FREQUENCIES[band]
        if (frequency >= sampleRate * EQ_NYQUIST_RATIO) return EQ_IDENTITY_COEFFICIENTS
        val a = 10.0.pow(gainDb / 40.0)
        val w0 = 2.0 * PI * frequency / sampleRate
        val cosW0 = cos(w0)
        val sinW0 = sin(w0)
        return when {
            band == 0 -> designLowShelf(a, cosW0, sinW0)
            band == EQ_BAND_COUNT - 1 -> designHighShelf(a, cosW0, sinW0)
            else -> designPeaking(a, cosW0, sinW0)
        }
    }

    private fun designPeaking(a: Double, cosW0: Double, sinW0: Double): DoubleArray {
        val alpha = sinW0 / (2.0 * EQ_PEAKING_Q)
        return normalizeBiquad(
            1.0 + alpha * a,
            -2.0 * cosW0,
            1.0 - alpha * a,
            -2.0 * cosW0,
            1.0 - alpha / a,
            1.0 + alpha / a,
        )
    }

    private fun designLowShelf(a: Double, cosW0: Double, sinW0: Double): DoubleArray {
        val alpha = sinW0 / 2.0 * EQ_SQRT_2
        val shelfAlpha = 2.0 * sqrt(a) * alpha
        return normalizeBiquad(
            a * (a + 1.0 - (a - 1.0) * cosW0 + shelfAlpha),
            2.0 * a * (a - 1.0 - (a + 1.0) * cosW0),
            a * (a + 1.0 - (a - 1.0) * cosW0 - shelfAlpha),
            -2.0 * (a - 1.0 + (a + 1.0) * cosW0),
            a + 1.0 + (a - 1.0) * cosW0 - shelfAlpha,
            a + 1.0 + (a - 1.0) * cosW0 + shelfAlpha,
        )
    }

    private fun designHighShelf(a: Double, cosW0: Double, sinW0: Double): DoubleArray {
        val alpha = sinW0 / 2.0 * EQ_SQRT_2
        val shelfAlpha = 2.0 * sqrt(a) * alpha
        return normalizeBiquad(
            a * (a + 1.0 + (a - 1.0) * cosW0 + shelfAlpha),
            -2.0 * a * (a - 1.0 + (a + 1.0) * cosW0),
            a * (a + 1.0 + (a - 1.0) * cosW0 - shelfAlpha),
            2.0 * (a - 1.0 - (a + 1.0) * cosW0),
            a + 1.0 - (a - 1.0) * cosW0 - shelfAlpha,
            a + 1.0 - (a - 1.0) * cosW0 + shelfAlpha,
        )
    }

    private fun normalizeBiquad(
        b0: Double,
        b1: Double,
        b2: Double,
        a1: Double,
        a2: Double,
        a0: Double,
    ): DoubleArray {
        if (!a0.isFinite() || a0 == 0.0) return EQ_IDENTITY_COEFFICIENTS
        val normalized = doubleArrayOf(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)
        for (value in normalized) {
            if (!value.isFinite()) return EQ_IDENTITY_COEFFICIENTS
        }
        return normalized
    }

    private fun filterBands(input: Double, channel: Int): Double {
        var value = input
        val base = channel * EQ_BAND_COUNT
        for (band in 0 until EQ_BAND_COUNT) {
            val offset = band * EQ_COEFFICIENT_COUNT
            val stateIndex = base + band
            val filtered = coefficients[offset] * value + z1[stateIndex]
            z1[stateIndex] = coefficients[offset + 1] * value -
                coefficients[offset + 3] * filtered +
                z2[stateIndex]
            z2[stateIndex] = coefficients[offset + 2] * value -
                coefficients[offset + 4] * filtered
            value = filtered
        }
        return value
    }

    private fun advancePreampGain(): Double {
        if (preampRampRemaining <= 0) return currentPreampGain
        currentPreampGain += preampStep
        preampRampRemaining -= 1
        if (preampRampRemaining == 0) currentPreampGain = targetPreampGain
        return currentPreampGain
    }

    private fun copyRemaining(src: ByteBuffer, dst: ByteBuffer) {
        while (src.hasRemaining()) dst.put(src.get())
    }

    private fun commitPositions(
        input: ByteBuffer,
        output: ByteBuffer,
        src: ByteBuffer,
        dst: ByteBuffer,
    ) {
        input.position(src.position())
        output.position(dst.position())
    }

    private fun dbToLinear(decibels: Double): Double = 10.0.pow(decibels / 20.0)
}

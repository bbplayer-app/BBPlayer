package expo.modules.orpheus

import android.media.audiofx.Visualizer
import android.util.Log
import kotlin.math.hypot
import kotlin.math.log10

class SpectrumManager {
    private var visualizer: Visualizer? = null
    private var isEnabled = false
    private val fftSize = Visualizer.getCaptureSizeRange()[1] // Max capture size (usually 1024)
    private var fftBytes = ByteArray(fftSize)

    fun start(audioSessionId: Int) {
        if (visualizer != null) {
            stop()
        }

        try {
            visualizer = Visualizer(audioSessionId).apply {
                captureSize = fftSize
                setDataCaptureListener(object : Visualizer.OnDataCaptureListener {
                    override fun onWaveFormDataCapture(
                        visualizer: Visualizer?,
                        waveform: ByteArray?,
                        samplingRate: Int
                    ) {
                        // Not used
                    }

                    override fun onFftDataCapture(
                        visualizer: Visualizer?,
                        fft: ByteArray?,
                        samplingRate: Int
                    ) {
                        // 我们采用手动轮询获取数据，但这个是必须的
                    }
                }, Visualizer.getMaxCaptureRate() / 2, false, true)
                enabled = true
            }
            isEnabled = true
        } catch (e: Exception) {
            Log.e("Orpheus", "Failed to initialize Visualizer: ${e.message}")
            isEnabled = false
        }
    }

    fun stop() {
        try {
            visualizer?.enabled = false
            visualizer?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            visualizer = null
            isEnabled = false
        }
    }

    /**
     * Fills the provided FloatArray with normalized magnitude data (0.0 - 1.0).
     * The array size should ideally be fftSize / 2.
     */
    fun getSpectrumData(destination: FloatArray) {
        if (!isEnabled || visualizer == null) {
            destination.fill(0f)
            return
        }

        try {
            visualizer?.getFft(fftBytes)
            
            val n = fftBytes.size
            val outputSize = minOf(destination.size, n / 2)

            for (i in 0 until outputSize) {
                if (i == 0) {
                     val real = fftBytes[0].toFloat()
                     val imag = fftBytes[1].toFloat()
                     destination[0] = hypot(real, imag) / 128.0f
                } else {
                    val k = i * 2
                    if (k + 1 < n) {
                        val real = fftBytes[k].toFloat()
                        val imag = fftBytes[k + 1].toFloat()
                        val magnitude = hypot(real, imag)
                        destination[i] = magnitude / 128.0f 
                    }
                }
            }
        } catch (e: Exception) {
             destination.fill(0f)
        }
    }
}

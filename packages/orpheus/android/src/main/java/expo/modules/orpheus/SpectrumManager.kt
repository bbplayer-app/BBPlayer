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
                        // We are pulling data manually in updateSpectrumData, so we might not need this listener active
                        // But enabling it is required to start capturing? Actually, getFft() works if enabled.
                        // We do nothing here to save CPU.
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
            
            // FFT format:
            // byte[0] is DC component (real part)
            // byte[1] is DC component (imaginary part) - usually 0
            // byte[2] is real part of 1st frequency bin
            // byte[3] is imaginary part of 1st frequency bin
            // ...
            // magnitude = sqrt(real^2 + imag^2)
            
            val n = fftBytes.size
            // We only care about magnitude, so output size is n / 2
            val outputSize = minOf(destination.size, n / 2)

            for (i in 0 until outputSize) {
                // The first bin (DC)
                if (i == 0) {
                     val real = fftBytes[0].toFloat()
                     val imag = fftBytes[1].toFloat()
                     destination[0] = hypot(real, imag) / 128.0f // Normalize?
                } else {
                    val k = i * 2
                    if (k + 1 < n) {
                        val real = fftBytes[k].toFloat()
                        val imag = fftBytes[k + 1].toFloat()
                        val magnitude = hypot(real, imag)
                        // Logarithmic scaling or linear? Linear is raw.
                        // Visualizer returns 0-128 range roughly (byte is signed -128..127)
                        // But magnitude can be higher. 
                        // Let's normalize roughly to 0..1.
                        destination[i] = magnitude / 128.0f 
                    }
                }
            }
        } catch (e: Exception) {
             // Visualizer might fail if player stopped
             destination.fill(0f)
        }
    }
}

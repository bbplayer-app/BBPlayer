import Foundation
import AVFoundation
import Accelerate

class AudioSpectrumAnalyzer {
    static let shared = AudioSpectrumAnalyzer()
    
    // Configuration
    private let fftSize: Int = 1024
    private lazy var log2n = vDSP_Length(log2(Float(fftSize)))
    
    // Buffers and Setup
    private var fftSetup: vDSP_DFT_Setup?
    
    // Safe data storage ensuring thread safety (Tap runs on audio thread)
    private var frequencyData = [Float](repeating: 0, count: 512) // fftSize / 2
    private let lock = NSLock()
    
    private init() {
        fftSetup = vDSP_DFT_zop_CreateSetup(nil, vDSP_Length(fftSize), vDSP_DFT_Direction.FORWARD)
    }
    
    deinit {
        if let setup = fftSetup {
            vDSP_DFT_DestroySetup(setup)
        }
    }
    
    // MARK: - Tap Creation
    
    func createTap() -> MTAudioProcessingTap? {
        var callbacks = MTAudioProcessingTapCallbacks(
            version: kMTAudioProcessingTapCallbacksVersion_0,
            clientInfo: nil,
            init: { (tap, clientInfo, tapStorageOut) in
                // Init
            },
            finalize: { (tap) in
                // Finalize
            },
            prepare: { (tap, maxFrames, format) in
                // Prepare
            },
            unprepare: { (tap) in
                // Unprepare
            },
            process: { (tap, numberFrames, flags, bufferListInOut, numberFramesOut, flagsOut) in
                // Process
                let status = MTAudioProcessingTapGetSourceAudio(tap, numberFrames, bufferListInOut, flagsOut, nil, numberFramesOut)
                
                if status == noErr {
                    AudioSpectrumAnalyzer.shared.processAudio(bufferList: bufferListInOut, frames: numberFrames)
                }
            }
        )
        
        var tap: Unmanaged<MTAudioProcessingTap>?
        let err = MTAudioProcessingTapCreate(kCFAllocatorDefault, &callbacks, kMTAudioProcessingTapCreationFlag_PreEffects, &tap)
        
        if err == noErr {
            return tap?.takeRetainedValue()
        }
        
        return nil
    }
    
    // MARK: - Processing
    
    // Called from Audio Thread - performance critical!
    private func processAudio(bufferList: UnsafeMutablePointer<AudioBufferList>, frames: CMItemCount) {
        let buffers = UnsafeMutableAudioBufferListPointer(bufferList)
        
        // Assume non-interleaved or take the first channel
        guard let firstBuffer = buffers.first, let dataPointer = firstBuffer.mData else { return }
        
        // If float data (standard for AVPlayer), cast it
        let floatPointer = dataPointer.assumingMemoryBound(to: Float.self)
        
        // We need 'fftSize' samples. processing buffer might be different size.
        // For simplicity in this "pull" model, we just take the first fftSize samples if available,
        // or zero pad. A real production ring buffer is better but more complex.
        // Given high fps pull, taking a snapshot of current buffer is usually "good enough" for visualization.
        
        // Check if we have enough frames
        let captureSize = min(Int(frames), fftSize)
        
        // We must perform FFT here
        // 1. Convert real input to complex split for vDSP
        // Actually, vDSP_DFT_Execute takes separate real and imaginary arrays if using complex-split, 
        // OR interleaved complex.
        // Let's use vDSP_DFT_zop_CreateSetup which allows Real -> Complex?
        // Wait, regular FFT usually expects Complex input.
        // We can treat Real input as Complex with Imaginary = 0.
        
        var realIn = [Float](repeating: 0, count: fftSize)
        var imagIn = [Float](repeating: 0, count: fftSize)
        var realOut = [Float](repeating: 0, count: fftSize)
        var imagOut = [Float](repeating: 0, count: fftSize)
        
        // Auto-scale window (Hamming/Hann) could be applied here for better quality.
        // Copy audio data
        for i in 0..<captureSize {
            realIn[i] = floatPointer[i]
        }
        
        // Execute FFT
        guard let setup = fftSetup else { return }
        
        // vDSP_DFT_Execute expects interleaved complex? No...
        // vDSP_DFT_Execute(_:_:_:_:_:)
        // "Performs an out-of-place disconnect Fourier transform"
        // It takes input real, input imag, output real, output imag.
        
        vDSP_DFT_Execute(setup, &realIn, &imagIn, &realOut, &imagOut)
        
        // Calculate magnitudes
        // mag = sqrt(r^2 + i^2)
        var magnitudes = [Float](repeating: 0, count: fftSize)
        
        // Using vDSP_zvabs not applicable directly unless we have DSPSplitComplex
        // Let's just loop or use vDSP_vdist (vector distance)
        // Magnitudes is essentially distance from (0,0) to (r, i)
        
        // vDSP_hvdist(realOnly, 1, imagOnly, 1, &magnitudes, 1, n) triggers "hypot" behavior
        // But wait, vDSP_zvabs takes (real, imag) split complex and returns mangitude.
        
        var splitComplex = DSPSplitComplex(realp: &realOut, imagp: &imagOut)
        vDSP_zvabs(&splitComplex, 1, &magnitudes, 1, vDSP_Length(fftSize))
        
        // Normalize
        // Audio samples are -1..1.
        // FFT scales by N? Or sqrt(N)?
        // We usually want 0..1 output. 
        // Applying 1/N scaling.
        var scale = 1.0 / Float(fftSize)
        vDSP_vsmul(&magnitudes, 1, &scale, &magnitudes, 1, vDSP_Length(fftSize))
        
        // Save to thread-safe storage
        // We only fail half (Nyquist)
        let validCount = fftSize / 2
        
        if lock.try() {
            for i in 0..<validCount {
                frequencyData[i] = magnitudes[i]
            }
            lock.unlock()
        }
    }
    
    // MARK: - Public Accessor
    
    func fillSpectrumData(destination: UnsafeMutablePointer<Float32>, count: Int) {
        lock.lock()
        defer { lock.unlock() }
        
        let copyCount = min(count, frequencyData.count)
        // Safe copy
        for i in 0..<copyCount {
            destination[i] = frequencyData[i]
        }
        
        // Zero pad if destination is larger
        if count > copyCount {
            for i in copyCount..<count {
                destination[i] = 0
            }
        }
    }
}

import Foundation
import MMKV

class GeneralStorage {
    static let shared = GeneralStorage()
    
    private let mmkv = MMKV.default()
    
    private let KEY_SAVED_QUEUE = "saved_queue_json_list"
    private let KEY_SAVED_INDEX = "saved_index"
    private let KEY_SAVED_POSITION = "saved_position"
    private let KEY_SAVED_REPEAT_MODE = "saved_repeat_mode"
    private let KEY_SAVED_SHUFFLE_MODE = "saved_shuffle_mode"
    
    private let KEY_RESTORE_ENABLED = "restorePlaybackPositionEnabled"
    private let KEY_LOUDNESS_ENABLED = "loudnessNormalizationEnabled"
    private let KEY_AUTOPLAY_ENABLED = "autoplayOnStartEnabled"
    private let KEY_SPECTRUM_VISUALIZER_ENABLED = "spectrumVisualizerEnabled"
    private let KEY_BILIBILI_CDN = "preferredBilibiliCdn"
    private let KEY_NOTIFICATION_ARTWORK_ENABLED = "notificationArtworkEnabled"
    private let KEY_RESUME_STRATEGY = "playbackResumeStrategy"

    private let EXPORT_KEY_BILIBILI_CDN = "config_bilibili_cdn"
    private let EXPORT_KEY_RESTORE_ENABLED = "config_restore_position_enabled"
    private let EXPORT_KEY_LOUDNESS_ENABLED = "config_loudness_normalization_enabled"
    private let EXPORT_KEY_AUTOPLAY_ENABLED = "config_autoplay_on_start_enabled"
    private let EXPORT_KEY_SPECTRUM_ENABLED = "config_spectrum_visualizer_enabled"
    
    // MARK: - Preferences

    var preferredBilibiliCdn: String {
        get { mmkv?.string(forKey: KEY_BILIBILI_CDN) ?? "auto" }
        set {
            let allowed = ["auto", "ali", "tencent", "huawei", "akamai"]
            mmkv?.set(allowed.contains(newValue) ? newValue : "auto", forKey: KEY_BILIBILI_CDN)
        }
    }
    
    var isRestoreEnabled: Bool {
        get { return mmkv?.bool(forKey: KEY_RESTORE_ENABLED, defaultValue: false) ?? false }
        set { mmkv?.set(newValue, forKey: KEY_RESTORE_ENABLED) }
    }
    
    var isLoudnessNormalizationEnabled: Bool {
        get { return mmkv?.bool(forKey: KEY_LOUDNESS_ENABLED, defaultValue: true) ?? true }
        set { mmkv?.set(newValue, forKey: KEY_LOUDNESS_ENABLED) }
    }
    
    var isAutoplayOnStartEnabled: Bool {
        get { return mmkv?.bool(forKey: KEY_AUTOPLAY_ENABLED, defaultValue: false) ?? false }
        set { mmkv?.set(newValue, forKey: KEY_AUTOPLAY_ENABLED) }
    }

    var isSpectrumVisualizerEnabled: Bool {
        get { return mmkv?.bool(forKey: KEY_SPECTRUM_VISUALIZER_ENABLED, defaultValue: false) ?? false }
        set {
            mmkv?.set(newValue, forKey: KEY_SPECTRUM_VISUALIZER_ENABLED)
            AudioSpectrumAnalyzer.shared.setEnabled(newValue)
        }
    }
    
    var isNotificationArtworkEnabled: Bool {
        get { return mmkv?.bool(forKey: KEY_NOTIFICATION_ARTWORK_ENABLED, defaultValue: true) ?? true }
        set { mmkv?.set(newValue, forKey: KEY_NOTIFICATION_ARTWORK_ENABLED) }
    }

    var playbackResumeStrategy: Int {
        get { return Int(mmkv?.int32(forKey: KEY_RESUME_STRATEGY, defaultValue: 0) ?? 0) }
        set { mmkv?.set(Int32(newValue), forKey: KEY_RESUME_STRATEGY) }
    }

    // MARK: - Per-track resume

    private let STRATEGY_PODCAST = 1
    private let KEY_RESUME_PREFIX = "resume::"
    private let resumeStore = MMKV(mmapID: "track_resume_store")

    /// Where podcast mode should pick this track up, if it stopped partway through.
    func trackResumePosition(id: String) -> Double? {
        guard playbackResumeStrategy == STRATEGY_PODCAST,
              let position = resumeStore?.double(forKey: KEY_RESUME_PREFIX + id, defaultValue: 0),
              position > 0 else { return nil }
        return position
    }

    /// Records are kept whatever the strategy is, so switching to podcast mode finds them.
    func saveTrackResume(id: String, position: Double, duration: Double) {
        guard position > 0, position < duration else { return }
        resumeStore?.set(position, forKey: KEY_RESUME_PREFIX + id)
    }

    func clearTrackResume(id: String) {
        resumeStore?.removeValue(forKey: KEY_RESUME_PREFIX + id)
    }

    // MARK: - Loudness

    private let loudnessStore = MMKV(mmapID: "loudness_normalization_store")

    /// Bilibili's measured loudness for a track, or 0 when unknown. Keyed by the track's
    /// URI, as on Android, so backups move between platforms.
    func measuredLoudness(uri: String) -> Double {
        return loudnessStore?.double(forKey: uri, defaultValue: 0) ?? 0
    }

    func saveLoudness(uri: String, measured: Double) {
        loudnessStore?.set(measured, forKey: uri)
    }

    func exportLoudness() -> [String: Double] {
        guard let store = loudnessStore else { return [:] }
        var values: [String: Double] = [:]
        for case let uri as String in store.allKeys() {
            values[uri] = store.double(forKey: uri, defaultValue: 0)
        }
        return values
    }

    func importLoudness(_ values: [String: Any]) {
        for (uri, value) in values {
            if let measured = value as? Double { saveLoudness(uri: uri, measured: measured) }
        }
    }

    // MARK: - Backup

    /// Uses the same keys as the Android `exportConfig` so backups move between platforms.
    func exportConfig() -> [String: Any] {
        return [
            EXPORT_KEY_BILIBILI_CDN: preferredBilibiliCdn,
            EXPORT_KEY_RESTORE_ENABLED: isRestoreEnabled,
            EXPORT_KEY_LOUDNESS_ENABLED: isLoudnessNormalizationEnabled,
            EXPORT_KEY_AUTOPLAY_ENABLED: isAutoplayOnStartEnabled,
            EXPORT_KEY_SPECTRUM_ENABLED: isSpectrumVisualizerEnabled,
        ]
    }

    func importConfig(_ config: [String: Any]) {
        if let value = config[EXPORT_KEY_BILIBILI_CDN] as? String { preferredBilibiliCdn = value }
        if let value = config[EXPORT_KEY_RESTORE_ENABLED] as? Bool { isRestoreEnabled = value }
        if let value = config[EXPORT_KEY_LOUDNESS_ENABLED] as? Bool { isLoudnessNormalizationEnabled = value }
        if let value = config[EXPORT_KEY_AUTOPLAY_ENABLED] as? Bool { isAutoplayOnStartEnabled = value }
        if let value = config[EXPORT_KEY_SPECTRUM_ENABLED] as? Bool { isSpectrumVisualizerEnabled = value }
    }

    // MARK: - Playback State

    func saveQueue(_ queue: [Track]) {
        let dicts = queue.map { $0.dictionaryRepresentation }
        do {
            let data = try JSONSerialization.data(withJSONObject: dicts, options: [])
            mmkv?.set(data, forKey: KEY_SAVED_QUEUE)
        } catch {
             print("Failed to save queue: \(error)")
        }
    }
    
    func getSavedQueue() -> [Track] {
        guard let data = mmkv?.data(forKey: KEY_SAVED_QUEUE),
              let dicts = try? JSONSerialization.jsonObject(with: data, options: []) as? [[String: Any]] else {
            return []
        }

        return dicts.compactMap { Track(dictionary: $0) }
    }

    func savePosition(index: Int, positionSec: Double) {
        mmkv?.set(Int32(index), forKey: KEY_SAVED_INDEX)
        
        if !positionSec.isNaN && !positionSec.isInfinite {
             let positionMs = Int64(positionSec * 1000)
             mmkv?.set(Int64(positionMs), forKey: KEY_SAVED_POSITION)
        }
    }
    
    func getSavedIndex() -> Int {
        return Int(mmkv?.int32(forKey: KEY_SAVED_INDEX, defaultValue: -1) ?? -1)
    }
    
    func getSavedPosition() -> Double {
        return Double(mmkv?.int64(forKey: KEY_SAVED_POSITION, defaultValue: 0) ?? 0) / 1000.0
    }
    
    func saveRepeatMode(_ mode: Int) {
        mmkv?.set(Int32(mode), forKey: KEY_SAVED_REPEAT_MODE)
    }
    
    func getSavedRepeatMode() -> Int {
        return Int(mmkv?.int32(forKey: KEY_SAVED_REPEAT_MODE, defaultValue: 0) ?? 0)
    }
    
    func saveShuffleMode(_ enabled: Bool) {
        mmkv?.set(enabled, forKey: KEY_SAVED_SHUFFLE_MODE)
    }
    
    func getSavedShuffleMode() -> Bool {
        return mmkv?.bool(forKey: KEY_SAVED_SHUFFLE_MODE, defaultValue: false) ?? false
    }
}

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
    
    // MARK: - Preferences
    
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


import Foundation
import MMKV

struct PlaybackContext: Codable {
    let id: String
    var mode: String

    init(mode: String) {
        self.id = UUID().uuidString
        self.mode = mode
    }

    var dictionary: [String: String] { ["id": id, "mode": mode] }
}

class GeneralStorage {
    static let shared = GeneralStorage()
    
    private let mmkv = MMKV.default()
    private(set) var pendingPlaybackRestore = false

    func consumePendingPlaybackRestore() { pendingPlaybackRestore = false }
    
    private let KEY_SAVED_QUEUE = "saved_queue_json_list"
    private let KEY_SAVED_INDEX = "saved_index"
    private let KEY_SAVED_POSITION = "saved_position"
    private let KEY_SAVED_REPEAT_MODE = "saved_repeat_mode"
    private let KEY_SAVED_SHUFFLE_MODE = "saved_shuffle_mode"
    
    private let KEY_RESTORE_ENABLED = "restorePlaybackPositionEnabled"
    private let KEY_LOUDNESS_ENABLED = "loudnessNormalizationEnabled"
    private let KEY_AUTOPLAY_ENABLED = "autoplayOnStartEnabled"
    private let KEY_SPECTRUM_VISUALIZER_ENABLED = "spectrumVisualizerEnabled"
    
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

    var isSpectrumVisualizerEnabled: Bool {
        get { return mmkv?.bool(forKey: KEY_SPECTRUM_VISUALIZER_ENABLED, defaultValue: false) ?? false }
        set { mmkv?.set(newValue, forKey: KEY_SPECTRUM_VISUALIZER_ENABLED) }
    }
    
    // MARK: - Playback State
    
    func saveQueue(_ queue: [Track], context: PlaybackContext?) {
        guard !pendingPlaybackRestore else { return }
        let dicts = queue.map { $0.dictionaryRepresentation }
        do {
            let tracks = try dicts.map { dict -> String in
                let data = try JSONSerialization.data(withJSONObject: dict)
                return String(decoding: data, as: UTF8.self)
            }
            let snapshot: [String: Any] = [
                "version": 1,
                "tracks": tracks,
                "context": queue.isEmpty ? NSNull() : (context?.dictionary as Any? ?? NSNull()),
            ]
            let data = try JSONSerialization.data(withJSONObject: snapshot, options: [])
            mmkv?.set(data, forKey: KEY_SAVED_QUEUE)
        } catch {
             print("Failed to save queue: \(error)")
        }
    }
    
    private func readQueueSnapshot() -> Any? {
        guard let data = mmkv?.data(forKey: KEY_SAVED_QUEUE) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    func getSavedQueue() -> [Track] {
        let raw = readQueueSnapshot()
        let entries = (raw as? [String: Any])?["tracks"] as? [Any] ?? raw as? [Any] ?? []
        return entries.compactMap { entry in
            if let dict = entry as? [String: Any] { return Track(dictionary: dict) }
            guard let encoded = entry as? String,
                  let dict = (try? JSONSerialization.jsonObject(with: Data(encoded.utf8))) as? [String: Any] else { return nil }
            return Track(dictionary: dict)
        }
    }

    func getPlaybackContext() -> PlaybackContext? {
        guard let raw = readQueueSnapshot() as? [String: Any],
              let context = raw["context"] as? [String: String],
              let mode = context["mode"], ["music", "podcast"].contains(mode),
              let data = try? JSONSerialization.data(withJSONObject: context),
              let decoded = try? JSONDecoder().decode(PlaybackContext.self, from: data),
              !decoded.id.isEmpty else { return nil }
        return decoded
    }

    func savePosition(index: Int, positionSec: Double) {
        guard !pendingPlaybackRestore else { return }
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
        guard !pendingPlaybackRestore else { return }
        mmkv?.set(Int32(mode), forKey: KEY_SAVED_REPEAT_MODE)
    }
    
    func getSavedRepeatMode() -> Int {
        return Int(mmkv?.int32(forKey: KEY_SAVED_REPEAT_MODE, defaultValue: 0) ?? 0)
    }
    
    func saveShuffleMode(_ enabled: Bool) {
        guard !pendingPlaybackRestore else { return }
        mmkv?.set(enabled, forKey: KEY_SAVED_SHUFFLE_MODE)
    }
    
    func getSavedShuffleMode() -> Bool {
        return mmkv?.bool(forKey: KEY_SAVED_SHUFFLE_MODE, defaultValue: false) ?? false
    }

    func exportConfig() -> [String: Any] {
        let savedData = mmkv?.data(forKey: KEY_SAVED_QUEUE)
        return [
            KEY_SAVED_QUEUE: savedData.flatMap { String(data: $0, encoding: .utf8) } ?? "[]",
            KEY_SAVED_INDEX: getSavedIndex(),
            KEY_SAVED_POSITION: getSavedPosition() * 1000,
            KEY_SAVED_REPEAT_MODE: getSavedRepeatMode(),
            KEY_SAVED_SHUFFLE_MODE: getSavedShuffleMode(),
            KEY_RESTORE_ENABLED: isRestoreEnabled,
            KEY_AUTOPLAY_ENABLED: isAutoplayOnStartEnabled,
            KEY_LOUDNESS_ENABLED: isLoudnessNormalizationEnabled,
        ]
    }

    func importConfig(_ data: [String: Any]) {
        pendingPlaybackRestore = false
        let queue = data[KEY_SAVED_QUEUE] as? String ?? "[]"
        mmkv?.set(Data(queue.utf8), forKey: KEY_SAVED_QUEUE)
        savePosition(index: (data[KEY_SAVED_INDEX] as? NSNumber)?.intValue ?? -1,
                     positionSec: ((data[KEY_SAVED_POSITION] as? NSNumber)?.doubleValue ?? 0) / 1000)
        saveRepeatMode((data[KEY_SAVED_REPEAT_MODE] as? NSNumber)?.intValue ?? 0)
        saveShuffleMode(data[KEY_SAVED_SHUFFLE_MODE] as? Bool ?? false)
        if let value = data[KEY_RESTORE_ENABLED] as? Bool { isRestoreEnabled = value }
        if let value = data[KEY_AUTOPLAY_ENABLED] as? Bool { isAutoplayOnStartEnabled = value }
        if let value = data[KEY_LOUDNESS_ENABLED] as? Bool { isLoudnessNormalizationEnabled = value }
        pendingPlaybackRestore = true
    }
}

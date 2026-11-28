import Foundation

/// The listener's audio quality choice. The raw values are the names JS and Android use.
enum AudioQualityPreference: String, CaseIterable {
    case low, standard, high, hires, dolby

    /// Nothing saved yet, or a value this version doesn't know, means 高品, as on Android.
    static func normalize(_ value: String?) -> AudioQualityPreference {
        return value.flatMap { AudioQualityPreference(rawValue: $0) } ?? .high
    }

    /// The AAC stream asked for. Hi-Res and Dolby settle for 高品 when a video lacks them.
    var aacStreamId: Int {
        switch self {
        case .low: return AudioStreamId.low
        case .standard: return AudioStreamId.standard
        case .high, .hires, .dolby: return AudioStreamId.high
        }
    }
}

/// Bilibili's ids for its audio streams.
enum AudioStreamId {
    static let low = 30216
    static let standard = 30232
    static let high = 30280
    static let dolby = 30250
    static let hires = 30251
}

/// What a load ended up playing. The raw values are what JS expects.
enum AudioQualityKind: String {
    case dolby, hires, normal, durl, local, unknown
}

/// Why a load plays something other than the choice, when the panel should say more than
/// "this video has nothing better".
enum AudioQualityFallbackReason: String {
    /// The spectrum's tap needs the MP4, which comes in one quality.
    case spectrum
}

/// What the quality panel shows about the current track.
struct AudioQualityInfo {
    /// The choice the stream was looked up with. The track keeps it until it is looked up again.
    let preferredQuality: AudioQualityPreference
    let actualKind: AudioQualityKind
    var actualStreamId: Int? = nil
    var codecs: String? = nil
    /// In bits per second.
    var bandwidth: Int? = nil
    var isFromDownloadCache = false
    /// What the video offers, whether or not this device can play it. Empty when unknown.
    var availableQualities: [AudioQualityPreference] = []
    var fallbackReason: AudioQualityFallbackReason? = nil

    /// Android's rule: less than what was asked for is a fallback, a better AAC stream is not.
    var isFallback: Bool {
        if actualKind == .unknown || actualKind == .local { return false }
        if preferredQuality == .dolby { return actualKind != .dolby }
        if preferredQuality == .hires { return actualKind != .hires }
        if actualKind == .dolby || actualKind == .hires { return false }
        if actualKind != .normal { return true }
        return (actualStreamId ?? 0) < preferredQuality.aacStreamId
    }

    /// The same load before AVPlayer has accepted its stream.
    var unconfirmed: AudioQualityInfo {
        return AudioQualityInfo(preferredQuality: preferredQuality, actualKind: .unknown)
    }

    var dictionary: [String: Any] {
        var values: [String: Any] = [
            "preferredQuality": preferredQuality.rawValue,
            "actualKind": actualKind.rawValue,
            "actualStreamId": actualStreamId ?? NSNull(),
            "codecs": codecs ?? NSNull(),
            "bandwidth": bandwidth ?? NSNull(),
            "isFallback": isFallback,
            "isFromDownloadCache": isFromDownloadCache,
            "availableQualities": availableQualities.map(\.rawValue),
        ]
        // Optional in JS, so it is left out rather than sent as null.
        if let fallbackReason = fallbackReason {
            values["fallbackReason"] = fallbackReason.rawValue
        }
        return values
    }
}

/// One audio stream from a playurl answer, as far as choosing between them goes.
struct AudioStreamCandidate<Stream> {
    let stream: Stream
    let id: Int
    /// Only a stream with a `segment_base` can be played through the generated HLS playlist.
    let playable: Bool
}

enum AudioStreamChooser {
    /// Picks the stream for `preference` the way Android does: Dolby when asked for and offered,
    /// then Hi-Res, then the AAC stream with the asked id, else the best one below it, else the
    /// lowest one. Here a stream must also be playable, so a Dolby or Hi-Res stream without a
    /// `segment_base` gives way to the next choice. Nil means no AAC stream is playable either.
    static func choose<Stream>(_ preference: AudioQualityPreference,
                               aac: [AudioStreamCandidate<Stream>],
                               hiRes: AudioStreamCandidate<Stream>?,
                               dolby: [AudioStreamCandidate<Stream>]) -> (candidate: AudioStreamCandidate<Stream>, kind: AudioQualityKind)? {
        if preference == .dolby, let stream = dolby.first(where: { $0.playable }) {
            return (stream, .dolby)
        }
        if preference == .hires || preference == .dolby, let stream = hiRes, stream.playable {
            return (stream, .hires)
        }
        let playable = aac.filter { $0.playable }
        let target = preference.aacStreamId
        let chosen = playable.first { $0.id == target }
            ?? playable.filter { $0.id <= target }.max { $0.id < $1.id }
            ?? playable.min { $0.id < $1.id }
        return chosen.map { ($0, .normal) }
    }

    /// The qualities a playurl answer offers. Playability is left out on purpose: the panel then
    /// still lists a quality the device fails to play, which tells the two cases apart.
    static func offeredQualities(aacIds: [Int], hasHiRes: Bool, hasDolby: Bool) -> [AudioQualityPreference] {
        var qualities: [AudioQualityPreference] = []
        if aacIds.contains(AudioStreamId.low) { qualities.append(.low) }
        if aacIds.contains(AudioStreamId.standard) { qualities.append(.standard) }
        if aacIds.contains(AudioStreamId.high) { qualities.append(.high) }
        if hasHiRes { qualities.append(.hires) }
        if hasDolby { qualities.append(.dolby) }
        return qualities
    }
}

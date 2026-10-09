import Foundation

/// 与 Android 相同：累计连续播放的媒体时间，seek 不计入时长。
final class PlaybackHistoryTracker {
    struct Summary {
        let startedAt: Double
        let playedSeconds: Double
        let completed: Bool
        var dictionary: [String: Any] {
            ["startedAt": startedAt, "playedSeconds": playedSeconds, "completed": completed]
        }
    }
    private(set) var trackId: String?
    private var startedAt = 0.0
    private var lastPosition = 0.0
    private var wasPlaying = false
    private var playedSeconds = 0.0
    private var roundSeconds = 0.0
    private var completed = false
    private var hadAbLoop = false
    private var range: (start: Double, end: Double)?

    func begin(id: String, position: Double, now: Double = Date().timeIntervalSince1970 * 1000) {
        trackId = id
        startedAt = now
        lastPosition = position.isFinite ? position : 0
        wasPlaying = false
        playedSeconds = 0
        roundSeconds = 0
        completed = false
        hadAbLoop = false
        range = nil
    }

    func sample(position: Double, isPlaying: Bool, duration: Double) {
        guard trackId != nil, position.isFinite else { return }
        let start = range?.start ?? 0
        let end = range?.end ?? duration
        if wasPlaying && position >= lastPosition {
            let knownEnd = end.isFinite && end > start
            let delta = knownEnd ? max(0, min(position, end) - max(lastPosition, start)) : max(0, position - lastPosition)
            playedSeconds += delta
            roundSeconds += delta
            if knownEnd {
                let length = end - start
                if roundSeconds + 1e-6 >= max(length * 0.9, length - 2) { completed = true }
            }
        }
        lastPosition = position
        wasPlaying = isPlaying
    }

    func setLoop(start: Double?, end: Double?) {
        if range?.start == start && range?.end == end { return }
        if let start = start, let end = end {
            range = (start, end)
            hadAbLoop = true
        } else { range = nil }
        roundSeconds = 0
    }

    func jump(oldPosition: Double, newPosition: Double, isPlaying: Bool, duration: Double) {
        sample(position: oldPosition, isPlaying: isPlaying, duration: duration)
        roundSeconds = 0
        lastPosition = newPosition
        wasPlaying = isPlaying
    }

    func finish() -> Summary? {
        let result = trackId != nil && hadAbLoop ? Summary(startedAt: startedAt, playedSeconds: playedSeconds, completed: completed) : nil
        trackId = nil
        wasPlaying = false
        return result
    }
}

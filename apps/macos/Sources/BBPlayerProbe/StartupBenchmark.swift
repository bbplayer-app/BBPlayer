import Foundation
import BBPlayerCore

private actor BenchmarkURLProvider: MediaSourceProvider {
    let url: URL
    init(_ url: URL) { self.url = url }
    func search(_ query: String, page: Int) async throws -> [Track] { [] }
    func resolve(_ track: Track) async throws -> ResolvedAudio { ResolvedAudio(track: track, url: url) }
}
enum StartupBenchmark {
    @MainActor static func run(input: String, api: BilibiliClient, arguments: [String]) async throws {
        let runs = arguments.firstIndex(of: "--runs").flatMap { $0 + 1 < arguments.count ? Int(arguments[$0 + 1]) : nil } ?? 3
        let track: Track
        let provider: any MediaSourceProvider
        if let url = URL(string: input), ["http", "https"].contains(url.scheme) {
            provider = BenchmarkURLProvider(url); track = Track(bvid: "benchmark", title: "Benchmark", duration: 600)
        } else { provider = api; track = try await api.video(bvid: input) }
        if arguments.contains("--inspect-audio") {
            let source = try await provider.resolve(track)
            let head = try await HTTPRange.fetch(url: source.url, headers: source.headers, offset: 0, length: 65536)
            var offset = 0
            while offset + 8 <= head.data.count {
                let size = head.data[offset..<offset+4].reduce(UInt64(0)) { $0 * 256 + UInt64($1) }
                let type = String(decoding: head.data[offset+4..<offset+8], as: UTF8.self)
                print("box", offset, size, type)
                if size < 8 || size > UInt64(head.data.count - offset) { break }
                offset += Int(size)
            }
            print("total", head.total, "bitrate", source.streamInfo?.bitrate ?? 0)
            return
        }
        let previous: Track?
        if let at = arguments.firstIndex(of: "--switch-from"), at + 1 < arguments.count { previous = try await api.video(bvid: arguments[at + 1]) }
        else { previous = nil }
        var records: [[String: Any]] = []
        for run in 0..<runs {
            let root = FileManager.default.temporaryDirectory.appendingPathComponent("bbplayer-startup-\(UUID().uuidString)")
            let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
            let engine = NativePlaybackEngine(provider: provider, database: db, cache: cache, restore: false)
            engine.preferences.volume = 0
            engine.visualizerVisible = arguments.contains("--visualizer")
            engine.preferences.prefetchNextTrack = !arguments.contains("--no-prefetch")
            if let previous {
                engine.setQueue([previous, track])
                let warmup = ProcessInfo.processInfo.systemUptime
                while engine.renderPosition < 0.55 && engine.errorMessage == nil && ProcessInfo.processInfo.systemUptime - warmup < 30 { try await Task.sleep(for: .milliseconds(20)) }
                if !arguments.contains("--no-prefetch") { try await Task.sleep(for: .seconds(4)) }
            }
            let start = ProcessInfo.processInfo.systemUptime
            if previous != nil { engine.next() } else { engine.setQueue([track]) }
            var advancing: Double?
            var confirmed = false
            while ProcessInfo.processInfo.systemUptime - start < 30 {
                try await Task.sleep(for: .milliseconds(20))
                if engine.renderPosition >= 0.05 && advancing == nil { advancing = ProcessInfo.processInfo.systemUptime - start }
                if engine.renderPosition >= 0.55 { confirmed = true; break }
                if engine.errorMessage != nil { break }
            }
            let timing = engine.startupTiming
            var record: [String: Any] = ["run": run + 1, "confirmedClockAdvance": confirmed]
            record["operation"] = previous == nil ? "cold" : "switch"
            record["sourceReady"] = timing.sourceReady; record["firstByte"] = timing.firstByte
            record["firstDelivery"] = timing.firstDelivery; record["itemReady"] = timing.itemReady
            record["clockAdvance"] = advancing; record["error"] = engine.errorMessage
            record["diagnostics"] = engine.diagnostics
            record["capturedFrames"] = engine.capturedFrames
            record["spectrumPeak"] = engine.spectrum.max() ?? 0
            records.append(record)
            print(String(decoding: try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]), as: UTF8.self))
            engine.shutdown()
            try? FileManager.default.removeItem(at: root)
        }
        if let at = arguments.firstIndex(of: "--output"), at + 1 < arguments.count {
            try JSONSerialization.data(withJSONObject: records, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: arguments[at + 1]))
        }
    }
}

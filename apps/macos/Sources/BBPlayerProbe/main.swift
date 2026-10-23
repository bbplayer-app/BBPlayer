import Foundation
import AVFoundation
import CoreVideo
import BBPlayerCore

@main struct Probe {
    @MainActor static func main() async {
        do {
            let arguments = CommandLine.arguments
            if let index = arguments.firstIndex(of: "--seed-lyrics"), index + 3 < arguments.count {
                let root = URL(fileURLWithPath: arguments[index + 1]), file = URL(fileURLWithPath: arguments[index + 2])
                let raw = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as? [String: Any] ?? [:]
                guard let bvid = MediaLink.bvid(in: raw["id"] as? String ?? ""), let cid = Int64(arguments[index + 3]) else { throw APIError.invalidResponse }
                let document = LyricsParser.parse(raw["lrc"] as? String ?? "", translation: raw["tlyric"] as? String, romanization: raw["romalrc"] as? String, source: "repository-fixture")
                let db = try LibraryDatabase(url: root.appendingPathComponent("library.sqlite"))
                try db.saveLyrics(document, trackID: Track(bvid: bvid, cid: cid, title: "").id)
                print("Seeded real repository lyric fixture: \(document.lines.count) lines"); return
            }
            if let index = arguments.firstIndex(of: "--video-file"), index + 1 < arguments.count {
                let asset = AVURLAsset(url: URL(fileURLWithPath: arguments[index + 1]))
                let tracks = try await asset.loadTracks(withMediaType: .video)
                guard let track = tracks.first else { throw APIError.invalidResponse }
                let reader = try AVAssetReader(asset: asset)
                let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
                reader.add(output)
                guard reader.startReading(), let sample = output.copyNextSampleBuffer(), let image = CMSampleBufferGetImageBuffer(sample) else { throw APIError.invalidResponse }
                print("Native video decoded frame: \(CVPixelBufferGetWidth(image))x\(CVPixelBufferGetHeight(image))")
                reader.cancelReading(); return
            }
            let api = BilibiliClient()
            if let index = arguments.firstIndex(of: "--danmaku"), index + 1 < arguments.count, let cid = Int64(arguments[index + 1]) {
                let comments = try await api.danmaku(cid: cid, segment: 1)
                print("Public danmaku decoded: \(comments.count) scrolling comments; timestamps \(comments.first?.time ?? 0)...\(comments.last?.time ?? 0)")
                return
            }
            if arguments.contains("--services") {
                let search = try await api.search("孤独摇滚", page: 1)
                print("Bilibili keyword search: \(search.count) results")
                let music = ExternalMusicService()
                for source in ["netease", "qqmusic", "kugou"] {
                    do { let candidates = try await music.searchLyrics("青い春と西の空", source: source); print("Lyrics \(source): \(candidates.count) candidates"); if let first = candidates.first { let doc = try await music.lyrics(first); print("Lyric document: \(doc.lines.count) lines") } }
                    catch { print("Lyrics \(source) failed: \(error.localizedDescription)") }
                }
                let (title, songs) = try await music.fetchPlaylist(input: "3778678", source: "netease")
                print("NetEase playlist: \(title), \(songs.count) songs")
                let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
                defer { try? FileManager.default.removeItem(at: root) }
                let db = try LibraryDatabase(url: root.appendingPathComponent("db"))
                let themes = try ThemeManager(root: root.appendingPathComponent("themes"), api: api, database: db)
                let results = try await themes.search("初音未来")
                print("Theme catalog: \(results.count) results")
                if arguments.contains("--install-theme"), let item = results.first(where: { $0.kind == "suit" }) ?? results.first {
                    try await themes.install(item)
                    if let theme = themes.active {
                        let output = URL(fileURLWithPath: "/tmp/bbplayer-validation/theme", isDirectory: true)
                        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
                        for asset in theme.assets { let file = theme.root.appendingPathComponent(asset.filename), destination = output.appendingPathComponent(asset.filename); if !FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.copyItem(at: file, to: destination) } }
                        print("Installed real theme: \(theme.name), \(theme.assets.count) assets, roles \(Set(theme.assets.map(\.role)).sorted())")
                        try JSONEncoder().encode(theme).write(to: output.appendingPathComponent("source-manifest.json"))
                    }
                }
                return
            }
            let input = arguments.dropFirst().first ?? "BV1Zu411x7mc"
            let track = try await api.video(bvid: input)
            if arguments.contains("--download-offline") {
                let root = FileManager.default.temporaryDirectory.appendingPathComponent("bbplayer-offline-\(UUID().uuidString)")
                defer { try? FileManager.default.removeItem(at: root) }
                let db = try LibraryDatabase(url: root.appendingPathComponent("library.sqlite"))
                let downloads = try DownloadManager(root: root.appendingPathComponent("downloads"), provider: api, database: db)
                downloads.add(track)
                for _ in 0..<240 {
                    try await Task.sleep(for: .milliseconds(250))
                    if downloads.jobs.first?.status == .completed || downloads.jobs.first?.status == .failed { break }
                }
                guard downloads.jobs.first?.status == .completed else { throw APIError.unavailable(downloads.jobs.first?.error ?? "Download did not complete") }
                let offline = OfflineOnlyProvider()
                let cache = try AudioCache(root: root.appendingPathComponent("cache"))
                let engine = NativePlaybackEngine(provider: offline, database: db, cache: cache, restore: false)
                engine.preferences.volume = 0; engine.visualizerVisible = true; engine.setQueue([track])
                var peak: Float = 0
                for _ in 0..<60 {
                    try await Task.sleep(for: .milliseconds(100)); peak = max(peak, engine.spectrum.max() ?? 0)
                    if engine.position > 1 && peak > 0 { break }
                }
                let frames = engine.capturedFrames, position = engine.position, attempts = await offline.attempts
                engine.shutdown()
                guard frames > 0, position > 1, attempts == 0 else { throw APIError.unavailable("Offline playback failed") }
                print("Real AAC download/offline passed: bytes=\(downloads.jobs.first?.received ?? 0), position=\(position), PCM frames=\(frames), network resolutions=\(attempts)")
                return
            }
            let source = try await api.resolve(track)
            print("Loudness metadata: measured=\(source.measuredLoudness.map(String.init(describing:)) ?? "missing"), gain=\(Loudness.gain(measured: source.measuredLoudness, target: source.targetLoudness ?? -14))")
            print("Resolved AAC: \(source.track.title); content identity \(source.track.id)")
            let chunk = try await HTTPRange.fetch(url: source.url, headers: source.headers, offset: 0, length: 32768)
            print("Range: \(chunk.data.count) bytes; total \(chunk.total)")
            guard arguments.contains("--play") else { return }
            let root = FileManager.default.temporaryDirectory.appendingPathComponent("bbplayer-probe-\(UUID().uuidString)")
            defer { try? FileManager.default.removeItem(at: root) }
            let database = try LibraryDatabase(url: root.appendingPathComponent("probe.sqlite"))
            let cache = try AudioCache(root: root.appendingPathComponent("cache"))
            let engine = NativePlaybackEngine(provider: api, database: database, cache: cache, restore: false)
            engine.preferences.volume = arguments.contains("--audible") ? 0.2 : 0
            engine.visualizerVisible = true
            engine.setQueue([track])
            var peak: Float = 0
            for second in 0..<30 {
                try await Task.sleep(for: .seconds(1))
                peak = max(peak, engine.spectrum.max() ?? 0)
                print("t=\(second) loading=\(engine.isLoading) playing=\(engine.isPlaying) position=\(engine.position) frames=\(engine.capturedFrames) error=\(engine.errorMessage ?? "none")")
                if second == 15 { engine.seek(to: 45) }
            }
            let frames = engine.capturedFrames
            engine.shutdown()
            print("Peak real spectrum: \(peak)")
            guard frames > 0 && peak > 0 else { throw APIError.unavailable("Real PCM tap did not receive frames") }
        } catch { fputs("Probe failed: \(error.localizedDescription)\n", stderr); exit(1) }
    }
}

private actor OfflineOnlyProvider: MediaSourceProvider {
    private(set) var attempts = 0
    func search(_ query: String, page: Int) async throws -> [Track] { throw APIError.network("Offline test") }
    func resolve(_ track: Track) async throws -> ResolvedAudio { attempts += 1; throw APIError.network("Offline test") }
}

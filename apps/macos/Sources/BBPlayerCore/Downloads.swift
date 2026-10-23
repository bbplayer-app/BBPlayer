import Foundation
import Observation

public enum DownloadStatus: String, Codable, Sendable { case queued, downloading, paused, completed, failed }
public struct DownloadJob: Codable, Identifiable, Sendable {
    public var id: String { track.id }
    public var track: Track
    public var status: DownloadStatus = .queued
    public var received: Int64 = 0
    public var total: Int64 = 0
    public var metadata: OfflineAudioMetadata?
    public var canonicalID: String?
    public var remotePath: String?
    public var error: String?
    public var fraction: Double { total > 0 ? Double(received) / Double(total) : 0 }
    public init(track: Track) { self.track = track }
}

@MainActor @Observable public final class DownloadManager {
    public private(set) var jobs: [DownloadJob] = []
    public private(set) var errorMessage: String?
    @ObservationIgnored private let root: URL
    @ObservationIgnored private let provider: any MediaSourceProvider
    @ObservationIgnored private let database: LibraryDatabase
    @ObservationIgnored private var tasks: [String: Task<Void, Never>] = [:]
    public init(root: URL, provider: any MediaSourceProvider, database: LibraryDatabase) throws {
        self.root = root; self.provider = provider; self.database = database
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        jobs = (try database.state([DownloadJob].self, key: "downloads")) ?? []
        for index in jobs.indices {
            let destination = file(jobs[index].id, ext: "m4a")
            if FileManager.default.fileExists(atPath: destination.path), jobs[index].total > 0,
               Int64((try destination.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) == jobs[index].total {
                jobs[index].status = .completed
                for id in Set([jobs[index].id, jobs[index].canonicalID].compactMap({ $0 })) {
                    try database.saveState(destination, key: "download-file:" + id)
                    if let metadata = jobs[index].metadata { try database.saveState(metadata, key: "download-metadata:" + id) }
                }
            } else if jobs[index].status == .downloading || jobs[index].status == .queued || jobs[index].status == .completed { jobs[index].status = .paused }
        }
        persist()
    }
    public func add(_ track: Track) {
        add([track])
    }
    public func add(_ tracks: [Track]) {
        var seen = Set(jobs.map(\.id))
        let additions = tracks.filter { seen.insert($0.id).inserted }
        guard !additions.isEmpty else { return }
        jobs.append(contentsOf: additions.map { DownloadJob(track: $0) }); persist(); schedule()
    }
    public func pause(_ id: String) {
        guard let index = jobs.firstIndex(where: { $0.id == id }) else { return }
        jobs[index].status = .paused; tasks[id]?.cancel(); persist()
    }
    public func resume(_ id: String) {
        guard let index = jobs.firstIndex(where: { $0.id == id }), jobs[index].status != .completed, tasks[id] == nil else { return }
        jobs[index].status = .queued; jobs[index].error = nil; persist(); schedule()
    }
    public func remove(_ id: String) {
        tasks[id]?.cancel()
        guard let job = jobs.first(where: { $0.id == id }) else { return }
        do {
            for ext in ["part", "m4a"] { let url = file(id, ext: ext); if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) } }
            for keyID in Set([job.track.id, job.canonicalID].compactMap({ $0 })) {
                try database.removeState(key: "download-file:" + keyID)
                try database.removeState(key: "download-metadata:" + keyID)
            }
            jobs.removeAll { $0.id == id }; persist()
        } catch { errorMessage = "删除下载失败：\(error.localizedDescription)" }
    }
    public func pauseAll() { for job in jobs where job.status == .downloading || job.status == .queued { pause(job.id) } }
    public func localURL(for track: Track) -> URL? {
        let url = file(track.id, ext: "m4a")
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }
    private func file(_ id: String, ext: String) -> URL { root.appendingPathComponent(WBI.md5(Data(id.utf8)) + "." + ext) }
    private func persist() { do { try database.saveState(jobs, key: "downloads") } catch { errorMessage = "保存下载任务失败：\(error.localizedDescription)" } }
    private func schedule() {
        for job in jobs where tasks.count < 2 && job.status == .queued && tasks[job.id] == nil {
            let id = job.id
            tasks[id] = Task { [weak self] in
                guard let self else { return }
                defer { tasks.removeValue(forKey: id); schedule() }
                do {
                    guard let index = jobs.firstIndex(where: { $0.id == id }) else { return }
                    jobs[index].status = .downloading
                    let source = try await provider.resolve(job.track)
                    try Task.checkCancellation()
                    guard let index = jobs.firstIndex(where: { $0.id == id }) else { return }
                    let partial = file(id, ext: "part")
                    if jobs[index].remotePath != source.url.path {
                        if FileManager.default.fileExists(atPath: partial.path) { try FileManager.default.removeItem(at: partial) }
                        jobs[index].received = 0
                    }
                    jobs[index].remotePath = source.url.path
                    jobs[index].canonicalID = source.track.id
                    jobs[index].metadata = OfflineAudioMetadata(source: source)
                    if !FileManager.default.fileExists(atPath: partial.path) { FileManager.default.createFile(atPath: partial.path, contents: nil) }
                    let handle = try FileHandle(forWritingTo: partial)
                    defer { try? handle.close() }
                    var received = Int64(try handle.seekToEnd())
                    while jobs[index].total <= 0 || received < jobs[index].total {
                        try Task.checkCancellation()
                        guard let index = jobs.firstIndex(where: { $0.id == id }) else { return }
                        let chunk = try await HTTPRange.fetch(url: source.url, headers: source.headers, offset: received, length: 262_144)
                        try Task.checkCancellation()
                        try handle.write(contentsOf: chunk.data)
                        try handle.synchronize()
                        received += Int64(chunk.data.count)
                        jobs[index].received = received; jobs[index].total = chunk.total; persist()
                        if received >= chunk.total { break }
                    }
                    try Task.checkCancellation()
                    guard let index = jobs.firstIndex(where: { $0.id == id }) else { return }
                    let destination = file(id, ext: "m4a")
                    if FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.removeItem(at: destination) }
                    try FileManager.default.moveItem(at: partial, to: destination)
                    try database.saveState(destination, key: "download-file:" + id)
                    try database.saveState(destination, key: "download-file:" + source.track.id)
                    let metadata = OfflineAudioMetadata(source: source)
                    try database.saveState(metadata, key: "download-metadata:" + id)
                    try database.saveState(metadata, key: "download-metadata:" + source.track.id)
                    jobs[index].status = .completed; jobs[index].error = nil; persist()
                } catch is CancellationError { persist() }
                catch {
                    if let index = jobs.firstIndex(where: { $0.id == id }), jobs[index].status != .paused {
                        jobs[index].status = .failed; jobs[index].error = error.localizedDescription
                    }
                    persist()
                }
            }
        }
    }
}

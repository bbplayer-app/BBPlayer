import Foundation
import ExpoModulesCore
import MMKV

class OrpheusDownloadManager: NSObject, URLSessionDownloadDelegate {
    static let shared = OrpheusDownloadManager()
    
    private let stateQueue = DispatchQueue(label: "com.orpheus.download.state")
    
    private var urlSession: URLSession!
    private var downloadTasks: [String: DownloadState] = [:] // Map taskID/url to state
    private var activeTasks: [String: URLSessionDownloadTask] = [:] // Map ID to task
    private var trackMap: [String: Track] = [:] // Map ID to Track metadata
    private var pendingIds: [String] = [] // Tasks waiting for a free slot, oldest first
    private var resolvingTokens: [String: UUID] = [:] // Tasks holding a slot while their URL is resolved, one token per attempt
    private var maxParallelTasks = 1
    var onDownloadUpdated: ((DownloadTask) -> Void)?
    
    override init() {
        super.init()
        let config = URLSessionConfiguration.background(withIdentifier: "com.orpheus.download")
        config.isDiscretionary = false
        config.sessionSendsLaunchEvents = true
        urlSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        
        restoreTasks()
    }
    
    func downloadTrack(track: Track) {
        multiDownload(tracks: [track])
    }

    func multiDownload(tracks: [Track]) {
        let queued: [Track] = stateQueue.sync {
            var queued: [Track] = []
            for track in tracks where canQueueLocked(id: track.id) {
                trackMap[track.id] = track
                downloadTasks[track.id] = .queued
                pendingIds.append(track.id)
                queued.append(track)
            }
            saveTasksLocked()
            return queued
        }

        for track in queued {
            notifyUpdate(id: track.id, state: .queued, track: track)
        }
        startPendingDownloads()
    }

    func setMaxParallelTasks(_ count: Int) {
        stateQueue.sync { maxParallelTasks = max(count, 1) }
        startPendingDownloads()
    }

    private func canQueueLocked(id: String) -> Bool {
        if activeTasks[id] != nil || resolvingTokens[id] != nil || pendingIds.contains(id) {
            return false
        }
        return downloadTasks[id] != .completed || getDownloadedFileUrl(id: id) == nil
    }

    /// Fills free slots in order, so a URL is resolved only when its download can start.
    private func startPendingDownloads() {
        let starts: [(track: Track, token: UUID)] = stateQueue.sync {
            var starts: [(track: Track, token: UUID)] = []
            while activeTasks.count + resolvingTokens.count < maxParallelTasks, !pendingIds.isEmpty {
                let id = pendingIds.removeFirst()
                guard let track = trackMap[id] else { continue }
                let token = UUID()
                resolvingTokens[id] = token
                starts.append((track, token))
            }
            return starts
        }

        for (track, token) in starts {
            if isBilibili(track) {
                resolveAndDownload(track: track, token: token)
            } else {
                startDownload(url: track.url, track: track, token: token)
            }
        }
    }

    /// Ends a resolve attempt, unless its task was removed or queued again since it began.
    private func finishResolvingLocked(id: String, token: UUID) -> Bool {
        guard resolvingTokens[id] == token else { return false }
        resolvingTokens.removeValue(forKey: id)
        return true
    }

    private func isBilibili(_ track: Track) -> Bool {
        return track.url.starts(with: "orpheus://bilibili")
    }

    func resumeDownload(id: String) {
        guard let track = stateQueue.sync(execute: { trackMap[id] }) else { return }
        downloadTrack(track: track)
    }
    
    private func resolveAndDownload(track: Track, token: UUID) {
        guard let queryItems = URLComponents(string: track.url)?.queryItems,
              let bvid = queryItems.first(where: { $0.name == "bvid" })?.value else {
            failDownload(track: track, token: token, reason: "no bvid in \(track.url)")
            return
        }

        if let cid = queryItems.first(where: { $0.name == "cid" })?.value {
            resolvePlayUrl(bvid: bvid, cid: cid, track: track, token: token)
            return
        }

        // Single-part videos are addressed by bvid alone, so their cid has to be looked up.
        BilibiliApi.shared.getPageList(bvid: bvid) { [weak self] result in
            switch result {
            case .success(let cid):
                self?.resolvePlayUrl(bvid: bvid, cid: String(cid), track: track, token: token)
            case .failure(let error):
                self?.failDownload(track: track, token: token, reason: error.localizedDescription)
            }
        }
    }

    private func resolvePlayUrl(bvid: String, cid: String, track: Track, token: UUID) {
        BilibiliApi.shared.getPlayStream(bvid: bvid, cid: cid) { [weak self] result in
            switch result {
            case .success(let stream):
                guard let url = stream.urls.first else {
                    self?.failDownload(track: track, token: token, reason: "no playable stream")
                    return
                }
                self?.startDownload(url: url, track: track, token: token)
            case .failure(let error):
                self?.failDownload(track: track, token: token, reason: error.localizedDescription)
            }
        }
    }

    /// Fails a task that has not reached URLSession yet.
    private func failDownload(track: Track, token: UUID, reason: String) {
        NSLog("[OrpheusDownload] %@ failed: %@", track.id, reason)

        let failed: Bool = stateQueue.sync {
            guard finishResolvingLocked(id: track.id, token: token) else { return false }
            downloadTasks[track.id] = .failed
            saveTasksLocked()
            return true
        }

        if failed {
            notifyUpdate(id: track.id, state: .failed, track: track)
        }
        startPendingDownloads()
    }

    private func notifyUpdate(id: String, state: DownloadState, track: Track?, bytesDownloaded: Int64 = 0, contentLength: Int64 = 0) {
        let task = DownloadTask()
        task.id = id
        task.state = state
        task.track = track
        task.bytesDownloaded = Double(bytesDownloaded)
        task.contentLength = Double(contentLength)

        if state == .completed {
            task.percentDownloaded = 1.0
        } else if contentLength > 0 {
            task.percentDownloaded = Double(bytesDownloaded) / Double(contentLength)
        }

        onDownloadUpdated?(task)
    }

    private func startDownload(url: String, track: Track, token: UUID) {
        guard let nsUrl = URL(string: url) else {
            failDownload(track: track, token: token, reason: "invalid URL \(url)")
            return
        }

        var request = URLRequest(url: nsUrl)
        if isBilibili(track) {
            request.setValue("https://www.bilibili.com/", forHTTPHeaderField: "Referer")
            request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
        }

        let started: Bool = stateQueue.sync {
            guard finishResolvingLocked(id: track.id, token: token) else { return false }

            let task = urlSession.downloadTask(with: request)
            task.taskDescription = track.id

            activeTasks[track.id] = task
            downloadTasks[track.id] = .downloading

            task.resume()

            saveTasksLocked()
            return true
        }

        if started {
            notifyUpdate(id: track.id, state: .downloading, track: track)
        }
    }

    func removeDownload(id: String) {
        stateQueue.sync {
            if let task = activeTasks[id] {
                task.cancel()
                activeTasks.removeValue(forKey: id)
            }
            
            let fileManager = FileManager.default
            let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
            let dest = docs.appendingPathComponent("downloads/\(id).mp4")
            try? fileManager.removeItem(at: dest)
            
            pendingIds.removeAll { $0 == id }
            resolvingTokens.removeValue(forKey: id)
            downloadTasks.removeValue(forKey: id)
            trackMap.removeValue(forKey: id)

            saveTasksLocked()
        }
        notifyUpdate(id: id, state: .removing, track: nil)
        startPendingDownloads()
    }
    
    func removeAllDownloads() {
        stateQueue.sync {
            for (_, task) in activeTasks {
                task.cancel()
            }
            activeTasks.removeAll()
            
            let fileManager = FileManager.default
            let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
            let downloadsDir = docs.appendingPathComponent("downloads")
            try? fileManager.removeItem(at: downloadsDir)
            
            pendingIds.removeAll()
            resolvingTokens.removeAll()
            downloadTasks.removeAll()
            trackMap.removeAll()
            
            saveTasksLocked()
        }
    }
    
    // MARK: - Persistence
    
    private let KEY_SAVED_TASKS = "saved_download_tasks"
    
    private struct SavedTrack: Codable {
        let id: String
        let url: String
        let title: String?
        let artist: String?
        let artwork: String?
        let duration: Double?
    }
    
    private struct PersistedTask: Codable {
        let id: String
        let state: Int
        let track: SavedTrack
    }
    
    private func toSavedTrack(_ track: Track) -> SavedTrack {
        return SavedTrack(
            id: track.id,
            url: track.url,
            title: track.title,
            artist: track.artist,
            artwork: track.artwork,
            duration: track.duration
        )
    }
    
    private func fromSavedTrack(_ saved: SavedTrack) -> Track {
        let t = Track()
        t.id = saved.id
        t.url = saved.url
        t.title = saved.title
        t.artist = saved.artist
        t.artwork = saved.artwork
        t.duration = saved.duration
        return t
    }
    
    private func saveTasks() {
        stateQueue.sync {
            saveTasksLocked()
        }
    }
    
    private func saveTasksLocked() {
        let tasksToSave = trackMap.map { (id, track) -> PersistedTask in
            let state = downloadTasks[id] ?? .queued
            return PersistedTask(id: id, state: state.rawValue, track: toSavedTrack(track))
        }
        
        if let data = try? JSONEncoder().encode(tasksToSave) {
            MMKV.default()?.set(data, forKey: KEY_SAVED_TASKS)
        }
    }
    
    private func restoreTasks() {
        guard let data = MMKV.default()?.data(forKey: KEY_SAVED_TASKS),
              let persisted = try? JSONDecoder().decode([PersistedTask].self, from: data) else {
            return
        }
            
        // Initial load (called in init)
        for p in persisted {
            let track = fromSavedTrack(p.track)
            trackMap[p.id] = track
            if let state = DownloadState(rawValue: p.state) {
                downloadTasks[p.id] = state
            }
        }
        
        // Check for existing background tasks first
        urlSession.getAllTasks { [weak self] tasks in
            guard let self = self else { return }
            
            self.stateQueue.sync {
                var runningTaskIds = Set<String>()
                
                for task in tasks {
                    if let dlTask = task as? URLSessionDownloadTask, let id = dlTask.taskDescription {
                        self.activeTasks[id] = dlTask
                        runningTaskIds.insert(id)
                        
                        // Update state to downloading if it was running
                        if dlTask.state == .running {
                            self.downloadTasks[id] = .downloading
                        }
                    }
                }
                
                // Auto-resume downloads that should be running but aren't
                let fileManager = FileManager.default
                let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
                let downloadsDir = docs.appendingPathComponent("downloads")
                
                let tasksSnapshot = self.downloadTasks
                for (id, state) in tasksSnapshot {
                    if (state == .downloading || state == .queued) && !runningTaskIds.contains(id) {
                        let dest = downloadsDir.appendingPathComponent("\(id).mp4")
                        if fileManager.fileExists(atPath: dest.path) {
                            // File exists, mark completed
                            self.downloadTasks[id] = .completed
                        } else {
                             // Not running and file missing -> restart
                             // Ensure we don't have an active task (already checked !runningTaskIds but activeTasks map might differ if logic is buggy, but runningTaskIds comes from session)
                             if self.activeTasks[id] == nil, let track = self.trackMap[id] {
                                 // Restart logic:
                                 // If it's a bilibili link, we need to resolve again which is async.
                                 // We can't do that synchronously inside restoreTasks if we want to hold the lock.
                                 // Dispatch to main to start the full download flow (resolve -> download)
                                 DispatchQueue.main.async {
                                     self.downloadTrack(track: track)
                                 }
                             }
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Delegate
    
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let id = downloadTask.taskDescription else { return }

        // An error response's body also arrives here, as a finished file.
        if let response = downloadTask.response as? HTTPURLResponse,
           !(200..<300).contains(response.statusCode) {
            NSLog("[OrpheusDownload] %@ failed: HTTP %ld", id, response.statusCode)
            markFailed(id: id)
            return
        }

        let fileManager = FileManager.default
        let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        let downloadsDir = docs.appendingPathComponent("downloads")
        
        do {
            try fileManager.createDirectory(at: downloadsDir, withIntermediateDirectories: true)
            // Use mp4 for now. Ideally retain extension from url or metadata.
            let dest = downloadsDir.appendingPathComponent("\(id).mp4")
            
            if fileManager.fileExists(atPath: dest.path) {
                try fileManager.removeItem(at: dest)
            }
            try fileManager.moveItem(at: location, to: dest)
            
            var track: Track?
            stateQueue.sync {
                downloadTasks[id] = .completed
                activeTasks.removeValue(forKey: id)
                saveTasksLocked()
                track = trackMap[id]
            }
            
            if let t = track {
                notifyUpdate(id: id, state: .completed, track: t)
            }
        } catch {
            NSLog("[OrpheusDownload] %@ failed: %@", id, error.localizedDescription)
            markFailed(id: id)
        }
    }

    private func markFailed(id: String) {
        var track: Track?
        stateQueue.sync {
            // Otherwise a retry right after this notice would find the old task still active.
            activeTasks.removeValue(forKey: id)
            downloadTasks[id] = .failed
            saveTasksLocked()
            track = trackMap[id]
        }
        notifyUpdate(id: id, state: .failed, track: track)
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        guard let id = downloadTask.taskDescription, totalBytesExpectedToWrite > 0 else { return }

        // This fires for every chunk received, so only whole percentages are reported.
        let previousPercent = (totalBytesWritten - bytesWritten) * 100 / totalBytesExpectedToWrite
        let percent = totalBytesWritten * 100 / totalBytesExpectedToWrite
        guard percent != previousPercent else { return }

        notifyUpdate(id: id, state: .downloading, track: nil, bytesDownloaded: totalBytesWritten, contentLength: totalBytesExpectedToWrite)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let id = task.taskDescription else { return }

        var failedTrack: Track?
        stateQueue.sync {
            // A newer attempt may already own this id.
            if let current = activeTasks[id], current.taskIdentifier != task.taskIdentifier { return }
            activeTasks.removeValue(forKey: id)

            // Removing a task cancels it, which leaves no state to record.
            guard let error = error, let track = trackMap[id] else { return }
            let cancelled = (error as NSError).code == NSURLErrorCancelled
            downloadTasks[id] = cancelled ? .stopped : .failed
            saveTasksLocked()

            if !cancelled {
                NSLog("[OrpheusDownload] %@ failed: %@", id, error.localizedDescription)
                failedTrack = track
            }
        }

        if let track = failedTrack {
            notifyUpdate(id: id, state: .failed, track: track)
        }
        startPendingDownloads()
    }
    
    func getDownloads() -> [DownloadTask] {
        return stateQueue.sync {
            return trackMap.map { (id, track) -> DownloadTask in
                let task = DownloadTask()
                task.id = id
                task.state = downloadTasks[id] ?? .queued
                task.track = track
                
                if task.state == .completed {
                    task.percentDownloaded = 1.0
                    task.contentLength = 0
                    let fileManager = FileManager.default
                    let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
                    let dest = docs.appendingPathComponent("downloads/\(id).mp4")
                    if let attrs = try? fileManager.attributesOfItem(atPath: dest.path),
                       let size = attrs[.size] as? Double {
                        task.contentLength = size
                        task.bytesDownloaded = size
                    }
                } else if let active = activeTasks[id] {
                    task.bytesDownloaded = Double(active.countOfBytesReceived)
                    task.contentLength = Double(active.countOfBytesExpectedToReceive)
                    task.percentDownloaded = task.contentLength > 0 ? task.bytesDownloaded / task.contentLength : 0
                }
                
                return task
            }
        }
    }
    
    func getDownloadStatusByIds(ids: [String]) -> [String: Int] {
        return stateQueue.sync {
            var result: [String: Int] = [:]
            for id in ids {
                if let state = downloadTasks[id] {
                    result[id] = state.rawValue
                }
            }
            return result
        }
    }
    
    func clearUncompletedTasks() {
        stateQueue.sync {
            // Need to remove tasks physically too
            let idsShouldRemove = downloadTasks.filter { $0.value != .completed }.map { $0.key }
            
            let fileManager = FileManager.default
            let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
            
            for id in idsShouldRemove {
                if let task = activeTasks[id] {
                    task.cancel()
                    activeTasks.removeValue(forKey: id)
                }
                
                let dest = docs.appendingPathComponent("downloads/\(id).mp4")
                try? fileManager.removeItem(at: dest)
                
                downloadTasks.removeValue(forKey: id)
                trackMap.removeValue(forKey: id)
            }

            pendingIds.removeAll()
            resolvingTokens.removeAll()
            saveTasksLocked()
        }
    }
    
    func getUncompletedTasks() -> [DownloadTask] {
        // Safe to call getDownloads() (which syncs) then filter
        return getDownloads().filter { $0.state != .completed }
    }

    func getCompletedTasks() -> [DownloadTask] {
        return getDownloads().filter { $0.state == .completed }
    }
    
    func getDownloadedFileUrl(id: String) -> URL? {
        let fileManager = FileManager.default
        let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dest = docs.appendingPathComponent("downloads/\(id).mp4")
        
        if fileManager.fileExists(atPath: dest.path) {
            return dest
        }
        return nil
    }
}

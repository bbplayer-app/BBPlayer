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
        // Resolve URL if needed (Bilibili logic)
        let urlString = track.url
        if urlString.starts(with: "orpheus://bilibili") {
            resolveAndDownload(track: track)
        } else {
            startDownload(url: urlString, track: track)
        }
    }
    
    private func resolveAndDownload(track: Track) {
        guard let uri = URL(string: track.url),
              let components = URLComponents(url: uri, resolvingAgainstBaseURL: false) else { return }
        
        let bvid = components.queryItems?.first(where: { $0.name == "bvid" })?.value
        let cid = components.queryItems?.first(where: { $0.name == "cid" })?.value
        
        guard let bvid = bvid, let cid = cid else { return }
        
        BilibiliApi.shared.getPlayUrl(bvid: bvid, cid: cid) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let realUrl):
                    self?.startDownload(url: realUrl, track: track)
                case .failure(let error):
                    // No ID available if we failed before starting? Actually track.id is there.
                    self?.notifyUpdate(id: track.id, state: .failed, track: track)
                }
            }
        }
    }
    
    private func notifyUpdate(id: String, state: DownloadState, track: Track?) {
        let task = DownloadTask()
        task.id = id
        task.state = state
        task.track = track
        
        if state == .completed {
            task.percentDownloaded = 1.0
        }
        
        onDownloadUpdated?(task)
    }
    
    private func startDownload(url: String, track: Track) {
        guard let nsUrl = URL(string: url) else { return }
        
        stateQueue.sync {
            var request = URLRequest(url: nsUrl)
            if url.contains("bilivideo.com") {
                 request.setValue("https://www.bilibili.com/", forHTTPHeaderField: "Referer")
                 request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
            }
            
            let task = urlSession.downloadTask(with: request)
            task.taskDescription = track.id
            
            trackMap[track.id] = track
            activeTasks[track.id] = task
            downloadTasks[track.id] = .downloading
            
            task.resume()
            
            saveTasksLocked()
        }
        
        notifyUpdate(id: track.id, state: .downloading, track: track)
    }
    
    // Internal version of startDownload used by restoreTasks within lock
    private func startDownloadLocked(url: String, track: Track) {
        guard let nsUrl = URL(string: url) else { return }
        
        var request = URLRequest(url: nsUrl)
        if url.contains("bilivideo.com") {
             request.setValue("https://www.bilibili.com/", forHTTPHeaderField: "Referer")
             request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
        }
        
        let task = urlSession.downloadTask(with: request)
        task.taskDescription = track.id
        
        trackMap[track.id] = track
        activeTasks[track.id] = task
        downloadTasks[track.id] = .downloading
        
        task.resume()
        saveTasksLocked()
        
        // Notify outside lock? Or via async
        DispatchQueue.main.async {
            self.notifyUpdate(id: track.id, state: .downloading, track: track)
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
            
            downloadTasks.removeValue(forKey: id)
            trackMap.removeValue(forKey: id)
            
            saveTasksLocked()
        }
        notifyUpdate(id: id, state: .removing, track: nil)
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
                    if state == .downloading && !runningTaskIds.contains(id) {
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
            var track: Track?
            stateQueue.sync {
                downloadTasks[id] = .failed
                saveTasksLocked()
                track = trackMap[id]
            }
            notifyUpdate(id: id, state: .failed, track: track)
        }
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let id = task.taskDescription else { return }
        
        if let error = error {
            var track: Track?
            var state: DownloadState = .failed
            
            stateQueue.sync {
                if (error as NSError).code == NSURLErrorCancelled {
                    downloadTasks[id] = .stopped
                    state = .stopped
                } else {
                    downloadTasks[id] = .failed
                    state = .failed
                }
                activeTasks.removeValue(forKey: id)
                saveTasksLocked()
                track = trackMap[id]
            }
            
            if state == .failed {
                notifyUpdate(id: id, state: .failed, track: track)
            }
        }
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
    
    func multiDownload(tracks: [Track]) {
        for track in tracks {
            downloadTrack(track: track)
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
            
            saveTasksLocked()
        }
    }
    
    func getUncompletedTasks() -> [DownloadTask] {
        // Safe to call getDownloads() (which syncs) then filter
        return getDownloads().filter { $0.state != .completed }
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

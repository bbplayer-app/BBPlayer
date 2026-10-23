import AppKit
import BBPlayerCore
import Foundation
import Observation

@MainActor @Observable final class AppModel {
    let database: LibraryDatabase
    let api: BilibiliClient
    let cache: AudioCache
    var player: NativePlaybackEngine
    let downloads: DownloadManager
    var themes: ThemeManager
    let music = ExternalMusicService()
    var section: LibrarySection = .search
    var query = ""
    var searchLocal = false
    var playlistQuery = ""
    var historyDate: Date?
    var historyEvents: [ListeningEvent] = []
    var followedUploader: FollowingProfile?
    var tracks: [Track] = []
    var playlists: [Playlist] = []
    var localPlaylists: [Playlist] = []
    var following: [FollowingProfile] = []
    var profile: BilibiliProfile?
    var openedPlaylist: Playlist?
    var deletedPlaylist: Playlist?
    var page = 1
    var hasMore = false
    var busy = false
    var message: String?
    var lyricMessage: String?
    var showPlayer = false
    var showQueue = false
    var showLogin = false
    var showImport = false
    var showNewPlaylist = false
    var summary: HistorySummary?
    var importJob: ImportJob?
    var importRunning = false
    var themeResults: [ThemeCatalogItem] = []
    var lyricCandidates: [LyricCandidate] = []
    var lyricSource = "netease"
    var mainWindowVisible = true
    var floatingController: FloatingLyricsController?
    var reopenWindow: (() -> Void)?
    @ObservationIgnored private var routeTask: Task<Void, Never>?
    @ObservationIgnored private var lyricTask: Task<Void, Never>?
    @ObservationIgnored private var importTask: Task<Void, Never>?
    @ObservationIgnored private var routeID = UUID()

    init(dataRoot: URL? = nil) throws {
        let root = try dataRoot ?? QAOptions.dataRoot ?? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("com.bbplayer.macos", isDirectory: true)
        database = try LibraryDatabase(url: root.appendingPathComponent("library.sqlite"))
        api = BilibiliClient()
        cache = try AudioCache(root: root.appendingPathComponent("stream-cache"))
        player = NativePlaybackEngine(provider: api, database: database, cache: cache)
        downloads = try DownloadManager(root: root.appendingPathComponent("downloads"), provider: api, database: database)
        themes = try ThemeManager(root: root.appendingPathComponent("themes"), api: api, database: database)
        if QAOptions.enabled, QAOptions.value("--qa-theme") != nil, let installed = themes.installed.first { themes.apply(installed) }
        localPlaylists = try database.playlists()
        deletedPlaylist = try database.deletedPlaylist()
        importJob = try database.state(ImportJob.self, key: "import-job")
        player.onTrackChanged = { [weak self] track in self?.loadLyrics(track) }
        player.onError = { [weak self] error in self?.message = error.localizedDescription }
        floatingController = FloatingLyricsController(model: self)
    }
    func start() async {
        guard !QAOptions.enabled else { updateVisibility(); return }
        do {
            if let cookie = try CredentialStore.read() { await api.setCookie(cookie); profile = try await api.profile() }
        } catch { message = error.localizedDescription }
        updateVisibility()
    }
    func navigate(_ destination: LibrarySection) {
        playlistQuery = ""; historyDate = nil; historyEvents = []
        section = destination; followedUploader = nil; openedPlaylist = nil; page = 1; tracks = []; playlists = []; following = []
        loadSection()
    }
    func loadSection(more: Bool = false) {
        routeTask?.cancel(); let token = UUID(); routeID = token; busy = true
        if !more { page = 1 }
        routeTask = Task { [weak self] in
            guard let self else { return }
            defer { if routeID == token { busy = false } }
            do {
                var resultTracks: [Track] = [], resultPlaylists: [Playlist] = [], resultFollowing: [FollowingProfile] = []
                let destination = section, requestedPage = page
                if let followedUploader { resultTracks = try await api.uploaderTracks(userID: followedUploader.id, page: requestedPage) }
                else if let playlist = openedPlaylist {
                    if playlist.kind == "local" { resultTracks = try database.playlistTracks(playlistID: playlist.id, query: playlistQuery, limit: 100, offset: (requestedPage - 1) * 100) }
                    else { resultTracks = try await api.remoteTracks(playlist, page: requestedPage) }
                } else {
                    switch destination {
                    case .search: if !query.trimmingCharacters(in: .whitespaces).isEmpty { resultTracks = searchLocal ? try database.search(query, limit: 100, offset: (requestedPage - 1) * 100) : try await api.search(query, page: requestedPage) }
                    case .playlists: resultPlaylists = try database.playlists()
                    case .favorites: guard let profile else { showLogin = true; return }; resultPlaylists = try await api.favoriteFolders(userID: profile.id)
                    case .collections: guard let profile else { showLogin = true; return }; resultPlaylists = try await api.collections(userID: profile.id, page: requestedPage)
                    case .following: guard let profile else { showLogin = true; return }; resultFollowing = try await api.following(userID: profile.id, page: requestedPage)
                    case .watchLater: resultTracks = try await api.watchLater()
                    case .multipart: resultTracks = (try database.state([Track].self, key: "multipart")) ?? []
                    case .history, .profile:
                        let database = database
                        let date = historyDate
                        let result = try await Task.detached { (try database.summary(), try database.recentTracks(limit: 100, offset: (requestedPage - 1) * 100), try date.map { try database.listeningEvents(on: $0, offset: (requestedPage - 1) * 100) } ?? []) }.value
                        try Task.checkCancellation(); guard routeID == token else { return }
                        summary = result.0; resultTracks = date == nil ? result.1 : result.2.map(\.track)
                        historyEvents = more ? historyEvents + result.2 : result.2
                    case .downloads, .settings, .themes, .localFiles: break
                    }
                }
                try Task.checkCancellation(); guard routeID == token else { return }
                if more { tracks += resultTracks; playlists += resultPlaylists; following += resultFollowing }
                else { tracks = resultTracks; playlists = resultPlaylists; following = resultFollowing }
                let threshold = followedUploader != nil ? 30 : section == .search && searchLocal ? 100 : openedPlaylist?.kind == "local" || [.history, .profile].contains(destination) ? 100 : destination == .following ? 50 : 20
                hasMore = ![.multipart, .watchLater, .favorites, .playlists].contains(destination) && max(resultTracks.count, resultPlaylists.count, resultFollowing.count) >= threshold
                if openedPlaylist?.kind == "local" { hasMore = resultTracks.count == 100 }
                localPlaylists = try database.playlists()
            } catch is CancellationError { }
            catch { if routeID == token { message = error.localizedDescription } }
        }
    }
    func open(_ playlist: Playlist) { playlistQuery = ""; openedPlaylist = playlist; tracks = []; page = 1; loadSection() }
    func loadMore() { guard hasMore, !busy else { return }; page += 1; loadSection(more: true) }
    func play(_ track: Track) {
        if let playlist = openedPlaylist, playlist.kind == "local" {
            do {
                let all = try database.playlistTracks(playlistID: playlist.id, query: playlistQuery)
                guard let index = all.firstIndex(where: { $0.id == track.id }) else { return }
                player.setQueue(all, index: index)
            } catch { message = error.localizedDescription }
            return
        }
        if let index = tracks.firstIndex(where: { $0.id == track.id }) { player.setQueue(tracks, index: index) }
        else { player.setQueue([track]) }
    }
    func collectionTracks() throws -> [Track] {
        if let playlist = openedPlaylist, playlist.kind == "local" { return try database.playlistTracks(playlistID: playlist.id, query: playlistQuery) }
        return tracks
    }
    func playCollection() {
        do { let all = try collectionTracks(); if !all.isEmpty { player.setQueue(all) } }
        catch { message = error.localizedDescription }
    }
    func enqueueCollection() {
        do { let added = player.enqueue(try collectionTracks()); message = "已加入队列 \(added) 首歌曲，已跳过重复项。" }
        catch { message = error.localizedDescription }
    }
    func downloadCollection() {
        do { downloads.add(try collectionTracks()) }
        catch { message = error.localizedDescription }
    }
    func selectHistoryDate(_ date: Date?) { historyDate = date; historyEvents = []; tracks = []; loadSection() }
    func createPlaylist(_ title: String) {
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        do { try database.savePlaylist(Playlist(title: title), tracks: []); localPlaylists = try database.playlists(); if section == .playlists { loadSection() } }
        catch { message = error.localizedDescription }
    }
    func add(_ track: Track, to playlist: Playlist) {
        add([track], to: playlist)
    }
    func add(_ tracks: [Track], to playlist: Playlist) {
        do { try database.append(tracks, to: playlist.id); localPlaylists = try database.playlists(); if openedPlaylist?.id == playlist.id { loadSection() } }
        catch { message = error.localizedDescription }
    }
    func deletePlaylist(_ playlist: Playlist) {
        do {
            try database.deletePlaylist(playlist.id)
            deletedPlaylist = try database.deletedPlaylist()
            localPlaylists = try database.playlists()
            if openedPlaylist?.id == playlist.id { navigate(.playlists) } else { loadSection() }
        }
        catch { message = error.localizedDescription }
    }
    func undoPlaylistDeletion() {
        do {
            try database.restoreDeletedPlaylist()
            deletedPlaylist = nil
            localPlaylists = try database.playlists()
            loadSection()
        }
        catch { message = error.localizedDescription }
    }
    func remove(_ track: Track, from playlist: Playlist) {
        do { try database.removeTrack(track.id, from: playlist.id); loadSection() }
        catch { message = error.localizedDescription }
    }
    func expandPages(_ track: Track) {
        routeTask?.cancel(); busy = true
        routeTask = Task { [weak self] in
            guard let self else { return }; defer { busy = false }
            do {
                let result = try await api.pages(track); try Task.checkCancellation()
                var remembered = (try database.state([Track].self, key: "multipart")) ?? []
                if !remembered.contains(where: { $0.bvid == track.bvid }) { remembered.append(track); try database.saveState(remembered, key: "multipart") }
                section = .multipart; openedPlaylist = nil; tracks = result; playlists = []; hasMore = false
            } catch is CancellationError { } catch { message = error.localizedDescription }
        }
    }
    func openFollowing(_ person: FollowingProfile) {
        followedUploader = person; openedPlaylist = nil; tracks = []; following = []; page = 1; loadSection()
    }
    func login(cookie: String) async throws {
        let previous = try CredentialStore.read() ?? ""
        await api.setCookie(cookie)
        do {
            let profile = try await api.profile()
            try CredentialStore.write(cookie)
            self.profile = profile; showLogin = false; loadSection()
        } catch { await api.setCookie(previous); throw error }
    }
    func logout() async {
        do { try CredentialStore.delete(); pauseImport(); downloads.pauseAll(); player.pause(); player.stop(); await api.setCookie(""); profile = nil; tracks = []; playlists = [] }
        catch { message = error.localizedDescription }
    }
    func loadLyrics(_ track: Track) {
        lyricTask?.cancel(); player.setLyrics(LyricDocument()); lyricMessage = nil
        lyricTask = Task { [weak self] in
            guard let self else { return }
            do {
                let document: LyricDocument
                if let cached = try database.lyrics(trackID: track.id) { document = cached }
                else { document = try await music.automaticLyrics(for: track); try database.saveLyrics(document, trackID: track.id) }
                try Task.checkCancellation(); guard player.currentTrack?.id == track.id else { return }
                player.setLyrics(document)
            } catch is CancellationError { } catch { if player.currentTrack?.id == track.id { lyricMessage = error.localizedDescription } }
        }
    }
    func applyLyrics(_ document: LyricDocument) throws {
        guard let track = player.currentTrack else { return }
        try database.saveLyrics(document, trackID: track.id); player.setLyrics(document); lyricMessage = nil
    }
    func adjustLyricOffset(_ delta: Double) {
        var document = player.lyrics; document.offset += delta
        do { try applyLyrics(document) } catch { message = error.localizedDescription }
    }
    func searchLyrics(_ query: String) async {
        do { lyricCandidates = try await music.searchLyrics(query, source: lyricSource) }
        catch { message = error.localizedDescription }
    }
    func chooseLyrics(_ candidate: LyricCandidate) async {
        do { try applyLyrics(try await music.lyrics(candidate)) } catch { message = error.localizedDescription }
    }
    func beginImport(input: String, source: String) async {
        guard !importRunning else { return }
        busy = true; defer { busy = false }
        do {
            let (title, songs) = try await music.fetchPlaylist(input: input, source: source)
            importJob = ImportJob(title: title, matches: songs.map { ImportMatch(song: $0) }); persistImport(); resumeImport()
        } catch { message = error.localizedDescription }
    }
    func resumeImport() {
        guard !importRunning, importJob != nil else { return }
        importRunning = true
        importTask = Task { [weak self] in
            guard let self else { return }; defer { importRunning = false }
            while let job = importJob, job.cursor < job.matches.count {
                let index = job.cursor, song = job.matches[index].song
                if job.matches[index].reviewed { importJob?.cursor = index + 1; persistImport(); continue }
                do {
                    try await Task.sleep(for: .milliseconds(1200))
                    let results = try await api.search(song.title + " " + song.artist, page: 1)
                    try Task.checkCancellation()
                    let sorted = results.sorted { Matching.score(song, $0) > Matching.score(song, $1) }
                    importJob?.matches[index].candidates = Array(sorted.prefix(8))
                    importJob?.matches[index].selected = sorted.isEmpty ? nil : 0
                    importJob?.matches[index].score = sorted.first.map { Matching.score(song, $0) } ?? 0
                    importJob?.matches[index].error = sorted.isEmpty ? "没有匹配结果" : nil
                } catch is CancellationError { persistImport(); return }
                catch {
                    if Task.isCancelled { persistImport(); return }
                    importJob?.matches[index].error = error.localizedDescription
                    if let error = error as? APIError {
                        switch error {
                        case .network, .loginRequired, .cancelled: persistImport(); message = error.localizedDescription; return
                        case .remote(let code, _) where [412, 429, -412, -352].contains(code): persistImport(); message = "匹配已暂停，请稍后继续。"; return
                        default: break
                        }
                    }
                }
                importJob?.cursor = index + 1; persistImport()
            }
        }
    }
    func pauseImport() { importTask?.cancel() }
    func persistImport() { do { if let importJob { try database.saveState(importJob, key: "import-job") } } catch { message = error.localizedDescription } }
    func saveImport() {
        guard let job = importJob, !importRunning else { return }
        guard job.matches.allSatisfy({ $0.reviewed || ($0.track != nil && $0.score >= 0.72) }) else { message = "请先确认或跳过所有未匹配和低置信度项目。"; return }
        let selected = job.matches.compactMap(\.track)
        guard !selected.isEmpty else { message = "没有可保存的歌曲。"; return }
        do { try database.savePlaylist(Playlist(title: job.title), tracks: selected); importJob?.saved = true; persistImport(); localPlaylists = try database.playlists(); message = "已保存 \(selected.count) 首歌曲到「\(job.title)」。" }
        catch { message = error.localizedDescription }
    }
    func updateVisibility() {
        player.visualizerVisible = mainWindowVisible && showPlayer
        floatingController?.update()
    }
    func shutdown() { pauseImport(); downloads.pauseAll(); player.shutdown() }
}

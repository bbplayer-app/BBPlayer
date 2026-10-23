import Foundation
import GRDB

public struct HistorySummary: Sendable {
    public var seconds: Double
    public var completed: Int
    public var days: [String: Double]
    public var ranking: [(track: Track, seconds: Double, count: Int)]
}

public final class LibraryDatabase: LibraryRepository, @unchecked Sendable {
    public let pool: DatabasePool
    private let encoder = JSONEncoder()
    public init(url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        pool = try DatabasePool(path: url.path)
        var migrator = DatabaseMigrator()
        migrator.registerMigration("native-v1") { db in
            try db.execute(sql: """
                CREATE TABLE track (id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL, payload BLOB NOT NULL);
                CREATE INDEX track_title ON track(title);
                CREATE TABLE playlist (id TEXT PRIMARY KEY, title TEXT NOT NULL, payload BLOB NOT NULL);
                CREATE TABLE playlist_track (playlist_id TEXT NOT NULL REFERENCES playlist(id) ON DELETE CASCADE,
                    track_id TEXT NOT NULL REFERENCES track(id), sort_order INTEGER NOT NULL,
                    PRIMARY KEY (playlist_id, track_id));
                CREATE INDEX playlist_order ON playlist_track(playlist_id, sort_order);
                CREATE TABLE history (id TEXT PRIMARY KEY, track_id TEXT NOT NULL REFERENCES track(id),
                    started REAL NOT NULL, listened REAL NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0);
                CREATE INDEX history_started ON history(started);
                CREATE INDEX history_track ON history(track_id);
                CREATE TABLE state (key TEXT PRIMARY KEY, value BLOB NOT NULL);
                CREATE TABLE resume (track_id TEXT PRIMARY KEY, position REAL NOT NULL, rate REAL NOT NULL);
                CREATE TABLE lyric (track_id TEXT PRIMARY KEY, payload BLOB NOT NULL);
                """)
        }
        try migrator.migrate(pool)
    }
    public func playlists() throws -> [Playlist] {
        try pool.read { db in
            try Row.fetchAll(db, sql: "SELECT p.payload, COUNT(pt.track_id) AS item_count FROM playlist p LEFT JOIN playlist_track pt ON pt.playlist_id=p.id GROUP BY p.id ORDER BY p.title")
                .map { row in
                    var item = try JSONDecoder().decode(Playlist.self, from: row["payload"])
                    item.count = row["item_count"]; return item
                }
        }
    }
    public func tracks(playlistID: String, limit: Int = 100, offset: Int = 0) throws -> [Track] {
        try pool.read { db in
            try Row.fetchAll(db, sql: "SELECT t.payload FROM track t JOIN playlist_track pt ON pt.track_id=t.id WHERE pt.playlist_id=? ORDER BY pt.sort_order LIMIT ? OFFSET ?", arguments: [playlistID, limit, offset])
                .map { try JSONDecoder().decode(Track.self, from: $0["payload"]) }
        }
    }
    public func savePlaylist(_ playlist: Playlist, tracks: [Track]) throws {
        let data = try JSONEncoder().encode(playlist)
        try pool.write { db in
            try db.execute(sql: "INSERT INTO playlist(id,title,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,payload=excluded.payload", arguments: [playlist.id, playlist.title, data])
            try db.execute(sql: "DELETE FROM playlist_track WHERE playlist_id=?", arguments: [playlist.id])
            for (index, track) in tracks.enumerated() {
                try Self.upsert(track, in: db)
                try db.execute(sql: "INSERT OR IGNORE INTO playlist_track VALUES(?,?,?)", arguments: [playlist.id, track.id, index])
            }
        }
    }
    public func append(_ track: Track, to playlistID: String) throws {
        try pool.write { db in
            try Self.upsert(track, in: db)
            let order = try Int.fetchOne(db, sql: "SELECT COALESCE(MAX(sort_order),-1)+1 FROM playlist_track WHERE playlist_id=?", arguments: [playlistID]) ?? 0
            try db.execute(sql: "INSERT OR IGNORE INTO playlist_track VALUES(?,?,?)", arguments: [playlistID, track.id, order])
        }
    }
    public func removeTrack(_ trackID: String, from playlistID: String) throws {
        try pool.write { try $0.execute(sql: "DELETE FROM playlist_track WHERE playlist_id=? AND track_id=?", arguments: [playlistID, trackID]) }
    }
    public func renamePlaylist(_ id: String, title: String) throws {
        try pool.write { db in
            guard let data = try Data.fetchOne(db, sql: "SELECT payload FROM playlist WHERE id=?", arguments: [id]) else { return }
            var playlist = try JSONDecoder().decode(Playlist.self, from: data); playlist.title = title
            try db.execute(sql: "UPDATE playlist SET title=?,payload=? WHERE id=?", arguments: [title, try JSONEncoder().encode(playlist), id])
        }
    }
    public func moveTrack(_ trackID: String, in playlistID: String, forward: Bool) throws {
        try pool.write { db in
            guard let order = try Int.fetchOne(db, sql: "SELECT sort_order FROM playlist_track WHERE playlist_id=? AND track_id=?", arguments: [playlistID, trackID]) else { return }
            let comparison = forward ? ">" : "<", sorting = forward ? "ASC" : "DESC"
            guard let row = try Row.fetchOne(db, sql: "SELECT track_id,sort_order FROM playlist_track WHERE playlist_id=? AND sort_order \(comparison) ? ORDER BY sort_order \(sorting) LIMIT 1", arguments: [playlistID, order]) else { return }
            let neighborID: String = row["track_id"], neighborOrder: Int = row["sort_order"]
            try db.execute(sql: "UPDATE playlist_track SET sort_order=? WHERE playlist_id=? AND track_id=?", arguments: [neighborOrder, playlistID, trackID])
            try db.execute(sql: "UPDATE playlist_track SET sort_order=? WHERE playlist_id=? AND track_id=?", arguments: [order, playlistID, neighborID])
        }
    }
    public func deletePlaylist(_ id: String) throws {
        try pool.write { try $0.execute(sql: "DELETE FROM playlist WHERE id=?", arguments: [id]) }
    }
    public func search(_ text: String, limit: Int = 100, offset: Int = 0) throws -> [Track] {
        try pool.read { db in
            let pattern = "%" + text.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "%", with: "\\%").replacingOccurrences(of: "_", with: "\\_") + "%"
            return try Row.fetchAll(db, sql: "SELECT payload FROM track WHERE title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\' ORDER BY title LIMIT ? OFFSET ?", arguments: [pattern, pattern, limit, offset])
                .map { try JSONDecoder().decode(Track.self, from: $0["payload"]) }
        }
    }
    public func saveState<T: Encodable>(_ value: T, key: String) throws {
        let data = try JSONEncoder().encode(value)
        try pool.write { try $0.execute(sql: "INSERT INTO state VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", arguments: [key, data]) }
    }
    public func removeState(key: String) throws {
        try pool.write { try $0.execute(sql: "DELETE FROM state WHERE key=?", arguments: [key]) }
    }
    public func state<T: Decodable>(_ type: T.Type, key: String) throws -> T? {
        try pool.read { db in
            guard let data = try Data.fetchOne(db, sql: "SELECT value FROM state WHERE key=?", arguments: [key]) else { return nil }
            return try JSONDecoder().decode(type, from: data)
        }
    }
    public func checkpointHistory(id: String, track: Track, started: Date, listened: Double, completed: Bool) throws {
        guard listened.isFinite, listened >= 0 else { return }
        try pool.write { db in
            try Self.upsert(track, in: db)
            try db.execute(sql: """
                INSERT INTO history(id,track_id,started,listened,completed) VALUES(?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET listened=MAX(history.listened,excluded.listened),completed=MAX(history.completed,excluded.completed)
                """, arguments: [id, track.id, started.timeIntervalSince1970, listened, completed])
        }
    }
    public func summary() throws -> HistorySummary {
        try pool.read { db in
            let total = try Row.fetchOne(db, sql: "SELECT COALESCE(SUM(listened),0) AS seconds, COALESCE(SUM(completed),0) AS completed FROM history")!
            var days: [String: Double] = [:]
            for row in try Row.fetchAll(db, sql: "SELECT date(started,'unixepoch','localtime') AS day,SUM(listened) AS seconds FROM history GROUP BY day") {
                days[row["day"]] = row["seconds"]
            }
            let ranking = try Row.fetchAll(db, sql: "SELECT t.payload,SUM(h.listened) AS seconds,COUNT(*) AS plays FROM history h JOIN track t ON t.id=h.track_id GROUP BY h.track_id ORDER BY seconds DESC LIMIT 100")
                .map { row in (track: try JSONDecoder().decode(Track.self, from: row["payload"]), seconds: row["seconds"] as Double, count: row["plays"] as Int) }
            return HistorySummary(seconds: total["seconds"], completed: total["completed"], days: days, ranking: ranking)
        }
    }
    public func recentTracks(limit: Int = 100, offset: Int = 0) throws -> [Track] {
        try pool.read { db in
            try Row.fetchAll(db, sql: "SELECT t.payload FROM track t JOIN history h ON h.track_id=t.id GROUP BY t.id ORDER BY MAX(h.started) DESC LIMIT ? OFFSET ?", arguments: [limit, offset])
                .map { try JSONDecoder().decode(Track.self, from: $0["payload"]) }
        }
    }
    public func saveResume(trackID: String, position: Double, rate: Double) throws {
        guard position.isFinite, rate.isFinite else { return }
        try pool.write { try $0.execute(sql: "INSERT INTO resume VALUES(?,?,?) ON CONFLICT(track_id) DO UPDATE SET position=excluded.position,rate=excluded.rate", arguments: [trackID, max(0, position), rate]) }
    }
    public func resume(trackID: String) throws -> (position: Double, rate: Double)? {
        try pool.read { db in
            guard let row = try Row.fetchOne(db, sql: "SELECT position,rate FROM resume WHERE track_id=?", arguments: [trackID]) else { return nil }
            return (row["position"], row["rate"])
        }
    }
    public func saveLyrics(_ document: LyricDocument, trackID: String) throws {
        let data = try JSONEncoder().encode(document)
        try pool.write { try $0.execute(sql: "INSERT INTO lyric VALUES(?,?) ON CONFLICT(track_id) DO UPDATE SET payload=excluded.payload", arguments: [trackID, data]) }
    }
    public func lyrics(trackID: String) throws -> LyricDocument? {
        try pool.read { db in
            guard let data = try Data.fetchOne(db, sql: "SELECT payload FROM lyric WHERE track_id=?", arguments: [trackID]) else { return nil }
            return try JSONDecoder().decode(LyricDocument.self, from: data)
        }
    }
    private static func upsert(_ track: Track, in db: Database) throws {
        let data = try JSONEncoder().encode(track)
        try db.execute(sql: "INSERT INTO track VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,artist=excluded.artist,payload=excluded.payload", arguments: [track.id, track.title, track.artist, data])
    }
}

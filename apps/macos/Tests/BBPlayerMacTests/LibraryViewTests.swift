import AppKit
import SwiftUI
import XCTest
import BBPlayerCore
@testable import BBPlayerMac

final class LibraryViewTests: XCTestCase {
    @MainActor func testIsolatedLibraryHistoryAndUndoLayouts() async throws {
        _ = NSApplication.shared
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let model = try AppModel(dataRoot: root)
        defer { model.shutdown() }
        let playlist = Playlist(title: "测试歌单 · Library")
        let tracks = (0..<205).map { Track(bvid: "fixture\($0)", title: "测试歌曲 \($0)", artist: "Test artist", duration: 180) }
        try model.database.savePlaylist(playlist, tracks: tracks)
        try model.database.checkpointHistory(id: "today", track: tracks[0], started: Date(), listened: 95, completed: false)
        model.section = .playlists
        model.open(playlist)
        await settle(model)
        XCTAssertEqual(model.tracks.count, 100)
        XCTAssertEqual(try model.collectionTracks().count, 205)
        try render(model, name: "playlist")
        model.playlistQuery = "测试歌曲 204"
        model.loadSection()
        await settle(model)
        XCTAssertEqual(model.tracks.map(\.id), [tracks[204].id])
        XCTAssertEqual(try model.collectionTracks().map(\.id), [tracks[204].id])
        try render(model, name: "filtered")
        model.navigate(.history)
        model.selectHistoryDate(Date())
        await settle(model)
        XCTAssertEqual(model.historyEvents.map(\.id), ["today"])
        try render(model, name: "history")
        model.navigate(.playlists)
        model.deletePlaylist(playlist)
        await settle(model)
        XCTAssertEqual(model.deletedPlaylist?.id, playlist.id)
        try render(model, name: "undo")
        model.undoPlaylistDeletion()
        await settle(model)
        XCTAssertNil(model.deletedPlaylist)
        XCTAssertEqual(try model.database.playlistTracks(playlistID: playlist.id).count, 205)
        XCTAssertNil(model.message)
    }

    @MainActor private func settle(_ model: AppModel) async {
        for _ in 0..<100 { if !model.busy { return }; try? await Task.sleep(for: .milliseconds(10)) }
        XCTAssertFalse(model.busy)
    }

    @MainActor private func render(_ model: AppModel, name: String) throws {
        let host = NSHostingView(rootView: RootView(model: model))
        host.frame = NSRect(x: 0, y: 0, width: 1120, height: 740)
        let window = NSWindow(contentRect: host.frame, styleMask: [.titled], backing: .buffered, defer: false)
        window.contentView = host
        host.layoutSubtreeIfNeeded()
        let bitmap = try XCTUnwrap(host.bitmapImageRepForCachingDisplay(in: host.bounds))
        host.cacheDisplay(in: host.bounds, to: bitmap)
        XCTAssertEqual(bitmap.pixelsWide, Int(host.bounds.width * window.backingScaleFactor))
        if let output = ProcessInfo.processInfo.environment["BBPLAYER_QA_SHOTS"] {
            let directory = URL(fileURLWithPath: output)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try XCTUnwrap(bitmap.representation(using: .png, properties: [:])).write(to: directory.appendingPathComponent(name + ".png"))
        }
        window.orderOut(nil)
        window.contentView = nil
    }
}

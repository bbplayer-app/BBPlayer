import XCTest
@testable import BBPlayerCore

private actor DownloadProvider: MediaSourceProvider {
    let url: URL
    init(url: URL) { self.url = url }
    func search(_ query: String, page: Int) async throws -> [Track] { [] }
    func resolve(_ track: Track) async throws -> ResolvedAudio {
        ResolvedAudio(track: track.withPage(cid: 42, title: nil, duration: nil), url: url, measuredLoudness: -8, targetLoudness: -14)
    }
    func chapters(for track: Track) async throws -> [Chapter] {
        try await Task.sleep(for: .milliseconds(100))
        return [Chapter(title: "Downloaded chapter", start: 0, end: 10)]
    }
}
final class DownloadTests: XCTestCase {
    @MainActor func testDownloadPauseResumeOfflineMetadataAndDeletion() async throws {
        let server = Process(), pipe = Pipe()
        server.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        server.arguments = ["-u", "-c", #"""
import http.server,time
payload=b'\x7f'*(1024*1024)
class Handler(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  bounds=self.headers.get('Range','bytes=0-').split('=')[1].split('-')
  start=int(bounds[0]); end=min(len(payload)-1,int(bounds[1]) if bounds[1] else len(payload)-1)
  self.send_response(206); self.send_header('Content-Range',f'bytes {start}-{end}/{len(payload)}'); self.send_header('Content-Length',str(end-start+1)); self.end_headers()
  try:
   for offset in range(start,end+1,32768):
    self.wfile.write(payload[offset:min(offset+32768,end+1)]); self.wfile.flush(); time.sleep(.03)
  except (BrokenPipeError,ConnectionResetError): pass
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
print(server.server_port,flush=True)
server.serve_forever()
"""#]
        server.standardOutput = pipe; server.standardError = FileHandle.nullDevice
        try server.run(); defer { server.terminate(); server.waitUntilExit() }
        let portData = pipe.fileHandleForReading.availableData
        let port = try XCTUnwrap(Int(String(decoding: portData, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)))
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let db = try LibraryDatabase(url: root.appendingPathComponent("db"))
        let manager = try DownloadManager(root: root.appendingPathComponent("downloads"), provider: DownloadProvider(url: URL(string: "http://127.0.0.1:\(port)/audio.m4a")!), database: db)
        let track = Track(bvid: "download", title: "Fixture", duration: 10)
        manager.add(track)
        for _ in 0..<100 { try await Task.sleep(for: .milliseconds(25)); if manager.jobs.first?.received ?? 0 > 0 { break } }
        manager.pause(track.id)
        let saved = manager.jobs.first?.received ?? 0
        XCTAssertGreaterThan(saved, 0)
        XCTAssertLessThan(saved, 1_048_576)
        try await Task.sleep(for: .milliseconds(200))
        manager.resume(track.id)
        for _ in 0..<150 { try await Task.sleep(for: .milliseconds(25)); if manager.jobs.first?.status == .completed || manager.jobs.first?.status == .failed { break } }
        XCTAssertEqual(manager.jobs.first?.status, .completed, manager.jobs.first?.error ?? "")
        let local = try XCTUnwrap(try db.state(URL.self, key: "download-file:" + track.id))
        XCTAssertEqual(try Data(contentsOf: local), Data(repeating: 0x7f, count: 1_048_576))
        let metadata = try XCTUnwrap(try db.state(OfflineAudioMetadata.self, key: "download-metadata:" + track.id))
        XCTAssertEqual(metadata.measuredLoudness, -8)
        XCTAssertEqual(metadata.track.cid, 42)
        XCTAssertEqual(metadata.chapters.first?.title, "Downloaded chapter")
        manager.remove(track.id)
        XCTAssertFalse(FileManager.default.fileExists(atPath: local.path))
        XCTAssertNil(try db.state(URL.self, key: "download-file:" + metadata.track.id))
        XCTAssertNil(try db.state(URL.self, key: "download-file:" + track.id))
        XCTAssertTrue(manager.jobs.isEmpty)
    }
}

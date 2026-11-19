import AVFoundation

/// Plays a DASH audio file through a generated HLS playlist.
///
/// AVPlayer can open these fragmented `.m4s` files directly, but it reads through every
/// fragment first, which delays playback by several seconds. A byte-range playlist built
/// from the file's `sidx` box lets it fetch only the segments it needs.
final class DashAudioPlaylistLoader: NSObject, AVAssetResourceLoaderDelegate {
    static let playlistUrl = URL(string: "bbplayer-dash://audio/playlist.m3u8")!

    private struct Segment {
        let offset: Int
        let size: Int
        let duration: Double
    }

    private enum LoaderError: Error {
        case invalidSegmentBase
        case invalidIndex
    }

    let queue = DispatchQueue(label: "com.orpheus.dash-playlist")
    private let mediaUrl: String
    private let segmentBase: BilibiliPlayUrlResponse.SegmentBase
    private let headers: [String: String]
    /// AVPlayer asks for the playlist twice, and each fetch costs a network round trip. Only used on `queue`.
    private var cachedPlaylist: Data?

    init(mediaUrl: String, segmentBase: BilibiliPlayUrlResponse.SegmentBase, headers: [String: String]) {
        self.mediaUrl = mediaUrl
        self.segmentBase = segmentBase
        self.headers = headers
    }

    func resourceLoader(_ resourceLoader: AVAssetResourceLoader,
                        shouldWaitForLoadingOfRequestedResource loadingRequest: AVAssetResourceLoadingRequest) -> Bool {
        if let cachedPlaylist = cachedPlaylist {
            loadingRequest.dataRequest?.respond(with: cachedPlaylist)
            loadingRequest.finishLoading()
            return true
        }

        fetchPlaylist { result in
            self.queue.async {
                switch result {
                case .success(let playlist):
                    let data = Data(playlist.utf8)
                    self.cachedPlaylist = data
                    loadingRequest.dataRequest?.respond(with: data)
                    loadingRequest.finishLoading()
                case .failure(let error):
                    loadingRequest.finishLoading(with: error)
                }
            }
        }
        return true
    }

    private func fetchPlaylist(completion: @escaping (Result<String, Error>) -> Void) {
        guard let url = URL(string: mediaUrl),
              let initialization = Self.byteRange(segmentBase.initialization),
              let index = Self.byteRange(segmentBase.index_range) else {
            completion(.failure(LoaderError.invalidSegmentBase))
            return
        }

        var request = URLRequest(url: url)
        headers.forEach { request.setValue($1, forHTTPHeaderField: $0) }
        request.setValue("bytes=\(index.lowerBound)-\(index.upperBound)", forHTTPHeaderField: "Range")

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status),
                  let data = data,
                  let segments = Self.parseSidx(data, firstByteAfterIndex: index.upperBound + 1),
                  !segments.isEmpty else {
                completion(.failure(LoaderError.invalidIndex))
                return
            }
            completion(.success(self.playlist(initializationLength: initialization.upperBound + 1, segments: segments)))
        }.resume()
    }

    private func playlist(initializationLength: Int, segments: [Segment]) -> String {
        let targetDuration = Int((segments.map(\.duration).max() ?? 1).rounded(.up))
        var lines = [
            "#EXTM3U",
            "#EXT-X-VERSION:7",
            "#EXT-X-PLAYLIST-TYPE:VOD",
            "#EXT-X-TARGETDURATION:\(targetDuration)",
            "#EXT-X-MEDIA-SEQUENCE:0",
            "#EXT-X-MAP:URI=\"\(mediaUrl)\",BYTERANGE=\"\(initializationLength)@0\"",
        ]
        for segment in segments {
            lines.append(String(format: "#EXTINF:%.5f,", segment.duration))
            lines.append("#EXT-X-BYTERANGE:\(segment.size)@\(segment.offset)")
            lines.append(mediaUrl)
        }
        lines.append("#EXT-X-ENDLIST")
        return lines.joined(separator: "\n") + "\n"
    }

    /// Parses a Bilibili `index_range` or `initialization` value such as `934-1481`.
    private static func byteRange(_ text: String) -> ClosedRange<Int>? {
        let bounds = text.split(separator: "-").compactMap { Int($0) }
        guard bounds.count == 2, bounds[0] <= bounds[1] else { return nil }
        return bounds[0]...bounds[1]
    }

    /// Reads the segment list from a `sidx` box (ISO/IEC 14496-12).
    private static func parseSidx(_ data: Data, firstByteAfterIndex: Int) -> [Segment]? {
        let bytes = [UInt8](data)
        func read(_ offset: Int, _ length: Int) -> Int? {
            guard offset + length <= bytes.count else { return nil }
            return bytes[offset..<offset + length].reduce(0) { $0 << 8 | Int($1) }
        }

        guard bytes.count > 20, Array(bytes[4..<8]) == Array("sidx".utf8),
              let timescale = read(16, 4), timescale > 0 else { return nil }
        let timeFieldLength = bytes[8] == 0 ? 4 : 8
        let firstOffsetAt = 20 + timeFieldLength
        let referenceCountAt = firstOffsetAt + timeFieldLength + 2
        guard let firstOffset = read(firstOffsetAt, timeFieldLength),
              let referenceCount = read(referenceCountAt, 2) else { return nil }

        var segments: [Segment] = []
        var offset = firstByteAfterIndex + firstOffset
        var cursor = referenceCountAt + 2
        for _ in 0..<referenceCount {
            // The top bit marks a reference to another index, which audio files don't use.
            guard let reference = read(cursor, 4), reference >> 31 == 0,
                  let duration = read(cursor + 4, 4) else { return nil }
            segments.append(Segment(offset: offset, size: reference, duration: Double(duration) / Double(timescale)))
            offset += reference
            cursor += 12
        }
        return segments
    }
}

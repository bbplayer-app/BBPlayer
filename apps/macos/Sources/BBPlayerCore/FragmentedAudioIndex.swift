import Foundation

/// A bounded ISO-BMFF sidx reader. Audio bytes are never transcoded or rewritten.
struct FragmentedAudioIndex: Sendable {
    struct Segment: Sendable { let offset: Int64; let length: Int64; let duration: Double }
    let initializationLength: Int64
    let segments: [Segment]

    static func requiredHeaderBytes(_ data: Data) -> Int? {
        var offset = 0
        while offset <= data.count - 8 {
            let size = data[offset..<offset+4].reduce(UInt64(0)) { $0 << 8 | UInt64($1) }
            let type = String(decoding: data[offset+4..<offset+8], as: UTF8.self)
            guard ["ftyp", "free", "moov", "sidx"].contains(type), size >= 8, size <= 262_144, offset <= 262_144 - Int(size) else { return nil }
            let end = offset + Int(size)
            if type == "sidx" || end > data.count { return end }
            offset = end
        }
        return nil
    }

    static func parse(_ data: Data, total: Int64) -> FragmentedAudioIndex? {
        func number(_ offset: Int, _ count: Int) -> UInt64? {
            guard offset >= 0, count <= 8, offset <= data.count - count else { return nil }
            return data[offset..<offset+count].reduce(0) { $0 << 8 | UInt64($1) }
        }
        var position = 0, initialization = 0
        while position <= data.count - 8 {
            guard let size = number(position, 4), size >= 8, size <= UInt64(data.count - position) else { return nil }
            let end = position + Int(size), type = String(decoding: data[position+4..<position+8], as: UTF8.self)
            if type == "moov" { initialization = end }
            if type == "mdat" || type == "moof" { return nil }
            if type == "sidx" {
                guard initialization > 0, let version = number(position+8, 1), version <= 1,
                      let scale = number(position+16, 4), scale > 0 else { return nil }
                let width = version == 1 ? 8 : 4
                guard let firstOffset = number(position+20+width, width), firstOffset <= UInt64(Int64.max),
                      let count = number(position+22+width*2, 2), count > 0, count <= 10_000,
                      Int(size) == 24 + width*2 + Int(count)*12,
                      Int64(end) <= total, Int64(firstOffset) <= total - Int64(end) else { return nil }
                var offset = Int64(end) + Int64(firstOffset), segments: [Segment] = []
                for index in 0..<Int(count) {
                    let at = position + 24 + width*2 + index*12
                    guard let reference = number(at, 4), reference & 0x8000_0000 == 0,
                          let ticks = number(at+4, 4), ticks > 0 else { return nil }
                    let length = Int64(reference & 0x7fff_ffff), duration = Double(ticks) / Double(scale)
                    guard length > 0, offset <= total, length <= total-offset, duration.isFinite, duration <= 3600 else { return nil }
                    segments.append(Segment(offset: offset, length: length, duration: duration)); offset += length
                }
                return FragmentedAudioIndex(initializationLength: Int64(initialization), segments: segments)
            }
            position = end
        }
        return nil
    }
    var playlist: Data {
        let target = Int(ceil(segments.map(\.duration).max() ?? 1))
        var lines = ["#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-TARGETDURATION:\(target)", "#EXT-X-MEDIA-SEQUENCE:0", "#EXT-X-PLAYLIST-TYPE:VOD", "#EXT-X-MAP:URI=\"init.mp4\""]
        for (index, segment) in segments.enumerated() {
            lines.append(String(format: "#EXTINF:%.6f,", locale: Locale(identifier: "en_US_POSIX"), segment.duration))
            lines.append("segment/\(index).m4s")
        }
        lines.append("#EXT-X-ENDLIST")
        return Data((lines.joined(separator: "\n") + "\n").utf8)
    }
}

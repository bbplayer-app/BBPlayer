import Foundation

public struct DanmakuComment: Sendable, Hashable {
    public let time: Double
    public let text: String
    public let color: UInt32
    public init(time: Double, text: String, color: UInt32 = 0xffffff) { self.time = time; self.text = text; self.color = color }
}

/// Bounded decoder for Bilibili's DmSegMobileReply; unknown protobuf fields are skipped.
public enum DanmakuParser {
    public static func parse(_ data: Data) throws -> [DanmakuComment] {
        guard data.count <= 12 * 1024 * 1024 else { throw APIError.invalidResponse }
        var reader = Reader(bytes: Array(data)), result: [DanmakuComment] = []
        while !reader.done {
            let tag = try reader.varint()
            if tag == 10 {
                var item = Reader(bytes: try reader.block())
                var time = 0.0, mode: UInt64 = 1, color: UInt64 = 0xffffff, text = ""
                while !item.done {
                    let field = try item.varint()
                    switch field {
                    case 16: time = Double(try item.varint()) / 1000
                    case 24: mode = try item.varint()
                    case 40: color = try item.varint()
                    case 58: text = String(bytes: try item.block(), encoding: .utf8) ?? ""
                    default: try item.skip(field)
                    }
                }
                if (1...3).contains(mode), !text.isEmpty, text.count <= 1000, time < 604800, result.count < 6000 {
                    result.append(DanmakuComment(time: time, text: text, color: UInt32(truncatingIfNeeded: color) & 0xffffff))
                }
            } else { try reader.skip(tag) }
        }
        return result.sorted { $0.time < $1.time }
    }
    private struct Reader {
        let bytes: [UInt8]
        var index = 0
        var done: Bool { index == bytes.count }
        mutating func varint() throws -> UInt64 {
            var value: UInt64 = 0
            for offset in 0..<10 {
                guard index < bytes.count else { throw APIError.invalidResponse }
                let byte = bytes[index]; index += 1
                if offset == 9 && byte > 1 { throw APIError.invalidResponse }
                value |= UInt64(byte & 127) << (offset * 7)
                if byte < 128 { return value }
            }
            throw APIError.invalidResponse
        }
        mutating func block() throws -> [UInt8] {
            let count = try varint()
            guard count <= UInt64(bytes.count - index) else { throw APIError.invalidResponse }
            let end = index + Int(count); defer { index = end }
            return Array(bytes[index..<end])
        }
        mutating func skip(_ tag: UInt64) throws {
            guard tag >> 3 > 0 else { throw APIError.invalidResponse }
            switch tag & 7 {
            case 0: _ = try varint()
            case 1: guard bytes.count - index >= 8 else { throw APIError.invalidResponse }; index += 8
            case 2: _ = try block()
            case 5: guard bytes.count - index >= 4 else { throw APIError.invalidResponse }; index += 4
            default: throw APIError.invalidResponse
            }
        }
    }
}

public struct DanmakuFlight: Sendable {
    public let comment: DanmakuComment
    public let lane: Int
    public let width: Double
    public let end: Double
}
public enum DanmakuLayout {
    /// Every comment uses the same media-time velocity, preventing overtaking within a lane.
    public static func schedule(_ comments: [DanmakuComment], widths: [Double], viewport: Double, lanes: Int, density: Int) -> [DanmakuFlight] {
        guard viewport > 0, lanes > 0, comments.count == widths.count else { return [] }
        var free = Array(repeating: -Double.infinity, count: min(20, lanes)), result: [DanmakuFlight] = []
        var second = -1, count = 0
        for (comment, width) in zip(comments, widths) {
            guard comment.time.isFinite, width.isFinite, width >= 0 else { continue }
            let bucket = Int(comment.time)
            if bucket != second { second = bucket; count = 0 }
            guard count < max(1, min(12, density)), let lane = free.indices.first(where: { free[$0] <= comment.time }) else { continue }
            count += 1; free[lane] = comment.time + (width + 30) / 100
            result.append(DanmakuFlight(comment: comment, lane: lane, width: width, end: comment.time + (viewport + width) / 100))
        }
        return result
    }
}

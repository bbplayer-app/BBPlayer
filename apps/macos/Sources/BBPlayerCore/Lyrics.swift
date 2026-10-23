import Foundation

public struct LyricWord: Codable, Hashable, Sendable {
    public var text: String
    public var start: Double
    public var end: Double
    public init(text: String, start: Double, end: Double) { self.text = text; self.start = start; self.end = end }
}
public struct LyricLine: Codable, Hashable, Identifiable, Sendable {
    public var id: String { "\(start):\(text)" }
    public var start: Double
    public var end: Double
    public var text: String
    public var words: [LyricWord]
    public var translation: String?
    public var romanization: String?
    public init(start: Double, end: Double = 0, text: String, words: [LyricWord] = [], translation: String? = nil, romanization: String? = nil) {
        self.start = start; self.end = end; self.text = text; self.words = words; self.translation = translation; self.romanization = romanization
    }
}
public struct LyricDocument: Codable, Sendable {
    public var lines: [LyricLine]
    public var source: String
    public var offset: Double
    public init(lines: [LyricLine] = [], source: String = "manual", offset: Double = 0) { self.lines = lines; self.source = source; self.offset = offset }
    public func index(at position: Double) -> Int? {
        guard !lines.isEmpty, position + offset >= lines[0].start else { return nil }
        var low = 0, high = lines.count
        while low < high { let mid = (low + high) / 2; if lines[mid].start <= position + offset { low = mid + 1 } else { high = mid } }
        return max(0, low - 1)
    }
}
public enum LyricsParser {
    public static func timestamp(_ input: String) -> Double? {
        let parts = input.split(separator: ":")
        guard parts.count == 2, let minutes = Double(parts[0]), let seconds = Double(parts[1]), abs(seconds) < 60 else { return nil }
        return max(0, minutes * 60 + seconds)
    }
    public static func parse(_ text: String, translation: String? = nil, romanization: String? = nil, source: String = "manual") -> LyricDocument {
        let stamp = #"-?\d{1,3}:-?\d{1,2}(?:\.\d{1,6})?"#
        let leading = try! NSRegularExpression(pattern: "^(?:\\[(" + stamp + ")\\])+")
        let square = try! NSRegularExpression(pattern: "\\[(" + stamp + ")\\]")
        let span = try! NSRegularExpression(pattern: "[<\\[](" + stamp + ")[>\\]]")
        let meta = try! NSRegularExpression(pattern: #"^\[([a-zA-Z]+):(.*)\]$"#)
        var grouped: [Double: [String]] = [:], last: [Double] = [], offset = 0.0
        for raw in text.components(separatedBy: .newlines) {
            let raw = raw.trimmingCharacters(in: .whitespacesAndNewlines), ns = raw.trimmingCharacters(in: .whitespacesAndNewlines) as NSString
            guard !raw.isEmpty else { continue }
            if let match = meta.firstMatch(in: raw, range: NSRange(location: 0, length: ns.length)) {
                if ns.substring(with: match.range(at: 1)) == "offset" { offset = (Double(ns.substring(with: match.range(at: 2))) ?? 0) / 1000 }; continue
            }
            if let match = leading.firstMatch(in: raw, range: NSRange(location: 0, length: ns.length)) {
                last = square.matches(in: ns.substring(with: match.range), range: NSRange(location: 0, length: match.range.length)).compactMap { timestamp(ns.substring(with: $0.range(at: 1))) }
                let content = ns.substring(from: NSMaxRange(match.range))
                for time in last { grouped[time, default: []].append(content) }
            } else { for time in last { grouped[time, default: []].append(raw) } }
        }
        let times = grouped.keys.sorted()
        var lines: [LyricLine] = []
        for (index, start) in times.enumerated() {
            let entries = grouped[start]!, content = entries[0], ns = entries[0] as NSString
            let marks = span.matches(in: content, range: NSRange(location: 0, length: ns.length))
            var words: [LyricWord] = [], cursor = 0, wordStart = start, explicitEnd: Double?
            for mark in marks {
                let value = ns.substring(with: NSRange(location: cursor, length: mark.range.location - cursor))
                if !value.isEmpty { words.append(LyricWord(text: value, start: wordStart, end: 0)) }
                cursor = NSMaxRange(mark.range)
                guard let time = timestamp(ns.substring(with: mark.range(at: 1))), time >= wordStart else { continue }
                if !words.isEmpty, words[words.count - 1].end == 0 { words[words.count - 1].end = time }
                wordStart = time; explicitEnd = time
            }
            let remainder = ns.substring(from: cursor)
            if !remainder.isEmpty { words.append(LyricWord(text: remainder, start: wordStart, end: 0)); explicitEnd = nil }
            let end = explicitEnd ?? (index + 1 < times.count ? times[index + 1] : start + 10)
            for i in words.indices where words[i].end == 0 { words[i].end = end }
            lines.append(LyricLine(start: start, end: end, text: marks.isEmpty ? content : words.map(\.text).joined(), words: marks.isEmpty ? [] : words, translation: entries.count > 1 ? entries.dropFirst().joined(separator: "\n") : nil))
        }
        let translated = translation.map { parse($0).lines } ?? [], romanized = romanization.map { parse($0).lines } ?? []
        for index in lines.indices {
            if let match = translated.first(where: { abs($0.start - lines[index].start) < 0.2 }) { lines[index].translation = match.text }
            lines[index].romanization = romanized.first { abs($0.start - lines[index].start) < 0.2 }?.text
        }
        return LyricDocument(lines: lines, source: source, offset: offset)
    }
    public static func parseYRC(_ text: String, translation: String? = nil, romanization: String? = nil) -> LyricDocument {
        let lineRegex = try! NSRegularExpression(pattern: #"^\[(\d+),(\d+)\](.*)$"#)
        let wordRegex = try! NSRegularExpression(pattern: #"\((\d+),(\d+),\d+\)([^()]*)"#)
        var lines: [LyricLine] = []
        for line in text.components(separatedBy: .newlines) {
            let ns = line as NSString
            guard let match = lineRegex.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)), let start = Double(ns.substring(with: match.range(at: 1))), let duration = Double(ns.substring(with: match.range(at: 2))) else { continue }
            let content = ns.substring(with: match.range(at: 3)), contentNS = ns.substring(with: match.range(at: 3)) as NSString
            let words = wordRegex.matches(in: content, range: NSRange(location: 0, length: contentNS.length)).compactMap { match -> LyricWord? in
                guard let position = Double(contentNS.substring(with: match.range(at: 1))), let length = Double(contentNS.substring(with: match.range(at: 2))) else { return nil }
                return LyricWord(text: contentNS.substring(with: match.range(at: 3)), start: position / 1000, end: (position + length) / 1000)
            }
            lines.append(LyricLine(start: start / 1000, end: (start + duration) / 1000, text: words.map(\.text).joined(), words: words))
        }
        let t = translation.map { parse($0).lines } ?? [], r = romanization.map { parse($0).lines } ?? []
        for index in lines.indices {
            lines[index].translation = t.first { abs($0.start - lines[index].start) < 0.2 }?.text
            lines[index].romanization = r.first { abs($0.start - lines[index].start) < 0.2 }?.text
        }
        return LyricDocument(lines: lines.sorted { $0.start < $1.start }, source: "netease")
    }
}

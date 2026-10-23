import AppKit
import XCTest
import BBPlayerCore
@testable import BBPlayerMac

final class FloatingLyricTests: XCTestCase {
    @MainActor func testLongMultilingualTextPreservesAllGlyphsAndScrolls() {
        _ = NSApplication.shared
        let original = String(repeating: "完整歌词🎵UnbrokenLatin", count: 80)
        let line = LyricLine(start: 0, end: 100, text: original, translation: String(repeating: "翻译", count: 300), romanization: "romanization")
        let view = LyricScrollText(frame: NSRect(x: 0, y: 0, width: 320, height: 100))
        view.render(line: line, fallback: "", position: 80, romanization: true, translation: true, locked: true) { _ in }
        view.layout()
        XCTAssertEqual(view.lyricsText.string, original + "\nromanization\n" + line.translation!)
        XCTAssertEqual(view.lyricsText.textContainer?.maximumNumberOfLines, 0)
        XCTAssertGreaterThan(view.lyricsText.frame.height, 100)
        XCTAssertGreaterThan(view.contentView.bounds.minY, 0)
        let manager = view.lyricsText.layoutManager!
        XCTAssertEqual(manager.numberOfGlyphs, manager.glyphRange(forCharacterRange: NSRange(location: 0, length: (view.lyricsText.string as NSString).length), actualCharacterRange: nil).length)
    }
    @MainActor func testManualScrollIsPreservedWhenUnlocked() {
        let view = LyricScrollText(frame: NSRect(x: 0, y: 0, width: 320, height: 100))
        let line = LyricLine(start: 0, end: 100, text: String(repeating: "长句", count: 500))
        view.render(line: line, fallback: "", position: 90, romanization: false, translation: false, locked: false) { _ in }
        view.layout()
        view.contentView.scroll(to: NSPoint(x: 0, y: 70)); view.reflectScrolledClipView(view.contentView)
        let manualY = view.contentView.bounds.minY
        view.render(line: line, fallback: "", position: 95, romanization: false, translation: false, locked: false) { _ in }
        view.layout()
        XCTAssertEqual(view.contentView.bounds.minY, manualY, accuracy: 1)
    }
}

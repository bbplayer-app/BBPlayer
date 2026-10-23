import AppKit
import XCTest
import BBPlayerCore
@testable import BBPlayerMac

final class FloatingLyricTests: XCTestCase {
    @MainActor func testUnlockedTextStartsNativeWindowDragAndLockStopsIt() throws {
        _ = NSApplication.shared
        let panel = DragTrackingPanel(contentRect: NSRect(x: 100, y: 100, width: 400, height: 120), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        defer { panel.orderOut(nil); panel.contentView = nil }
        panel.isMovable = true
        let view = LyricScrollText(frame: NSRect(x: 0, y: 0, width: 400, height: 120))
        panel.contentView = view
        let event = try XCTUnwrap(NSEvent.mouseEvent(with: .leftMouseDown, location: NSPoint(x: 50, y: 50), modifierFlags: [], timestamp: 0, windowNumber: panel.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: 1))
        view.render(line: nil, fallback: "Drag lyrics", position: 0, romanization: false, translation: false, locked: false) { _ in }
        XCTAssertTrue(view.lyricsText.mouseDownCanMoveWindow)
        view.lyricsText.mouseDown(with: event)
        XCTAssertEqual(panel.dragRequests, 1)
        panel.ignoresMouseEvents = true
        view.lyricsText.mouseDown(with: event)
        XCTAssertEqual(panel.dragRequests, 1, "Click-through windows must not start dragging")
        panel.ignoresMouseEvents = false
        view.render(line: nil, fallback: "Locked lyrics", position: 0, romanization: false, translation: false, locked: true) { _ in }
        XCTAssertFalse(view.lyricsText.mouseDownCanMoveWindow)
        view.lyricsText.mouseDown(with: event)
        XCTAssertEqual(panel.dragRequests, 1)
    }
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

private final class DragTrackingPanel: NSPanel {
    var dragRequests = 0
    override func performDrag(with event: NSEvent) { dragRequests += 1 }
}

import AppKit
import BBPlayerCore
import SwiftUI

@MainActor final class FloatingLyricsController: NSObject, NSWindowDelegate {
    private weak var model: AppModel?
    private var panel: NSPanel?
    init(model: AppModel) { self.model = model }
    func update() {
        guard let model else { return }
        guard model.player.preferences.floatingLyrics else { panel?.orderOut(nil); panel?.contentViewController = nil; panel?.contentView = nil; return }
        if panel == nil {
            let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 760, height: 135), styleMask: [.borderless, .nonactivatingPanel, .resizable], backing: .buffered, defer: true)
            panel.title = "BBPlayer 桌面歌词"; panel.isFloatingPanel = true; panel.level = .floating; panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            panel.backgroundColor = .clear; panel.isOpaque = false; panel.hasShadow = false; panel.hidesOnDeactivate = false
            panel.isReleasedWhenClosed = false; panel.minSize = NSSize(width: 320, height: 85); panel.delegate = self
            if let saved = UserDefaults.standard.string(forKey: "floating-frame") { panel.setFrame(NSRectFromString(saved), display: false) }
            self.panel = panel
        }
        guard let panel else { return }
        if panel.contentViewController == nil {
            let hosting = NSHostingController(rootView: FloatingLyricsView(model: model))
            panel.contentViewController = hosting
            hosting.view.frame = NSRect(origin: .zero, size: panel.contentLayoutRect.size)
            hosting.view.autoresizingMask = [.width, .height]
        }
        panel.ignoresMouseEvents = model.player.preferences.floatingLocked
        panel.isMovableByWindowBackground = !model.player.preferences.floatingLocked
        validateFrame(); panel.orderFrontRegardless(); panel.contentView?.needsDisplay = true
        NotificationCenter.default.removeObserver(self, name: NSApplication.didChangeScreenParametersNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(screenChanged), name: NSApplication.didChangeScreenParametersNotification, object: nil)
    }
    @objc private func screenChanged() { validateFrame() }
    private func validateFrame() {
        guard let panel else { return }
        let screen = NSScreen.screens.max { $0.visibleFrame.intersection(panel.frame).width * $0.visibleFrame.intersection(panel.frame).height < $1.visibleFrame.intersection(panel.frame).width * $1.visibleFrame.intersection(panel.frame).height } ?? NSScreen.main
        guard let bounds = screen?.visibleFrame.insetBy(dx: 8, dy: 8) else { return }
        var frame = panel.frame
        frame.size.width = min(frame.width, bounds.width)
        frame.size.height = min(frame.height, bounds.height)
        frame.origin.x = min(max(frame.minX, bounds.minX), bounds.maxX - frame.width)
        frame.origin.y = min(max(frame.minY, bounds.minY), bounds.maxY - frame.height)
        if frame != panel.frame { panel.setFrame(frame, display: true) }
    }
    func fitHeight(_ height: CGFloat) {
        guard let panel, abs(panel.frame.height - height) > 2 else { return }
        var frame = panel.frame
        frame.origin.y -= height - frame.height
        frame.size.height = height
        panel.setFrame(frame, display: true)
        validateFrame()
    }
    func windowDidMove(_ notification: Notification) { save() }
    func windowDidResize(_ notification: Notification) { save() }
    private func save() { if let panel { UserDefaults.standard.set(NSStringFromRect(panel.frame), forKey: "floating-frame") } }
}
struct FloatingLyricsView: View {
    @Bindable var model: AppModel
    private var line: LyricLine? { let lyrics = model.player.lyrics; return lyrics.index(at: model.player.position + model.player.preferences.lyricOffset).map { lyrics.lines[$0] } }
    var body: some View {
        FloatingLyricText(line: line, fallback: model.player.currentTrack?.title ?? "BBPlayer", position: model.player.position + model.player.preferences.lyricOffset + model.player.lyrics.offset, romanization: model.player.preferences.showRomanization, translation: model.player.preferences.showTranslation, locked: model.player.preferences.floatingLocked) { height in model.floatingController?.fitHeight(height) }
            .padding(18)
            .background(model.player.preferences.floatingLocked ? Color.clear : Color.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 16))
            .overlay(alignment: .topTrailing) { if !model.player.preferences.floatingLocked { Button { model.player.preferences.floatingLocked = true; model.updateVisibility() } label: { Image(systemName: "lock.fill") }.buttonStyle(.plain).padding(8).foregroundStyle(.white) } }
    }
}

struct FloatingLyricText: NSViewRepresentable {
    let line: LyricLine?
    let fallback: String
    let position: Double
    let romanization: Bool
    let translation: Bool
    let locked: Bool
    let heightChanged: (CGFloat) -> Void
    func makeNSView(context: Context) -> LyricScrollText { LyricScrollText() }
    func updateNSView(_ view: LyricScrollText, context: Context) {
        view.render(line: line, fallback: fallback, position: position, romanization: romanization, translation: translation, locked: locked, heightChanged: heightChanged)
    }
}

/// TextKit retains all characters, wraps unbroken text and provides precise glyph scrolling.
final class LyricScrollText: NSScrollView {
    let lyricsText = NSTextView()
    private var heightChanged: ((CGFloat) -> Void)?
    private var lastHeight: CGFloat = 0
    private var locked = true
    private var manualOrigin: NSPoint?
    private var originalText = ""
    private var targetRange = NSRange(location: 0, length: 0)
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        drawsBackground = false; borderType = .noBorder
        hasVerticalScroller = true; autohidesScrollers = true
        lyricsText.drawsBackground = false; lyricsText.isEditable = false; lyricsText.isSelectable = false
        lyricsText.isVerticallyResizable = true; lyricsText.isHorizontallyResizable = false
        lyricsText.textContainerInset = NSSize(width: 0, height: 4)
        lyricsText.textContainer?.widthTracksTextView = true
        lyricsText.textContainer?.maximumNumberOfLines = 0
        lyricsText.textContainer?.lineBreakMode = .byCharWrapping
        documentView = lyricsText
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    func render(line: LyricLine?, fallback: String, position: Double, romanization: Bool, translation: Bool, locked: Bool, heightChanged: @escaping (CGFloat) -> Void) {
        self.locked = locked; self.heightChanged = heightChanged
        let original = line?.text ?? fallback
        manualOrigin = !locked && originalText == original ? contentView.bounds.origin : nil
        originalText = original
        hasVerticalScroller = !locked
        let style = NSMutableParagraphStyle(); style.alignment = .center; style.lineBreakMode = .byCharWrapping; style.paragraphSpacing = 8
        let shadow = NSShadow(); shadow.shadowColor = NSColor.black; shadow.shadowBlurRadius = 3; shadow.shadowOffset = NSSize(width: 0, height: -1)
        func attributes(_ size: CGFloat) -> [NSAttributedString.Key: Any] { [.font: NSFont.systemFont(ofSize: size, weight: .bold), .foregroundColor: NSColor.white, .paragraphStyle: style, .shadow: shadow] }
        let content = NSMutableAttributedString(string: original, attributes: attributes(31))
        if romanization, let value = line?.romanization, !value.isEmpty { content.append(NSAttributedString(string: "\n" + value, attributes: attributes(14))) }
        if translation, let value = line?.translation, !value.isEmpty { content.append(NSAttributedString(string: "\n" + value, attributes: attributes(18))) }
        var offset = 0, active = 0
        if let line, !line.words.isEmpty {
            for word in line.words {
                let length = (word.text as NSString).length
                if offset + length <= (original as NSString).length {
                    if position >= word.start { active = offset }
                    if position >= word.start && position < word.end { content.addAttribute(.foregroundColor, value: NSColor.systemCyan, range: NSRange(location: offset, length: length)) }
                }
                offset += length
            }
        } else if let line {
            let fraction = max(0, min(1, (position - line.start) / max(1, line.end - line.start)))
            let index = original.index(original.startIndex, offsetBy: Int(Double(original.count) * fraction))
            active = original[..<index].utf16.count
        }
        targetRange = NSRange(location: min(active, max(0, content.length - 1)), length: content.length > 0 ? 1 : 0)
        lyricsText.textStorage?.setAttributedString(content)
        needsLayout = true
    }
    override func layout() {
        super.layout()
        guard contentSize.width > 0, let container = lyricsText.textContainer, let manager = lyricsText.layoutManager else { return }
        lyricsText.setFrameSize(NSSize(width: contentSize.width, height: max(1, lyricsText.frame.height)))
        container.containerSize = NSSize(width: contentSize.width, height: .greatestFiniteMagnitude)
        manager.ensureLayout(for: container)
        let textHeight = ceil(manager.usedRect(for: container).height) + 12
        lyricsText.setFrameSize(NSSize(width: contentSize.width, height: max(contentSize.height, textHeight)))
        if locked { lyricsText.scrollRangeToVisible(targetRange) }
        else if let origin = manualOrigin { contentView.scroll(to: origin); reflectScrolledClipView(contentView); manualOrigin = nil }
        let available = window?.screen?.visibleFrame.height ?? NSScreen.main?.visibleFrame.height ?? 600
        let height = min(max(100, textHeight + 36), available - 24)
        if abs(height - lastHeight) > 2 {
            lastHeight = height
            DispatchQueue.main.async { [weak self] in self?.heightChanged?(height) }
        }
    }
}

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
        guard let panel, let screen = NSScreen.main else { return }
        if !NSScreen.screens.contains(where: { $0.visibleFrame.intersection(panel.frame).width > 100 && $0.visibleFrame.intersection(panel.frame).height > 60 }) {
            let rect = screen.visibleFrame
            panel.setFrameOrigin(NSPoint(x: rect.midX - panel.frame.width / 2, y: rect.minY + 60))
        }
    }
    func windowDidMove(_ notification: Notification) { save() }
    func windowDidResize(_ notification: Notification) { save() }
    private func save() { if let panel { UserDefaults.standard.set(NSStringFromRect(panel.frame), forKey: "floating-frame") } }
}
struct FloatingLyricsView: View {
    @Bindable var model: AppModel
    private var line: LyricLine? { let lyrics = model.player.lyrics; return lyrics.index(at: model.player.position + model.player.preferences.lyricOffset).map { lyrics.lines[$0] } }
    var body: some View {
        VStack(spacing: 8) {
            if let line {
                WordLine(line: line, position: model.player.position + model.player.preferences.lyricOffset + model.player.lyrics.offset, active: true).font(.system(size: 31, weight: .bold)).lineLimit(2)
                if model.player.preferences.showRomanization, let roman = line.romanization { Text(roman).font(.system(size: 14, weight: .medium)).lineLimit(1) }
                if model.player.preferences.showTranslation, let translated = line.translation { Text(translated).font(.system(size: 18, weight: .medium)).lineLimit(1) }
            } else { Text(model.player.currentTrack?.title ?? "BBPlayer").font(.system(size: 27, weight: .bold)).lineLimit(2) }
        }.foregroundStyle(.white).colorScheme(.dark).shadow(color: .black, radius: 3, y: 1)
            .padding(18).frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(model.player.preferences.floatingLocked ? Color.clear : Color.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 16))
            .overlay(alignment: .topTrailing) { if !model.player.preferences.floatingLocked { Button { model.player.preferences.floatingLocked = true; model.updateVisibility() } label: { Image(systemName: "lock.fill") }.buttonStyle(.plain).padding(8).foregroundStyle(.white) } }
    }
}

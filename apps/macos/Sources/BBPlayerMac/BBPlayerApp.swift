import AppKit
import BBPlayerCore
import SwiftUI

@main struct BBPlayerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var model: AppModel?
    @State private var startupError: String?
    var body: some Scene {
        WindowGroup("BBPlayer", id: "main") {
            Group {
                if let model {
                    if let url = QAOptions.renderer { RendererCheckView(url: url) }
                    else { RootView(model: model).environment(model).onAppear { QAOptions.report(["event": "interactive", "timestamp": Date().timeIntervalSince1970]) } }
                }
                else if let startupError { ContentUnavailableView("无法打开音乐库", systemImage: "externaldrive.badge.exclamationmark", description: Text(startupError)).padding() }
                else { ProgressView("打开音乐库…") }
            }
            .task { if model == nil { await initialize() } }
            .frame(minWidth: 900, minHeight: 600)
            .background(WindowObserver { window in delegate.mainWindow = window; delegate.model = model })
        }
        .defaultSize(width: 1120, height: 740)
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandMenu("播放") {
                Button("播放 / 暂停") { model?.player.toggle() }.keyboardShortcut(.space, modifiers: [.command, .shift])
                Button("上一首") { model?.player.previous() }.keyboardShortcut(.leftArrow, modifiers: .command)
                Button("下一首") { model?.player.next() }.keyboardShortcut(.rightArrow, modifiers: .command)
                Button("快退 15 秒") { model?.player.jump(-15) }.keyboardShortcut(.leftArrow, modifiers: [.command, .option])
                Button("快进 15 秒") { model?.player.jump(15) }.keyboardShortcut(.rightArrow, modifiers: [.command, .option])
            }
        }
        MenuBarExtra("BBPlayer", systemImage: "music.note") {
            if let model { MenuBarControls(model: model) } else { Text("正在启动…") }
        }
    }
    @MainActor private func initialize() async {
        do { let created = try AppModel(); model = created; delegate.model = created; await created.start()
            if let bvid = QAOptions.value("--qa-play") {
                created.player.preferences.volume = 0
                created.player.preferences.floatingLyrics = QAOptions.scene == "lyrics"
                let track = try await created.api.video(bvid: bvid)
                created.player.setRepeat(.track); created.player.setQueue([track]); created.showPlayer = QAOptions.scene == "foreground"
                if QAOptions.scene != "foreground" { delegate.mainWindow?.orderOut(nil); created.mainWindowVisible = false }
                created.updateVisibility()
                Task { @MainActor in
                    var presentedForeground = false
                    while !Task.isCancelled {
                        try? await Task.sleep(for: .seconds(5))
                        if QAOptions.scene == "foreground" {
                            if !presentedForeground {
                                if let window = delegate.mainWindow ?? NSApp.windows.first(where: { !($0 is NSPanel) }) {
                                    delegate.mainWindow = window; window.hidesOnDeactivate = false
                                    window.deminiaturize(nil); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
                                    presentedForeground = true
                                } else { created.reopenWindow?() }
                            }
                            created.mainWindowVisible = delegate.mainWindow?.isVisible ?? false; created.updateVisibility()
                        } else {
                            delegate.mainWindow?.orderOut(nil)
                            created.mainWindowVisible = false; created.updateVisibility()
                        }
                        QAOptions.report(["event": "playback", "playing": created.player.isPlaying, "position": created.player.position, "frames": created.player.capturedFrames, "mainWindowVisible": delegate.mainWindow?.isVisible ?? false, "loading": created.player.isLoading, "diagnostics": created.player.diagnostics, "error": created.player.errorMessage ?? "", "scene": QAOptions.scene])
                    }
                }
            }
        }
        catch { startupError = error.localizedDescription }
    }
}

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    weak var mainWindow: NSWindow? { didSet { mainWindow?.delegate = self } }
    var model: AppModel?
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply { model?.shutdown(); return .terminateNow }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool { if let mainWindow { mainWindow.makeKeyAndOrderFront(nil) } else { model?.reopenWindow?() }; model?.mainWindowVisible = true; model?.updateVisibility(); return true }
    func windowWillClose(_ notification: Notification) { model?.mainWindowVisible = false; model?.updateVisibility() }
    func windowDidMiniaturize(_ notification: Notification) { model?.mainWindowVisible = false; model?.updateVisibility() }
    func windowDidDeminiaturize(_ notification: Notification) { model?.mainWindowVisible = true; model?.updateVisibility() }
    func windowDidBecomeKey(_ notification: Notification) { model?.mainWindowVisible = true; model?.updateVisibility() }
}

struct WindowObserver: NSViewRepresentable {
    var update: (NSWindow) -> Void
    func makeNSView(context: Context) -> NSView { let view = NSView(); DispatchQueue.main.async { if let window = view.window { update(window) } }; return view }
    func updateNSView(_ nsView: NSView, context: Context) { DispatchQueue.main.async { if let window = nsView.window { update(window) } } }
}

struct MenuBarControls: View {
    @Bindable var model: AppModel
    @Environment(\.openWindow) private var openWindow
    var body: some View {
        Text(model.player.currentTrack?.title ?? "BBPlayer").lineLimit(2)
        Button(model.player.isPlaybackRequested ? "暂停" : "播放") { model.player.toggle() }
        Button("上一首") { model.player.previous() }
        Button("下一首") { model.player.next() }
        Divider()
        Toggle("桌面歌词", isOn: Binding(get: { model.player.preferences.floatingLyrics }, set: { model.player.preferences.floatingLyrics = $0; model.updateVisibility() }))
        Toggle("锁定歌词（点击穿透）", isOn: Binding(get: { model.player.preferences.floatingLocked }, set: { model.player.preferences.floatingLocked = $0; model.updateVisibility() }))
        Divider()
        Button("打开 BBPlayer") { openWindow(id: "main"); NSApp.activate(ignoringOtherApps: true); model.mainWindowVisible = true; model.updateVisibility() }
        Button("退出 BBPlayer") { NSApp.terminate(nil) }.keyboardShortcut("q")
    }
}

// Explicit diagnostic launches use a disposable data root and never access Keychain.
enum QAOptions {
    static func value(_ flag: String) -> String? {
        let args = CommandLine.arguments
        guard let i = args.firstIndex(of: flag), i + 1 < args.count else { return nil }
        return args[i + 1]
    }
    static var enabled: Bool { value("--qa-root") != nil }
    static var dataRoot: URL? { value("--qa-root").map { URL(fileURLWithPath: $0, isDirectory: true) } }
    static var renderer: URL? { enabled ? value("--qa-renderer").map { URL(fileURLWithPath: $0) } : nil }
    static var scene: String { value("--qa-scene") ?? "hidden" }
    static func report(_ payload: [String: Any]) {
        guard enabled, let path = value("--qa-report"), let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]) else { return }
        try? data.write(to: URL(fileURLWithPath: path), options: .atomic)
    }
}
struct RendererCheckView: View {
    let url: URL
    @State private var failed = false
    @State private var status = "loading"
    var body: some View {
        VStack {
            SVGAView(url: url, failed: $failed, status: { status = $0; QAOptions.report(["event": $0, "timestamp": Date().timeIntervalSince1970]) }).frame(width: 480, height: 480)
            Text(failed ? "Renderer failed" : status)
        }.padding(30)
    }
}

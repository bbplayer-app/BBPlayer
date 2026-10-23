import AppKit
import BBPlayerCore
import SwiftUI

struct DanmakuControls: View {
    @AppStorage("danmaku-enabled") private var enabled = false
    @AppStorage("danmaku-font") private var fontSize = 22.0
    @AppStorage("danmaku-density") private var density = 3
    @AppStorage("danmaku-region") private var region = 0
    @AppStorage("danmaku-opacity") private var opacity = 0.7
    var body: some View {
        HStack(spacing: 8) {
            Button { enabled.toggle() } label: { Label(enabled ? "弹幕开" : "弹幕关", systemImage: "text.bubble") }.help("开关弹幕；弹幕不会拦截鼠标操作")
            Menu {
                Picker("字号", selection: $fontSize) { ForEach([16.0, 20, 22, 26, 30, 34], id: \.self) { Text("\(Int($0))").tag($0) } }
                Picker("密度", selection: $density) { Text("稀疏").tag(1); Text("适中").tag(3); Text("密集").tag(6) }
                Picker("覆盖区域", selection: $region) { Text("上方三分之一").tag(0); Text("上半区").tag(1); Text("整个播放器").tag(2) }
                Picker("不透明度", selection: $opacity) { Text("40%").tag(0.4); Text("70%").tag(0.7); Text("100%").tag(1.0) }
            } label: { Image(systemName: "slider.horizontal.3") }.help("弹幕设置")
        }.font(.caption).buttonStyle(.borderless).menuStyle(.borderlessButton)
    }
}
struct DanmakuOverlay: View {
    @Bindable var model: AppModel
    @AppStorage("danmaku-font") private var fontSize = 22.0
    @AppStorage("danmaku-density") private var density = 3
    @AppStorage("danmaku-region") private var region = 0
    @AppStorage("danmaku-opacity") private var opacity = 0.7
    @State private var flights: [DanmakuFlight] = []
    @State private var messages: [DanmakuComment] = []
    @State private var status: String?
    @State private var cachedCID: Int64?
    @State private var cache: [Int: [DanmakuComment]] = [:]
    private var segment: Int { max(1, Int(model.player.position / 360) + 1) }
    private var requestKey: String { "\(model.player.currentTrack?.id ?? "none"):\(segment)" }
    var body: some View {
        GeometryReader { geometry in
            let fraction = region == 0 ? 1.0 / 3 : region == 1 ? 0.5 : 1.0
            let laneHeight = fontSize * 1.5
            TimelineView(.animation(minimumInterval: 1 / 30, paused: !model.player.isPlaying)) { _ in
                let position = model.player.renderPosition
                Canvas { context, size in
                    context.clip(to: Path(CGRect(x: 0, y: 0, width: size.width, height: size.height * fraction)))
                    context.addFilter(.shadow(color: .black.opacity(0.9), radius: 2))
                    for flight in flights where flight.comment.time <= position && flight.end > position {
                        let rgb = flight.comment.color
                        let color = Color(red: Double((rgb >> 16) & 255) / 255, green: Double((rgb >> 8) & 255) / 255, blue: Double(rgb & 255) / 255)
                        let text = Text(flight.comment.text).font(.system(size: fontSize, weight: .semibold)).foregroundColor(color.opacity(opacity))
                        context.draw(text, at: CGPoint(x: size.width - (position - flight.comment.time) * 100, y: Double(flight.lane) * laneHeight + 4), anchor: .topLeading)
                    }
                }
            }
            if let status { Text(status).font(.caption).padding(8).background(.regularMaterial, in: Capsule()).padding(8) }
            Color.clear.task(id: LayoutKey(messages: messages, width: geometry.size.width, height: geometry.size.height, font: fontSize, density: density, region: region)) {
                let font = NSFont.systemFont(ofSize: fontSize, weight: .semibold)
                let widths = messages.map { Double(($0.text as NSString).size(withAttributes: [.font: font]).width) }
                flights = DanmakuLayout.schedule(messages, widths: widths, viewport: geometry.size.width, lanes: Int(geometry.size.height * fraction / laneHeight), density: density)
            }
        }.allowsHitTesting(false).accessibilityHidden(true)
            .task(id: requestKey) { await load() }
    }
    private struct LayoutKey: Hashable {
        let messages: [DanmakuComment]
        let width: CGFloat
        let height: CGFloat
        let font: Double
        let density: Int
        let region: Int
    }
    @MainActor private func load() async {
        guard let track = model.player.currentTrack, let cid = track.cid else { messages = []; status = "当前曲目暂无弹幕"; return }
        if cachedCID != cid { cache = [:]; cachedCID = cid; messages = [] }
        let key = requestKey, current = segment
        status = nil
        messages = [current - 1, current].flatMap { cache[$0] ?? [] }
        do {
            for page in max(1, current - 1)...current where cache[page] == nil {
                let result = try await model.api.danmaku(cid: cid, segment: page)
                try Task.checkCancellation()
                guard key == requestKey else { return }
                cache[page] = result
            }
            cache = cache.filter { abs($0.key - current) <= 1 }
            messages = [current - 1, current].flatMap { cache[$0] ?? [] }
            if messages.isEmpty { status = "这一段暂无滚动弹幕" }
        } catch {
            if !Task.isCancelled, key == requestKey { status = "弹幕加载失败；关闭再开启可重试" }
        }
    }
}

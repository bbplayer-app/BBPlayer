import BBPlayerCore
import SwiftUI

struct MiniPlayerBar: View {
    @Bindable var model: AppModel
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        VStack(spacing: 0) {
            ProgressView(value: model.player.position, total: max(1, model.player.duration)).tint(MD.accent).scaleEffect(y: 0.5)
            HStack(spacing: 14) {
                Artwork(url: model.player.currentTrack?.coverURL, radius: 10).frame(width: 52, height: 52).onTapGesture { model.showPlayer.toggle() }
                VStack(alignment: .leading, spacing: 5) {
                    Text(model.player.currentTrack?.title ?? "还没有播放歌曲").font(.headline).lineLimit(1)
                    Text(model.player.currentTrack?.artist ?? "双击歌曲开始播放").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }.frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle()).onTapGesture { model.showPlayer.toggle() }
                CircleControl(symbol: "backward.end.fill", label: "上一首") { model.player.previous() }
                CircleControl(symbol: model.player.isPlaybackRequested ? "pause.fill" : "play.fill", label: "播放 / 暂停", active: true) { model.player.toggle() }
                CircleControl(symbol: "forward.end.fill", label: "下一首") { model.player.next() }
                Image(systemName: "speaker.wave.2").foregroundStyle(.secondary)
                Slider(value: $model.player.preferences.volume, in: 0...1).frame(width: 85).accessibilityLabel("音量")
                CircleControl(symbol: "text.line.first.and.arrowtriangle.forward", label: "播放队列") { model.showQueue = true }
            }.padding(.horizontal, 22).padding(.vertical, 13)
        }.background { ZStack {
            MD.surface(scheme)
            if model.mainWindowVisible, let url = model.themes.active?.asset(remote: model.themes.variant?.properties["tail_bg"]) { AnimatedAsset(url: url).scaledToFill().clipped().opacity(0.55).allowsHitTesting(false) }
        } }
    }
}
struct PlayerView: View {
    @Bindable var model: AppModel
    @State private var lyricSearch = ""
    @State private var manualText = ""
    @State private var showMatch = false
    @AppStorage("danmaku-enabled") private var danmakuEnabled = false
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        GeometryReader { geo in
            ZStack {
                if model.player.preferences.fluidBackground && model.mainWindowVisible {
                    TimelineView(.animation(minimumInterval: 1 / 20, paused: !model.player.isPlaying)) { time in
                        let phase = time.date.timeIntervalSinceReferenceDate / 9
                        Canvas { context, size in
                            context.addFilter(.blur(radius: 60))
                            for i in 0..<3 {
                                let x = size.width * (0.5 + 0.34 * sin(phase + Double(i) * 2))
                                let y = size.height * (0.5 + 0.3 * cos(phase * 0.7 + Double(i)))
                                context.fill(Path(ellipseIn: CGRect(x: x - 150, y: y - 150, width: 300, height: 300)), with: .color([MD.accent, .purple, .cyan][i].opacity(scheme == .dark ? 0.16 : 0.10)))
                            }
                        }
                    }.allowsHitTesting(false)
                }
                HStack(spacing: 30) {
                    VStack(spacing: 18) {
                        Artwork(url: model.player.currentTrack?.coverURL, radius: 24).aspectRatio(1, contentMode: .fit).frame(maxWidth: 310).shadow(color: .black.opacity(0.12), radius: 20, y: 10)
                        VStack(spacing: 7) { Text(model.player.currentTrack?.title ?? "选择一首歌").font(.title3.bold()).lineLimit(2); Text(model.player.currentTrack?.artist ?? "BBPlayer").foregroundStyle(.secondary).lineLimit(1) }.multilineTextAlignment(.center)
                        if let info = model.player.streamInfo { Text(info.summary).font(.caption).foregroundStyle(.secondary).help("当前实际选用的音轨规格") }
                        if model.player.preferences.spectrum {
                            Canvas { context, size in
                                let bars = model.player.spectrum
                                for i in bars.indices {
                                    let width = size.width / CGFloat(bars.count)
                                    let height = max(2, CGFloat(bars[i]) * size.height)
                                    context.fill(Path(roundedRect: CGRect(x: CGFloat(i) * width, y: size.height - height, width: max(1, width - 2), height: height), cornerRadius: 2), with: .color(MD.accent.opacity(0.75)))
                                }
                            }.frame(height: 42).accessibilityLabel("实时音频频谱")
                        }
                        timeline
                        controls
                        HStack {
                            Menu("\(model.player.snapshot.rate, specifier: "%.2g")×") { ForEach([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3], id: \.self) { rate in Button("\(rate, specifier: "%.2g")×") { model.player.setRate(rate) } } }
                            Menu { Button("取消定时") { model.player.setSleepTimer(minutes: nil) }; ForEach([15, 30, 45, 60, 90], id: \.self) { minutes in Button("\(minutes) 分钟后停止") { model.player.setSleepTimer(minutes: Double(minutes)) } } } label: { Label(model.player.sleepEnd == nil ? "定时" : "已定时", systemImage: "moon.zzz") }
                            if !model.player.chapters.isEmpty { Menu("章节") { ForEach(Array(model.player.chapters.enumerated()), id: \.offset) { _, chapter in Button(chapter.title) { model.player.seek(to: chapter.start) } } } }
                        }.menuStyle(.borderlessButton)
                        if let message = model.player.errorMessage { Text(message).font(.caption).foregroundStyle(.red).lineLimit(3) }
                    }.frame(width: min(350, geo.size.width * 0.46))
                    VStack {
                        LyricScrollView(model: model)
                        HStack {
                            Button("匹配歌词") { lyricSearch = model.player.currentTrack?.title ?? ""; showMatch = true }
                            Spacer()
                            Button("−0.1s") { model.adjustLyricOffset(-0.1) }
                            Text("\(model.player.lyrics.offset + model.player.preferences.lyricOffset, specifier: "%+.1f")s").font(.caption.monospacedDigit())
                            Button("+0.1s") { model.adjustLyricOffset(0.1) }
                        }.font(.caption).buttonStyle(.borderless)
                    }.frame(maxWidth: .infinity)
                }.padding(30)
                if danmakuEnabled && model.mainWindowVisible { DanmakuOverlay(model: model) }
            }
        }.overlay(alignment: .topTrailing) { DanmakuControls().padding(10) }
        .sheet(isPresented: $showMatch) { matchSheet }
    }
    private var timeline: some View {
        VStack(spacing: 4) {
            Slider(value: Binding(get: { model.player.position }, set: { model.player.seek(to: $0) }), in: 0...max(1, model.player.duration)).accessibilityLabel("播放进度")
            HStack { Text(MD.time(model.player.position)); Spacer(); if model.player.isLoading { ProgressView().controlSize(.mini) }; Text(MD.time(model.player.duration)) }.font(.caption.monospacedDigit()).foregroundStyle(.secondary)
        }
    }
    private var controls: some View {
        HStack(spacing: 6) {
            CircleControl(symbol: "shuffle", label: "随机播放", active: model.player.snapshot.shuffled) { model.player.toggleShuffle() }
            CircleControl(symbol: "gobackward.15", label: "后退 15 秒") { model.player.jump(-15) }
            CircleControl(symbol: "backward.end.fill", label: "上一首") { model.player.previous() }
            CircleControl(symbol: model.player.isPlaybackRequested ? "pause.fill" : "play.fill", label: "播放 / 暂停", large: true) { model.player.toggle() }
            CircleControl(symbol: "forward.end.fill", label: "下一首") { model.player.next() }
            CircleControl(symbol: "goforward.15", label: "前进 15 秒") { model.player.jump(15) }
            CircleControl(symbol: model.player.snapshot.repeatMode == .track ? "repeat.1" : "repeat", label: "循环模式", active: model.player.snapshot.repeatMode != .off) { let all: [RepeatMode] = [.off, .queue, .track]; model.player.setRepeat(all[(all.firstIndex(of: model.player.snapshot.repeatMode)! + 1) % 3]) }
        }
    }
    private var matchSheet: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack { Text("手动匹配歌词").font(.title2.bold()); Spacer(); Button("完成") { showMatch = false } }
            HStack { Picker("来源", selection: $model.lyricSource) { Text("网易云").tag("netease"); Text("QQ").tag("qqmusic"); Text("酷狗").tag("kugou") }.frame(width: 140); TextField("歌名 / 歌手", text: $lyricSearch).onSubmit { Task { await model.searchLyrics(lyricSearch) } }; Button("搜索") { Task { await model.searchLyrics(lyricSearch) } } }
            List(model.lyricCandidates) { candidate in Button { Task { await model.chooseLyrics(candidate); showMatch = false } } label: { HStack { Text(candidate.title); Spacer(); Text(candidate.artist).foregroundStyle(.secondary); Text(MD.time(candidate.duration)) } }.buttonStyle(.plain) }.frame(height: 200)
            Text("或粘贴 LRC / SPL 歌词").font(.headline)
            TextEditor(text: $manualText).font(.system(.body, design: .monospaced)).frame(height: 160)
            Button("应用粘贴的歌词") { do { let parsed = LyricsParser.parse(manualText); guard !parsed.lines.isEmpty else { model.message = "没有识别到带时间戳的歌词。"; return }; try model.applyLyrics(parsed); showMatch = false } catch { model.message = error.localizedDescription } }.disabled(manualText.isEmpty)
        }.padding(24).frame(width: 650)
    }
}
struct LyricScrollView: View {
    @Bindable var model: AppModel
    private var position: Double { model.player.position + model.player.preferences.lyricOffset }
    private var index: Int? { model.player.lyrics.index(at: position) }
    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 24) {
                    if model.player.lyrics.lines.isEmpty { ContentUnavailableView("暂无歌词", systemImage: "text.quote", description: Text(model.lyricMessage ?? "正在寻找歌词，也可以手动匹配。")).frame(maxWidth: .infinity, minHeight: 220) }
                    ForEach(Array(model.player.lyrics.lines.enumerated()), id: \.offset) { i, line in
                        VStack(alignment: .leading, spacing: 6) {
                            WordLine(line: line, position: position + model.player.lyrics.offset, active: i == index).font(.system(size: i == index ? 25 : 21, weight: .bold))
                            if model.player.preferences.showRomanization, let roman = line.romanization { Text(roman).font(.subheadline).foregroundStyle(.secondary) }
                            if model.player.preferences.showTranslation, let translation = line.translation { Text(translation).font(.subheadline).foregroundStyle(.secondary) }
                        }.opacity(i == index ? 1 : 0.42).frame(maxWidth: .infinity, alignment: .leading).id(i).contentShape(Rectangle()).onTapGesture { model.player.seek(to: max(0, line.start - model.player.lyrics.offset - model.player.preferences.lyricOffset)) }
                    }
                }.padding(.vertical, 80).padding(.horizontal, 12)
            }.scrollIndicators(.hidden).onChange(of: index) { _, value in if let value { withAnimation(.easeInOut(duration: 0.35)) { proxy.scrollTo(value, anchor: .center) } } }
        }
    }
}
struct WordLine: View {
    let line: LyricLine
    let position: Double
    let active: Bool
    var body: some View {
        if line.words.isEmpty || !active { Text(line.text).foregroundStyle(active ? Color.primary : .secondary) }
        else {
            line.words.reduce(Text("")) { result, word in
                let fraction = max(0, min(1, (position - word.start) / max(0.01, word.end - word.start)))
                return result + Text(word.text).foregroundColor(fraction >= 1 ? .primary : fraction > 0 ? MD.accent : .secondary.opacity(0.55))
            }
        }
    }
}

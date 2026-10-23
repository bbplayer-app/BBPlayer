import BBPlayerCore
import SwiftUI

struct QueueView: View {
    @Bindable var model: AppModel
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack {
            HStack { Text("播放队列 · \(model.player.snapshot.queue.count)").font(.title2.bold()); Spacer(); Button("完成") { dismiss() } }.padding(20)
            List {
                ForEach(Array(model.player.snapshot.queue.enumerated()), id: \.offset) { index, track in
                    HStack {
                        Image(systemName: index == model.player.snapshot.index ? "speaker.wave.2.fill" : "music.note").foregroundStyle(MD.accent)
                        VStack(alignment: .leading) { Text(track.title).lineLimit(1); Text(track.artist).font(.caption).foregroundStyle(.secondary) }.contentShape(Rectangle()).onTapGesture(count: 2) { model.player.skip(to: index) }
                        Spacer()
                        Button { model.player.moveQueue(from: index, to: max(0, index - 1)) } label: { Image(systemName: "arrow.up") }.disabled(index == 0)
                        Button { model.player.moveQueue(from: index, to: min(model.player.snapshot.queue.count - 1, index + 1)) } label: { Image(systemName: "arrow.down") }.disabled(index == model.player.snapshot.queue.count - 1)
                        Button { model.player.removeFromQueue(at: index) } label: { Image(systemName: "xmark") }
                    }.buttonStyle(.borderless).padding(.vertical, 5)
                }
            }
        }.frame(width: 600, height: 520)
    }
}
struct DownloadsView: View {
    @Bindable var model: AppModel
    var body: some View {
        if model.downloads.jobs.isEmpty { ContentUnavailableView("还没有下载", systemImage: "arrow.down.circle", description: Text("在歌曲菜单中选择「下载离线音频」。")) }
        else {
            ScrollView {
                LazyVStack(spacing: 16) {
                    ForEach(model.downloads.jobs) { job in
                        HStack(spacing: 15) {
                            Artwork(url: job.track.coverURL).frame(width: 56, height: 56)
                            VStack(alignment: .leading, spacing: 6) {
                                Text(job.track.title).font(.headline).lineLimit(1)
                                if job.status == .downloading { ProgressView(value: job.fraction) }
                                Text(job.error ?? label(job.status)).font(.caption).foregroundStyle(job.error == nil ? Color.secondary : .red)
                                if job.total > 0 { Text("\(ByteCountFormatter.string(fromByteCount: job.received, countStyle: .file)) / \(ByteCountFormatter.string(fromByteCount: job.total, countStyle: .file))").font(.caption2).foregroundStyle(.secondary) }
                            }
                            Spacer()
                            if job.status == .completed { Button("播放") { model.play(job.track) } }
                            else if job.status == .downloading || job.status == .queued { Button("暂停") { model.downloads.pause(job.id) } }
                            else { Button(job.status == .failed ? "重试" : "继续") { model.downloads.resume(job.id) } }
                            Button(role: .destructive) { model.downloads.remove(job.id) } label: { Image(systemName: "trash") }
                        }.padding(14).background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 15))
                    }
                    if let error = model.downloads.errorMessage { Text(error).foregroundStyle(.red) }
                }.padding(25)
            }
        }
    }
    private func label(_ status: DownloadStatus) -> String { switch status { case .queued: "等待下载"; case .downloading: "正在下载"; case .paused: "已暂停"; case .completed: "可离线播放"; case .failed: "下载失败" } }
}
struct HistoryView: View {
    @Bindable var model: AppModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let summary = model.summary {
                    HStack(spacing: 35) {
                        metric("累计收听", value: String(format: "%.1f 小时", summary.seconds / 3600))
                        metric("完整播放", value: "\(summary.completed) 次")
                        metric("收听天数", value: "\(summary.days.count) 天")
                    }
                    Text("收听热力图 · 最近一年").font(.headline)
                    Heatmap(days: summary.days).frame(height: 95)
                    if model.section == .profile {
                        Text("常听排行榜").font(.title3.bold())
                        ForEach(Array(summary.ranking.enumerated()), id: \.offset) { index, entry in
                            HStack { TrackRow(model: model, track: entry.track, index: index + 1); Text(String(format: "%.0f 分钟", entry.seconds / 60)).font(.caption).foregroundStyle(.secondary).frame(width: 70) }
                        }
                    }
                }
                Text("最近播放").font(.title3.bold())
                LazyVStack { ForEach(Array(model.tracks.enumerated()), id: \.element.id) { index, track in TrackRow(model: model, track: track, index: index + 1) } }
                if model.hasMore { Button("加载更多") { model.loadMore() }.disabled(model.busy) }
            }.padding(28)
        }
    }
    private func metric(_ label: String, value: String) -> some View { VStack(alignment: .leading, spacing: 7) { Text(value).font(.title.bold()); Text(label).font(.caption).foregroundStyle(.secondary) } }
}
struct Heatmap: View {
    let days: [String: Double]
    var body: some View {
        Canvas { context, size in
            let formatter = DateFormatter(); formatter.dateFormat = "yyyy-MM-dd"; formatter.locale = Locale(identifier: "en_US_POSIX")
            let calendar = Calendar.current, end = calendar.startOfDay(for: Date()), width = min(12, size.width / 53)
            for i in 0..<365 {
                guard let date = calendar.date(byAdding: .day, value: i - 364, to: end) else { continue }
                let seconds = days[formatter.string(from: date)] ?? 0
                let color = seconds > 0 ? MD.accent.opacity(0.25 + min(0.75, seconds / 7200)) : Color.secondary.opacity(0.12)
                let rect = CGRect(x: CGFloat(i / 7) * width, y: CGFloat(i % 7) * 13, width: max(2, width - 2), height: 10)
                context.fill(Path(roundedRect: rect, cornerRadius: 2), with: .color(color))
            }
        }.accessibilityLabel("最近一年收听热力图")
    }
}
struct ImportView: View {
    @Bindable var model: AppModel
    @State private var input = ""
    @State private var source = "netease"
    @State private var replacement = ""
    @State private var editing: Int?
    @State private var candidates: [Track] = []
    @State private var onlyIssues = false
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack { Text("导入外部歌单").font(.title2.bold()); Spacer(); Button("完成") { model.player.endPreview(); dismiss() } }
            HStack { Picker("来源", selection: $source) { Text("网易云音乐").tag("netease"); Text("QQ 音乐").tag("qq") }.frame(width: 170); TextField("歌单链接或 ID", text: $input); Button("读取") { Task { await model.beginImport(input: input, source: source) } }.disabled(model.importRunning || model.busy || input.isEmpty) }
            Text("自动匹配每首间隔 1.2 秒。退出后保留进度；低置信度和失败项目须逐项确认、改选或跳过。").font(.caption).foregroundStyle(.secondary)
            if let job = model.importJob {
                HStack { Text("\(job.title) · \(job.cursor) / \(job.matches.count)").font(.headline); Spacer(); Toggle("只看待检查", isOn: $onlyIssues).toggleStyle(.checkbox); Button(model.importRunning ? "暂停" : "继续匹配") { model.importRunning ? model.pauseImport() : model.resumeImport() }.disabled(job.cursor >= job.matches.count); Button("保存歌单") { model.saveImport() }.disabled(model.importRunning || job.saved) }
                ProgressView(value: Double(job.cursor), total: Double(max(1, job.matches.count)))
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        ForEach(Array(job.matches.enumerated()), id: \.element.id) { index, match in
                            if !onlyIssues || (!match.reviewed && (match.score < 0.72 || match.track == nil)) {
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack { Text("\(index + 1). \(match.song.title)").bold(); Text(match.song.artist).foregroundStyle(.secondary); Spacer(); Text(match.reviewed ? "已确认" : "\(Int(match.score * 100))% 匹配").foregroundStyle(match.score >= 0.72 || match.reviewed ? Color.secondary : .orange) }
                                    if let track = match.track { Text("→ \(track.title) · \(track.artist)").font(.caption).lineLimit(2) }
                                    else { Text(match.error ?? "等待匹配").font(.caption).foregroundStyle(.orange) }
                                    HStack {
                                        if let track = match.track { Button("试听") { model.player.preview(track) } }
                                        Menu("候选结果") { ForEach(Array(match.candidates.enumerated()), id: \.offset) { selected, track in Button(track.title) { model.importJob?.matches[index].selected = selected; model.importJob?.matches[index].reviewed = true; model.persistImport() } } }
                                        Button("重新搜索") { editing = index; replacement = match.song.title + " " + match.song.artist; candidates = [] }
                                        Button("确认") { model.importJob?.matches[index].reviewed = true; model.persistImport() }.disabled(match.track == nil)
                                        Button("跳过") { model.importJob?.matches[index].selected = nil; model.importJob?.matches[index].reviewed = true; model.persistImport() }
                                    }.font(.caption).disabled(model.importRunning && index >= job.cursor)
                                }.padding(14).background(.quaternary.opacity(0.3), in: RoundedRectangle(cornerRadius: 12))
                            }
                        }
                    }
                }
            } else { Spacer(); ContentUnavailableView("导入并检查匹配结果", systemImage: "square.and.arrow.down", description: Text("歌曲会匹配到 B 站音频，检查后保存到本地歌单。")); Spacer() }
        }.padding(24).frame(width: 790, height: 620)
            .sheet(isPresented: Binding(get: { editing != nil }, set: { if !$0 { editing = nil } })) {
                VStack(spacing: 14) {
                    HStack { TextField("搜索 B 站", text: $replacement); Button("搜索") { Task { do { candidates = try await model.api.search(replacement) } catch { model.message = error.localizedDescription } } }; Button("完成") { editing = nil } }
                    List(candidates) { track in HStack { Text(track.title).lineLimit(2); Spacer(); Button("试听") { model.player.preview(track) }; Button("选择") { if let editing { model.importJob?.matches[editing].candidates.append(track); model.importJob?.matches[editing].selected = (model.importJob?.matches[editing].candidates.count ?? 1) - 1; model.importJob?.matches[editing].reviewed = true; model.persistImport() }; editing = nil } } }
                }.padding(24).frame(width: 650, height: 430)
            }.onDisappear { model.player.endPreview() }
    }
}

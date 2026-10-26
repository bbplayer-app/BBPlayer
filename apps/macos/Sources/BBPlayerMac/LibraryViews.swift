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
                        Image(systemName: "line.3.horizontal").foregroundStyle(.secondary).help("拖动调整播放顺序")
                        Image(systemName: index == model.player.snapshot.index ? "speaker.wave.2.fill" : "music.note").foregroundStyle(MD.accent)
                        VStack(alignment: .leading) { Text(track.title).lineLimit(1); Text(track.artist).font(.caption).foregroundStyle(.secondary) }.contentShape(Rectangle()).onTapGesture(count: 2) { model.player.skip(to: index) }
                        Spacer()
                        Button { model.player.moveQueue(from: index, to: max(0, index - 1)) } label: { Image(systemName: "arrow.up") }.disabled(index == 0)
                        Button { model.player.moveQueue(from: index, to: min(model.player.snapshot.queue.count - 1, index + 1)) } label: { Image(systemName: "arrow.down") }.disabled(index == model.player.snapshot.queue.count - 1)
                        Button { model.player.removeFromQueue(at: index) } label: { Image(systemName: "xmark") }
                    }.buttonStyle(.borderless).padding(.vertical, 5)
                }.onMove { offsets, destination in
                    model.player.moveQueue(fromOffsets: offsets, toOffset: destination)
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
                    Heatmap(days: summary.days, selectedDate: model.historyDate) { model.selectHistoryDate($0) }.frame(height: 110)
                    if model.section == .profile {
                        Text("常听排行榜").font(.title3.bold())
                        ForEach(Array(summary.ranking.enumerated()), id: \.offset) { index, entry in
                            HStack { TrackRow(model: model, track: entry.track, index: index + 1); Text(String(format: "%.0f 分钟", entry.seconds / 60)).font(.caption).foregroundStyle(.secondary).frame(width: 70) }
                        }
                    }
                }
                HStack {
                    Text(model.historyDate.map { $0.formatted(date: .abbreviated, time: .omitted) + " · 收听明细" } ?? "最近播放").font(.title3.bold())
                    Spacer()
                    DatePicker("查看日期", selection: Binding(get: { model.historyDate ?? Date() }, set: { model.selectHistoryDate($0) }), displayedComponents: .date).labelsHidden().frame(width: 140)
                    if model.historyDate != nil { Button("返回最近播放") { model.selectHistoryDate(nil) } }
                }
                if model.historyDate != nil {
                    if model.historyEvents.isEmpty && !model.busy { Text("这一天还没有收听记录。").foregroundStyle(.secondary) }
                    LazyVStack(alignment: .leading, spacing: 12) { ForEach(model.historyEvents) { event in
                        HStack {
                            Text(event.started, style: .time).font(.caption.monospacedDigit()).foregroundStyle(.secondary).frame(width: 70)
                            VStack(alignment: .leading) { Text(event.track.title); Text(event.track.artist).font(.caption).foregroundStyle(.secondary) }
                            Spacer()
                            Text("收听 \(Int(event.seconds / 60)) 分 \(Int(event.seconds) % 60) 秒").font(.caption)
                            Button("播放") { model.player.setQueue([event.track]) }
                        }
                    } }
                } else {
                    LazyVStack { ForEach(Array(model.tracks.enumerated()), id: \.element.id) { index, track in TrackRow(model: model, track: track, index: index + 1) } }
                }
                if model.hasMore { Button("加载更多") { model.loadMore() }.disabled(model.busy) }
            }.padding(28)
        }
    }
    private func metric(_ label: String, value: String) -> some View { VStack(alignment: .leading, spacing: 7) { Text(value).font(.title.bold()); Text(label).font(.caption).foregroundStyle(.secondary) } }
}
struct Heatmap: View {
    let days: [String: Double]
    var selectedDate: Date?
    var select: (Date) -> Void = { _ in }
    private var dayFormatter: DateFormatter {
        let formatter = DateFormatter(); formatter.dateFormat = "yyyy-MM-dd"; formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }
    var body: some View {
        GeometryReader { geometry in
            let formatter = dayFormatter
            let calendar = Calendar.current, end = calendar.startOfDay(for: Date())
            let start = calendar.date(byAdding: .day, value: -364, to: end)!
            let leading = (calendar.component(.weekday, from: start) - calendar.firstWeekday + 7) % 7
            let columns = (leading + 365 + 6) / 7
            let width = max(2, min(12, geometry.size.width / CGFloat(columns) - 2))
            HStack(alignment: .top, spacing: 2) {
                ForEach(0..<columns, id: \.self) { week in
                    VStack(spacing: 3) {
                        ForEach(0..<7, id: \.self) { weekday in
                            let index = week * 7 + weekday - leading
                            if (0..<365).contains(index), let date = calendar.date(byAdding: .day, value: index, to: start) {
                                let seconds = days[formatter.string(from: date)] ?? 0
                                let color = seconds > 0 ? MD.accent.opacity(0.25 + min(0.75, seconds / 7200)) : Color.secondary.opacity(0.12)
                                Button { select(date) } label: {
                                    RoundedRectangle(cornerRadius: 2).fill(color)
                                        .overlay { if let selectedDate, calendar.isDate(date, inSameDayAs: selectedDate) { RoundedRectangle(cornerRadius: 2).stroke(MD.accent, lineWidth: 2) } }
                                }.buttonStyle(.plain).frame(width: width, height: 10)
                                    .help("\(formatter.string(from: date)) · 收听 \(Int(seconds / 60)) 分钟")
                                    .accessibilityLabel("\(formatter.string(from: date))，收听 \(Int(seconds / 60)) 分钟")
                            } else { Color.clear.frame(width: width, height: 10) }
                        }
                    }
                }
            }
        }.accessibilityLabel("最近一年收听热力图")
    }
}
struct ImportView: View {
    @Bindable var model: AppModel
    @State private var input = ""
    @State private var source = "netease"
    @State private var editing: Int?
    @State private var onlyIssues = false
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack { Text("导入外部歌单").font(.title2.bold()); Spacer(); Button("完成") { model.player.endPreview(); dismiss() } }
            HStack { Picker("来源", selection: $source) { Text("网易云音乐").tag("netease"); Text("QQ 音乐").tag("qq") }.frame(width: 170); TextField("歌单链接或 ID", text: $input); Button("读取") { Task { await model.beginImport(input: input, source: source) } }.disabled(model.importRunning || model.busy || input.isEmpty) }
            Text("自动搜索请求至少间隔 4 秒；连续 5 首无结果会暂停 5 分钟。退出保留进度，重试失败项会保留已有结果。").font(.caption).foregroundStyle(.secondary)
            if let job = model.importJob {
                HStack { Text("\(job.title) · \(job.cursor) / \(job.matches.count)").font(.headline); Spacer(); Toggle("只看待检查", isOn: $onlyIssues).toggleStyle(.checkbox); Button(model.importRunning ? "暂停" : "继续匹配") { model.importRunning ? model.pauseImport() : model.resumeImport() }.disabled(job.cursor >= job.matches.count); Button("保存歌单") { model.saveImport() }.disabled(model.importRunning || job.saved) }
                HStack {
                    Button("重试失败项") { model.retryFailedImport() }.disabled(model.importRunning || job.saved || !job.hasRetryableFailures)
                    if let reason = job.pauseReason { Text(reason).font(.caption).foregroundStyle(.orange) }
                }
                if let until = job.cooldownUntil, job.pauseReason != nil {
                    Text("可在 " + until.formatted(date: .omitted, time: .standard) + " 后继续或重试；不会自动重新发起请求。").font(.caption).foregroundStyle(.secondary)
                }
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
                                        Button("重新搜索") { editing = index }
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
                if let editing, let job = model.importJob, job.matches.indices.contains(editing) {
                    ImportSearchView(api: model.api, song: job.matches[editing].song) { track in
                        if model.selectImportTrack(track, at: editing, jobID: job.id) {
                            self.editing = nil
                        }
                    } preview: { model.player.preview($0) }
                    .id(editing)
                }
            }.onDisappear { model.player.endPreview() }
    }
}


struct ImportSearchView: View {
    let api: BilibiliClient
    let song: ExternalSong
    var select: (Track) -> Void
    var preview: (Track) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var submitted = ""
    @State private var generation = 0
    @State private var searching = false
    @State private var searched = false
    @State private var candidates: [Track] = []
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("重新搜索 · \(song.title)").font(.headline)
            HStack {
                TextField("歌名、歌手或 B 站视频链接 / BV 号", text: $query).onSubmit { search() }
                Button("搜索") { search() }.disabled(query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("完成") { dismiss() }
            }
            HStack {
                Button("只搜歌名") { query = song.title; search() }
                Button("歌名和歌手") { query = song.title + " " + song.artist; search() }
            }.font(.caption)
            if searching { ProgressView("正在搜索 B 站…") }
            if let error { Text(error).foregroundStyle(.red).textSelection(.enabled) }
            if searched && !searching && error == nil && candidates.isEmpty {
                ContentUnavailableView("没有搜索结果", systemImage: "magnifyingglass", description: Text("尝试只搜歌名、减少关键词，或直接粘贴已找到的 B 站视频链接。"))
            } else {
                List(candidates) { track in
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(track.title).lineLimit(3)
                            Text(track.artist).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("试听") { preview(track) }
                        Button("选择") { select(track) }
                    }
                }
            }
        }.padding(24).frame(width: 690, height: 450)
            .onAppear { query = song.title + " " + song.artist; search() }
            .task(id: generation) {
                guard generation > 0 else { return }
                do {
                    let results = try await api.searchForImport(submitted)
                    try Task.checkCancellation()
                    candidates = results
                    searched = true
                    searching = false
                } catch {
                    guard !Task.isCancelled else { return }
                    self.error = "搜索失败：" + error.localizedDescription
                    searched = true
                    searching = false
                }
            }
    }
    private func search() {
        let input = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !input.isEmpty else { return }
        submitted = input
        candidates = []
        error = nil
        searching = true
        generation += 1
    }
}

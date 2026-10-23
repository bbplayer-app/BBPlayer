import AppKit
import BBPlayerCore
import SwiftUI

struct RootView: View {
    @Bindable var model: AppModel
    @Environment(\.colorScheme) private var scheme
    @Environment(\.openWindow) private var openWindow
    @State private var newTitle = ""
    @State private var renaming: Playlist?
    @State private var deleting: Playlist?
    @State private var selectingTracks = false
    @State private var selectedTracks = Set<String>()
    @AppStorage("sidebar-width") private var sidebarWidth = 224.0
    @State private var sidebarDragStart: Double?
    @State private var splashURL: URL?
    @State private var didLoadSplash = false
    private let main: [LibrarySection] = [.search, .playlists, .favorites, .collections, .multipart]
    private let personal: [LibrarySection] = [.following, .watchLater, .downloads, .history, .profile]
    var body: some View {
        HStack(spacing: 0) {
            sidebar.frame(width: min(300, max(180, sidebarWidth)))
            Rectangle().fill(Color.secondary.opacity(0.15)).frame(width: 5)
                .contentShape(Rectangle()).help("拖动调整侧栏宽度，双击还原")
                .gesture(DragGesture(minimumDistance: 1).onChanged { value in
                    if sidebarDragStart == nil { sidebarDragStart = sidebarWidth }
                    sidebarWidth = min(300, max(180, (sidebarDragStart ?? 224) + value.translation.width))
                }.onEnded { _ in sidebarDragStart = nil })
                .onTapGesture(count: 2) { sidebarWidth = 224 }
                .accessibilityLabel("侧栏宽度")
                .accessibilityAdjustableAction { direction in
                    switch direction { case .increment: sidebarWidth = min(300, sidebarWidth + 10); case .decrement: sidebarWidth = max(180, sidebarWidth - 10); @unknown default: break }
                }
            VStack(spacing: 0) {
                header
                ZStack { if model.showPlayer { PlayerView(model: model) } else { content } }.frame(maxWidth: .infinity, maxHeight: .infinity)
                MiniPlayerBar(model: model)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let deleted = model.deletedPlaylist {
                HStack {
                    Text("已删除「\(deleted.title)」").lineLimit(1).help(deleted.title)
                    Spacer()
                    Button("撤销删除") { model.undoPlaylistDeletion() }
                }.padding(.horizontal, 24).padding(.vertical, 12).background(.regularMaterial)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if let splashURL {
                VStack(spacing: 8) {
                    AnimatedAsset(url: splashURL).id(splashURL).frame(width: 230, height: 300).clipShape(RoundedRectangle(cornerRadius: 18)).allowsHitTesting(false)
                    HStack { Text("装扮开屏").font(.caption).foregroundStyle(.secondary); Spacer(); Button("跳过") { self.splashURL = nil } }
                }.padding(14).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22)).frame(width: 260).padding(18)
            }
        }
        .task {
            guard !didLoadSplash else { return }; didLoadSplash = true
            splashURL = model.themes.active?.asset(role: "video", index: model.themes.splashIndex) ?? model.themes.active?.asset(role: "splash", index: model.themes.splashIndex)
            try? await Task.sleep(for: .seconds(8)); splashURL = nil
        }
        .onChange(of: model.mainWindowVisible) { _, visible in if !visible { splashURL = nil } }
        .background(MD.background(scheme))
        .tint(Color(hex: model.themes.variant?.properties["color"]))
        .preferredColorScheme(model.player.preferences.appearance == "system" ? nil : model.player.preferences.appearance == "dark" ? .dark : .light)
        .sheet(isPresented: $model.showLogin) { LoginView(model: model) }
        .sheet(isPresented: $model.showImport) { ImportView(model: model) }
        .sheet(isPresented: $model.showQueue) { QueueView(model: model) }
        .sheet(isPresented: $model.showNewPlaylist) {
            VStack(alignment: .leading, spacing: 18) {
                Text(renaming == nil ? "新建播放列表" : "重命名歌单").font(.title2.bold())
                TextField("歌单名称", text: $newTitle).textFieldStyle(.roundedBorder).onSubmit(createPlaylist)
                HStack { Button("取消") { model.showNewPlaylist = false }; Spacer(); Button(renaming == nil ? "创建" : "保存", action: createPlaylist).buttonStyle(MDButtonStyle(prominent: true)).disabled(newTitle.trimmingCharacters(in: .whitespaces).isEmpty) }
            }.padding(28).frame(width: 380)
        }
        .alert("删除歌单？", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), presenting: deleting) { playlist in
            Button("取消", role: .cancel) { deleting = nil }
            Button("删除歌单", role: .destructive) { deleting = nil; model.deletePlaylist(playlist) }
        } message: { playlist in
            Text("将删除「\(playlist.title)」及其歌曲列表。可撤销最近一次删除；再次删除歌单将替换恢复记录。已下载的音频不会删除。")
        }
        .alert("BBPlayer", isPresented: Binding(get: { model.message != nil }, set: { if !$0 { model.message = nil } })) { Button("好") { model.message = nil } } message: { Text(model.message ?? "") }
        .onAppear { let action = openWindow; model.reopenWindow = { action(id: "main") } }
        .onChange(of: model.showPlayer) { _, _ in model.updateVisibility() }
        .onChange(of: model.section) { _, _ in selectedTracks = []; selectingTracks = false }
        .onChange(of: model.openedPlaylist?.id) { _, _ in selectedTracks = []; selectingTracks = false }
        .onChange(of: model.player.preferences.floatingLyrics) { _, _ in model.updateVisibility() }
        .onChange(of: model.player.preferences.floatingLocked) { _, _ in model.updateVisibility() }
    }
    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 10) { Image(systemName: "waveform.circle.fill").font(.system(size: 29)).foregroundStyle(MD.accent); Text("BBPlayer").font(.system(size: 22, weight: .bold, design: .rounded)) }.padding(.top, 42).padding(.bottom, 22).padding(.leading, 14)
            ScrollView { VStack(alignment: .leading, spacing: 5) {
            ForEach(main) { destination in navigation(destination) }
            Text("我的内容").font(.caption.weight(.semibold)).foregroundStyle(.secondary).padding(.top, 22).padding(.leading, 18).padding(.bottom, 5)
            ForEach(personal) { destination in navigation(destination) }
            navigation(.localFiles).disabled(true).help("本地音频文件将在后续接入")
            } }.scrollIndicators(.hidden)
            Spacer(minLength: 4)
            navigation(.themes)
            navigation(.settings)
            HStack(spacing: 10) {
                Artwork(url: model.profile?.avatarURL, radius: 18).frame(width: 34, height: 34)
                    .overlay { if model.mainWindowVisible, let url = model.themes.active?.asset(role: "avatar", index: model.themes.avatarIndex) { AnimatedAsset(url: url).frame(width: 45, height: 45).allowsHitTesting(false) } }
                VStack(alignment: .leading, spacing: 3) { Text(model.profile?.name ?? "登录 Bilibili").font(.subheadline.weight(.medium)).lineLimit(1); Text(model.profile == nil ? "读取收藏夹和关注" : "Bilibili 账号").font(.caption2).foregroundStyle(.secondary) }
            }.padding(12).frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle()).onTapGesture { model.showLogin = true }
        }.padding(.horizontal, 10).padding(.bottom, 12)
            .background { if model.mainWindowVisible, let url = model.themes.active?.asset(remote: model.themes.variant?.properties["side_bg"]) { AnimatedAsset(url: url).scaledToFill().clipped().opacity(0.4).allowsHitTesting(false) } }
            .background(MD.surface(scheme).opacity(0.65))
    }
    private func navigation(_ destination: LibrarySection) -> some View {
        Button { model.showPlayer = false; model.navigate(destination) } label: {
            HStack(spacing: 12) {
                if model.mainWindowVisible, let url = sidebarIcon(destination) { AnimatedAsset(url: url).frame(width: 28, height: 28) }
                else { Image(systemName: destination.symbol).font(.system(size: 21)).frame(width: 28) }
                Text(destination.title).font(.system(size: 15, weight: model.section == destination ? .semibold : .regular))
                Spacer()
            }.padding(.horizontal, 16).frame(maxWidth: .infinity, minHeight: 50).contentShape(Rectangle())
                .background(model.section == destination && !model.showPlayer ? MD.container(scheme) : .clear, in: Capsule())
        }.buttonStyle(.plain)
    }
    private func sidebarIcon(_ section: LibrarySection) -> URL? {
        let key = section == .search ? "tail_icon_main" : section == .playlists ? "tail_icon_dynamic" : section == .profile ? "tail_icon_myself" : ""
        let selected = key.replacingOccurrences(of: "tail_icon_", with: "tail_icon_selected_")
        return model.themes.active?.asset(remote: model.themes.variant?.properties[model.section == section ? selected : key])
    }
    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                if model.showPlayer { Button { model.showPlayer = false } label: { Image(systemName: "chevron.down").font(.title3) }.buttonStyle(.plain) }
                else if model.openedPlaylist != nil || model.followedUploader != nil { Button { model.openedPlaylist = nil; model.followedUploader = nil; model.loadSection() } label: { Image(systemName: "chevron.left").font(.title3) }.buttonStyle(.plain) }
                Text(model.showPlayer ? "正在播放" : model.openedPlaylist?.title ?? model.followedUploader?.name ?? model.section.title).font(.system(size: 27, weight: .bold, design: .rounded)).lineLimit(1)
                Spacer()
                if model.busy { if model.mainWindowVisible, let url = model.themes.active?.asset(role: "loading") { AnimatedAsset(url: url).frame(width: 30, height: 30) } else { ProgressView().controlSize(.small) } }
                if model.section == .playlists && !model.showPlayer {
                    Button { model.showImport = true } label: { Label("导入歌单", systemImage: "square.and.arrow.down") }.buttonStyle(MDButtonStyle())
                    Button { renaming = nil; newTitle = ""; model.showNewPlaylist = true } label: { Image(systemName: "plus") }.buttonStyle(MDButtonStyle())
                }
                Button { model.loadSection() } label: { Image(systemName: "arrow.clockwise") }.buttonStyle(.plain).help("刷新")
            }
            if model.section == .search && !model.showPlayer {
                HStack(spacing: 12) {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("搜索歌曲、BV / AV 号或 B 站链接", text: $model.query).textFieldStyle(.plain).onSubmit { model.loadSection() }
                    if !model.query.isEmpty { Button { model.query = ""; model.tracks = [] } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }.buttonStyle(.plain) }
                    Toggle("本地曲库", isOn: $model.searchLocal).toggleStyle(.checkbox).font(.caption).onChange(of: model.searchLocal) { _, _ in model.loadSection() }
                    Button("搜索") { model.loadSection() }.buttonStyle(.plain).foregroundStyle(MD.accent)
                }.padding(.horizontal, 20).padding(.vertical, 15).background(MD.surface(scheme), in: Capsule())
            }
            if model.openedPlaylist?.kind == "local" && !model.showPlayer {
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("在此歌单中搜索歌名或歌手", text: $model.playlistQuery)
                        .onChange(of: model.playlistQuery) { _, _ in selectedTracks = []; model.loadSection() }
                    if !model.playlistQuery.isEmpty { Button("清除") { model.playlistQuery = "" } }
                }.textFieldStyle(.roundedBorder)
            }
        }.padding(.horizontal, 30).padding(.top, 37).padding(.bottom, 20)
            .background(alignment: .top) { if model.mainWindowVisible, let url = model.themes.active?.asset(remote: model.themes.variant?.properties[model.section == .profile ? "head_myself_mp4_bg" : "head_bg"] ?? model.themes.variant?.properties["head_bg"]) { AnimatedAsset(url: url).scaledToFill().frame(height: 145).clipped().opacity(0.55).allowsHitTesting(false) } }
    }
    @ViewBuilder private var content: some View {
        switch model.section {
        case .settings: SettingsView(model: model)
        case .themes: ThemesView(model: model)
        case .downloads: DownloadsView(model: model)
        case .history, .profile: HistoryView(model: model)
        default:
            if !model.playlists.isEmpty && model.openedPlaylist == nil { playlistGrid }
            else if !model.following.isEmpty { followingList }
            else if model.tracks.isEmpty && !model.busy { emptyContent }
            else { trackList }
        }
    }
    private var playlistGrid: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 160, maximum: 220), spacing: 22)], alignment: .leading, spacing: 24) {
                ForEach(model.playlists) { playlist in
                    Button { model.open(playlist) } label: {
                        VStack(alignment: .leading, spacing: 9) {
                            Artwork(url: playlist.coverURL).aspectRatio(1, contentMode: .fit)
                            Text(playlist.title).font(.headline).lineLimit(2)
                            Text("\(playlist.count) 首歌曲").font(.caption).foregroundStyle(.secondary)
                        }.contentShape(Rectangle())
                    }.buttonStyle(.plain).contextMenu { if playlist.kind == "local" { Button("重命名") { renaming = playlist; newTitle = playlist.title; model.showNewPlaylist = true }; Button("删除歌单", role: .destructive) { deleting = playlist } } }
                }
            }.padding(30)
            moreButton
        }
    }
    private var followingList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(model.following) { person in
                    Button { model.openFollowing(person) } label: { HStack(spacing: 14) { Artwork(url: person.avatar, radius: 28).frame(width: 48, height: 48); Text(person.name).font(.headline); Spacer(); Image(systemName: "chevron.right").foregroundStyle(.secondary) }.padding(10).contentShape(Rectangle()) }.buttonStyle(.plain)
                }
            }.padding(.horizontal, 25)
            moreButton
        }
    }
    private var trackList: some View {
        VStack(spacing: 10) {
            HStack {
                let local = model.openedPlaylist?.kind == "local"
                let filtered = local && !model.playlistQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                Button(local ? (filtered ? "播放筛选结果" : "播放全部") : "播放已加载") { model.playCollection() }
                Menu("更多") {
                    Button(local ? (filtered ? "筛选结果加入队列" : "全部加入队列") : "已加载歌曲加入队列") { model.enqueueCollection() }
                    Button(local ? (filtered ? "下载筛选结果" : "下载全部离线音频") : "下载已加载歌曲") { model.downloadCollection() }
                }
                Spacer()
                if selectingTracks {
                    Button("全选已加载") { selectedTracks = Set(model.tracks.map(\.id)) }
                    Menu("批量操作（\(selectedTracks.count)）") {
                        Button("加入播放队列") { model.player.enqueue(selection) }
                        Button("下载离线音频") { model.downloads.add(selection) }
                        Menu("添加到歌单") { ForEach(model.localPlaylists) { playlist in
                            Button(playlist.title) { model.add(selection, to: playlist) }
                        } }
                    }.disabled(selection.isEmpty)
                }
                Button(selectingTracks ? "完成选择" : "多选") { selectingTracks.toggle(); selectedTracks = [] }
            }.buttonStyle(.borderless).padding(.horizontal, 30).disabled(model.tracks.isEmpty || model.busy)
            ScrollView {
                LazyVStack(spacing: 2) {
                    ForEach(Array(model.tracks.enumerated()), id: \.element.id) { index, track in
                        HStack(spacing: 0) {
                            if selectingTracks {
                                Toggle("选择 \(track.title)", isOn: Binding(get: { selectedTracks.contains(track.id) }, set: { if $0 { selectedTracks.insert(track.id) } else { selectedTracks.remove(track.id) } })).toggleStyle(.checkbox).labelsHidden()
                            }
                            TrackRow(model: model, track: track, index: index + 1)
                        }
                    }
                }.padding(.horizontal, 20)
                moreButton
            }
        }
    }
    private var selection: [Track] { model.tracks.filter { selectedTracks.contains($0.id) } }
    @ViewBuilder private var moreButton: some View { if model.hasMore { Button(model.busy ? "加载中…" : "加载更多") { model.loadMore() }.buttonStyle(MDButtonStyle()).disabled(model.busy).padding(20) } }
    private var emptyContent: some View {
        if model.openedPlaylist?.kind == "local", !model.playlistQuery.isEmpty {
            return ContentUnavailableView("没有匹配的歌曲", systemImage: "magnifyingglass", description: Text("试试其他歌名或歌手，或清除歌单搜索。"))
        }
        return ContentUnavailableView(model.section == .search ? "从一首喜欢的歌开始" : "这里暂时没有内容", systemImage: model.section.symbol,
            description: Text(model.section == .search ? "搜索 B 站歌曲，或粘贴视频链接。" : model.section == .multipart ? "在歌曲菜单中选择「展开分 P」，即可记住多 P 视频。" : "登录 Bilibili、创建歌单，或刷新重试。"))
    }
    private func createPlaylist() {
        if let renaming { do { try model.database.renamePlaylist(renaming.id, title: newTitle); model.loadSection() } catch { model.message = error.localizedDescription } }
        else { model.createPlaylist(newTitle) }
        renaming = nil; newTitle = ""; model.showNewPlaylist = false
    }
}

struct TrackRow: View {
    @Bindable var model: AppModel
    let track: Track
    let index: Int
    @Environment(\.colorScheme) private var scheme
    @State private var hovered = false
    var body: some View {
        HStack(spacing: 14) {
            Text(String(index)).font(.caption.monospacedDigit()).foregroundStyle(.secondary).frame(width: 26)
            Artwork(url: track.coverURL, radius: 8).frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 5) { Text(track.title).font(.system(size: 13, weight: .medium)).lineLimit(1); Text(track.artist.nonEmpty ?? track.bvid).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
            Spacer(minLength: 10)
            Text(MD.time(track.duration)).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            Button { model.player.enqueue(track, next: true) } label: { Image(systemName: "text.line.first.and.arrowtriangle.forward") }.buttonStyle(.plain).help("下一首播放").opacity(hovered ? 1 : 0)
            Menu { actions } label: { Image(systemName: "ellipsis") }.menuStyle(.borderlessButton).frame(width: 24)
        }.padding(.horizontal, 10).padding(.vertical, 8)
            .background(hovered ? MD.surface(scheme) : .clear, in: RoundedRectangle(cornerRadius: 12))
            .contentShape(Rectangle()).onTapGesture(count: 2) { model.play(track) }.onHover { hovered = $0 }.contextMenu { actions }
    }
    private func move(in playlist: Playlist, forward: Bool) { do { try model.database.moveTrack(track.id, in: playlist.id, forward: forward); model.loadSection() } catch { model.message = error.localizedDescription } }
    @ViewBuilder private var actions: some View {
        Button("播放") { model.play(track) }
        Button("下一首播放") { model.player.enqueue(track, next: true) }
        Button("加入播放队列") { model.player.enqueue(track) }
        Menu("添加到歌单") { ForEach(model.localPlaylists) { playlist in Button(playlist.title) { model.add(track, to: playlist) } } }
        Button("下载离线音频") { model.downloads.add(track) }
        Button("展开分 P") { model.expandPages(track) }
        if let url = URL(string: "https://www.bilibili.com/video/" + track.bvid) { Link("在 B 站打开", destination: url) }
        if let playlist = model.openedPlaylist, playlist.kind == "local" { Divider()
            Button("在歌单中上移") { move(in: playlist, forward: false) }
            Button("在歌单中下移") { move(in: playlist, forward: true) }
            Button("从歌单移除", role: .destructive) { model.remove(track, from: playlist) } }
    }
}

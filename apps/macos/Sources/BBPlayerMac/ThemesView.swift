import BBPlayerCore
import SwiftUI

struct ThemesView: View {
    @Bindable var model: AppModel
    @State private var keyword = ""
    @State private var searching = false
    @State private var preview: InstalledTheme?
    @State private var previewAsset: URL?
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack { TextField("搜索 B 站装扮 / 收藏集", text: $keyword).textFieldStyle(.roundedBorder).onSubmit(search); Button(searching ? "搜索中…" : "搜索", action: search).disabled(searching || keyword.isEmpty) }
                if let progress = model.themes.progress { ProgressView(model.themes.status, value: progress) }
                Text("已下载装扮").font(.title3.bold())
                Button("使用默认主题") { model.themes.apply(nil) }.buttonStyle(MDButtonStyle())
                ForEach(model.themes.installed) { theme in
                    HStack(spacing: 16) {
                        Artwork(url: theme.asset(role: "card") ?? theme.asset(role: "background")).frame(width: 90, height: 65)
                        VStack(alignment: .leading, spacing: 5) { Text(theme.name).font(.headline); Text("\(theme.assets.count) 个资源 · \(theme.variants.count) 个主题样式").font(.caption).foregroundStyle(.secondary) }
                        Spacer(); Button("预览") { preview = theme }; Button(model.themes.active?.id == theme.id ? "使用中" : "应用") { model.themes.apply(theme) }.disabled(model.themes.active?.id == theme.id)
                        Button(role: .destructive) { do { try model.themes.uninstall(theme) } catch { model.message = error.localizedDescription } } label: { Image(systemName: "trash") }
                    }.padding(12).background(.quaternary.opacity(0.3), in: RoundedRectangle(cornerRadius: 14))
                }
                if let theme = model.themes.active {
                    if !theme.variants.isEmpty { Picker("主题样式", selection: $model.themes.variantIndex) { ForEach(Array(theme.variants.enumerated()), id: \.offset) { index, variant in Text(variant.name).tag(index) } } }
                    resourcePicker("头像框", theme: theme, role: "avatar", selection: $model.themes.avatarIndex)
                    resourcePicker("开屏", theme: theme, role: "splash", selection: $model.themes.splashIndex)
                }
                if !model.themeResults.isEmpty {
                    Text("搜索结果").font(.title3.bold())
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 170), spacing: 20)], spacing: 24) {
                        ForEach(model.themeResults) { item in
                            VStack(alignment: .leading, spacing: 10) {
                                Artwork(url: item.cover).aspectRatio(0.8, contentMode: .fit)
                                Text(item.name).font(.headline).lineLimit(2)
                                Button(model.themes.installed.contains { $0.id == item.id } ? "重新下载" : "下载装扮") { Task { do { try await model.themes.install(item) } catch { model.message = error.localizedDescription } } }.disabled(model.themes.progress != nil)
                            }
                        }
                    }
                }
                Text("点赞动画仅在预览中展示；首版没有 B 站点赞或投币操作。").font(.caption).foregroundStyle(.secondary)
            }.padding(28)
        }.sheet(item: $preview) { theme in
            VStack(alignment: .leading, spacing: 16) {
                HStack { Text(theme.name).font(.title2.bold()); Spacer(); Button("完成") { previewAsset = nil; preview = nil } }
                HStack {
                    ScrollView { LazyVStack(alignment: .leading) { ForEach(theme.assets) { asset in Button("\(asset.role) · \(asset.name)") { previewAsset = theme.root.appendingPathComponent(asset.filename) }.buttonStyle(.plain).padding(8) } } }.frame(width: 220)
                    ZStack { RoundedRectangle(cornerRadius: 18).fill(.quaternary.opacity(0.4)); if model.mainWindowVisible, let previewAsset { AnimatedAsset(url: previewAsset).id(previewAsset).padding(15) } else { Text("选择资源预览").foregroundStyle(.secondary) } }.frame(maxWidth: .infinity)
                }
            }.padding(24).frame(width: 760, height: 540)
        }
    }
    @ViewBuilder private func resourcePicker(_ title: String, theme: InstalledTheme, role: String, selection: Binding<Int>) -> some View {
        let resources = theme.assets.filter { $0.role == role }
        if resources.count > 1 { Picker(title, selection: selection) { ForEach(Array(resources.enumerated()), id: \.offset) { index, asset in Text("\(index + 1). \(asset.name)").tag(index) } } }
    }
    private func search() { guard !searching else { return }; searching = true; Task { defer { searching = false }; do { model.themeResults = try await model.themes.search(keyword) } catch { model.message = error.localizedDescription } } }
}

import BBPlayerCore
import SwiftUI

struct SettingsView: View {
    @Bindable var model: AppModel
    @State private var cacheSize: Int64 = 0
    var body: some View {
        Form {
            Section("播放") {
                Toggle("根据 B 站响度元数据均衡音量", isOn: $model.player.preferences.normalization)
                Text("缺少响度数据时保持原始音量；优先使用最高可用常规 AAC。").font(.caption).foregroundStyle(.secondary)
                Toggle("启动后自动播放恢复的队列", isOn: $model.player.preferences.autoplay)
                Text("默认关闭。关闭主窗口后继续播放，从菜单栏唤回；退出应用停止播放。").font(.caption).foregroundStyle(.secondary)
            }
            Section("歌词") {
                Toggle("桌面悬浮歌词", isOn: $model.player.preferences.floatingLyrics)
                Toggle("锁定并点击穿透", isOn: $model.player.preferences.floatingLocked)
                Toggle("显示翻译", isOn: $model.player.preferences.showTranslation)
                Toggle("显示罗马音", isOn: $model.player.preferences.showRomanization)
                HStack { Text("歌词偏移"); Spacer(); TextField("秒", value: $model.player.preferences.lyricOffset, format: .number.precision(.fractionLength(1))).frame(width: 80); Text("秒") }
            }
            Section("视觉") {
                Picker("外观", selection: $model.player.preferences.appearance) { Text("跟随系统").tag("system"); Text("浅色").tag("light"); Text("深色").tag("dark") }
                Toggle("实时音频频谱", isOn: $model.player.preferences.spectrum)
                Toggle("流光背景", isOn: $model.player.preferences.fluidBackground)
                Text("主窗口不可见时停止绘制，已打开的桌面歌词独立更新。").font(.caption).foregroundStyle(.secondary)
            }
            Section("临时音频缓存") {
                Toggle("预取下一首（最多 1 MiB）", isOn: Binding(get: { model.player.preferences.cacheLimit > 0 && model.player.preferences.prefetchNextTrack != false }, set: { model.player.preferences.prefetchNextTrack = $0 }))
                    .disabled(model.player.preferences.cacheLimit == 0)
                Text("当前播放稳定后准备下一首；缓冲不足时优先当前歌曲。设为不保留缓存时不预取。").font(.caption).foregroundStyle(.secondary)
                Picker("容量上限", selection: $model.player.preferences.cacheLimit) { ForEach([0, 256, 512, 1024, 2048, 4096], id: \.self) { mb in Text(mb == 0 ? "不保留" : "\(mb) MB").tag(Int64(mb) * 1024 * 1024) } }
                HStack { Text("已用 \(ByteCountFormatter.string(fromByteCount: cacheSize, countStyle: .file))"); Spacer(); Button("清空临时缓存") { Task { do { try await model.cache.clear(); cacheSize = try await model.cache.size() } catch { model.message = error.localizedDescription } } } }
                Text("手动下载、装扮和播放历史单独保存，清空临时缓存不会删除这些内容。").font(.caption).foregroundStyle(.secondary)
            }
            Section("本机数据") {
                if model.credentialsNeedUnlock { Button("解锁已保存的登录") { Task { await model.restoreLogin(allowInteraction: true) } } }
                Text("歌单、历史、偏好保存在本机 SQLite；凭据使用 Keychain。需要授权时，点击解锁入口后才会显示系统提示。首版不上传统计，不启用跨设备同步。").font(.callout).foregroundStyle(.secondary)
            }
        }.formStyle(.grouped).task { cacheSize = (try? await model.cache.size()) ?? 0 }
    }
}

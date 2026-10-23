import BBPlayerCore
import CoreImage.CIFilterBuiltins
import SwiftUI

struct LoginView: View {
    @Bindable var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var cookie = ""
    @State private var qrImage: NSImage?
    @State private var qrState = "正在生成二维码…"
    @State private var generation = UUID()
    @State private var error: String?
    @State private var busy = false
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack { Text(model.profile == nil ? "登录 Bilibili" : "Bilibili 账号").font(.title2.bold()); Spacer(); Button("完成") { dismiss() } }
            if let profile = model.profile {
                HStack { Artwork(url: profile.avatarURL).frame(width: 64, height: 64); Text(profile.name).font(.title3); Spacer(); Button("退出登录", role: .destructive) { Task { await model.logout() } } }
            } else {
                HStack {
                    Spacer()
                    VStack(spacing: 12) {
                        if let qrImage { Image(nsImage: qrImage).interpolation(.none).resizable().frame(width: 190, height: 190).padding(12).background(.white, in: RoundedRectangle(cornerRadius: 12)) }
                        else { ProgressView().frame(width: 214, height: 214) }
                        Text(qrState).font(.callout)
                        Button("刷新二维码") { generation = UUID() }
                    }
                    Spacer()
                }
                DisclosureGroup("备用：使用 Cookie 登录") {
                    VStack(alignment: .leading, spacing: 10) {
                        SecureField("粘贴 Cookie", text: $cookie).textFieldStyle(.roundedBorder)
                        Text("仅保存在本机 Keychain，不写入歌单或日志。").font(.caption).foregroundStyle(.secondary)
                        Button(busy ? "验证中…" : "验证并登录") { Task { busy = true; defer { busy = false }; do { try await model.login(cookie: cookie); cookie = "" } catch { self.error = error.localizedDescription } } }.disabled(busy || cookie.isEmpty)
                    }.padding(.top, 10)
                }
            }
            if let error { Text(error).foregroundStyle(.red).font(.caption) }
        }.padding(28).frame(width: 460)
            .task(id: generation) { await poll() }
    }
    private func poll() async {
        guard model.profile == nil else { return }
        qrImage = nil; error = nil; qrState = "正在生成二维码…"
        do {
            let qr = try await model.api.generateQR(); try Task.checkCancellation()
            let filter = CIFilter.qrCodeGenerator(); filter.message = Data(qr.url.absoluteString.utf8)
            if let image = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 8, y: 8)), let cg = CIContext().createCGImage(image, from: image.extent) { qrImage = NSImage(cgImage: cg, size: NSSize(width: 190, height: 190)) }
            qrState = "使用哔哩哔哩 App 扫码"
            for _ in 0..<100 {
                try await Task.sleep(for: .seconds(2)); let status = try await model.api.pollQR(qr.key); try Task.checkCancellation()
                switch status {
                case .waiting: break
                case .scanned: qrState = "已扫码，请在手机上确认"
                case .expired: qrState = "二维码已过期，请刷新"; return
                case .success(let cookie): try await model.login(cookie: cookie); return
                }
            }
            qrState = "二维码已过期，请刷新"
        } catch is CancellationError { } catch { self.error = error.localizedDescription; qrState = "二维码加载失败" }
    }
}

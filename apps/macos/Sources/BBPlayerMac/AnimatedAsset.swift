import AVKit
import SwiftUI
import WebKit

struct AnimatedAsset: View {
    let url: URL
    @State private var failure = false
    var body: some View {
        Group {
            if url.pathExtension.lowercased() == "svga" {
                if failure { Image(systemName: "exclamationmark.triangle").help("此 SVGA 资源无法播放") }
                else { SVGAView(url: url, failed: $failure) }
            } else if ["mp4", "mov", "m4v"].contains(url.pathExtension.lowercased()) { MutedVideo(url: url) }
            else if ["gif", "webp"].contains(url.pathExtension.lowercased()) { AnimatedImage(url: url) }
            else { Artwork(url: url, radius: 0) }
        }.task(id: url) { failure = false }
    }
}
struct MutedVideo: NSViewRepresentable {
    let url: URL
    final class Coordinator { var player: AVQueuePlayer?; var looper: AVPlayerLooper? }
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeNSView(context: Context) -> AVPlayerView {
        let view = AVPlayerView(); view.controlsStyle = .none; view.videoGravity = .resizeAspect
        let player = AVQueuePlayer(); player.isMuted = true
        context.coordinator.player = player; context.coordinator.looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: url)); view.player = player; player.play()
        return view
    }
    func updateNSView(_ view: AVPlayerView, context: Context) { }
    static func dismantleNSView(_ view: AVPlayerView, coordinator: Coordinator) { coordinator.player?.pause(); coordinator.looper?.disableLooping(); coordinator.player?.removeAllItems(); view.player = nil }
}
struct AnimatedImage: NSViewRepresentable {
    let url: URL
    func makeNSView(context: Context) -> NSImageView { let view = NSImageView(); view.imageScaling = .scaleProportionallyUpOrDown; view.animates = true; view.image = NSImage(contentsOf: url); return view }
    func updateNSView(_ view: NSImageView, context: Context) { }
    static func dismantleNSView(_ view: NSImageView, coordinator: ()) { view.animates = false; view.image = nil }
}
private enum RendererResources {
    static var bundle: Bundle {
        #if SWIFT_PACKAGE
        Bundle.module
        #else
        Bundle.main
        #endif
    }
    static func file(_ name: String) -> URL? { bundle.url(forResource: name, withExtension: nil, subdirectory: "Renderer") ?? bundle.url(forResource: name, withExtension: nil) }
}
struct SVGAView: NSViewRepresentable {
    let url: URL
    @Binding var failed: Bool
    var status: ((String) -> Void)? = nil
    final class Coordinator: NSObject, WKURLSchemeHandler, WKScriptMessageHandler, WKNavigationDelegate {
        let asset: URL
        var status: ((String) -> Void)?
        var failure: () -> Void
        init(asset: URL, status: ((String) -> Void)?, failure: @escaping () -> Void) { self.asset = asset; self.status = status; self.failure = failure }
        func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
            guard let url = urlSchemeTask.request.url, url.host == "renderer" else { urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile)); return }
            let name = url.lastPathComponent
            let allowed = ["index.html", "static-svga.js", "svga.min.js", "jszip.min.js", "jszip-utils.min.js"]
            guard name == "asset.svga" || allowed.contains(name), let file = name == "asset.svga" ? asset : RendererResources.file(name), let data = try? Data(contentsOf: file) else { urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist)); return }
            let mime = name.hasSuffix("html") ? "text/html" : name.hasSuffix("js") ? "application/javascript" : "application/octet-stream"
            urlSchemeTask.didReceive(URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: "utf-8")); urlSchemeTask.didReceive(data); urlSchemeTask.didFinish()
        }
        func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) { }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) { if let value = message.body as? String { status?(value); if value == "error" { failure() } } }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) { decisionHandler(navigationAction.request.url?.scheme == "bbp-theme" ? .allow : .cancel) }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failure() }
    }
    func makeCoordinator() -> Coordinator { Coordinator(asset: url, status: status) { failed = true } }
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent(); config.setURLSchemeHandler(context.coordinator, forURLScheme: "bbp-theme")
        config.userContentController.add(context.coordinator, name: "status")
        let view = WKWebView(frame: .zero, configuration: config); view.navigationDelegate = context.coordinator; view.setValue(false, forKey: "drawsBackground")
        view.load(URLRequest(url: URL(string: "bbp-theme://renderer/index.html")!)); return view
    }
    func updateNSView(_ view: WKWebView, context: Context) { }
    static func dismantleNSView(_ view: WKWebView, coordinator: Coordinator) { view.evaluateJavaScript("if(player){player.stopAnimation();player.clear();}"); view.stopLoading(); view.configuration.userContentController.removeScriptMessageHandler(forName: "status"); view.navigationDelegate = nil; view.loadHTMLString("", baseURL: nil) }
}

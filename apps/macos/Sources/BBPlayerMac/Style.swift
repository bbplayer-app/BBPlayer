import AppKit
import ImageIO
import SwiftUI

enum MD {
    static let accent = Color(red: 0.27, green: 0.40, blue: 0.54)
    static func background(_ scheme: ColorScheme) -> Color { scheme == .dark ? Color(red: 0.075, green: 0.085, blue: 0.10) : Color(red: 0.975, green: 0.972, blue: 0.99) }
    static func surface(_ scheme: ColorScheme) -> Color { scheme == .dark ? Color(red: 0.13, green: 0.15, blue: 0.18) : Color(red: 0.91, green: 0.93, blue: 0.96) }
    static func container(_ scheme: ColorScheme) -> Color { scheme == .dark ? Color(red: 0.19, green: 0.25, blue: 0.32) : Color(red: 0.82, green: 0.88, blue: 0.94) }
    static func time(_ value: Double) -> String { guard value.isFinite else { return "0:00" }; let seconds = max(0, Int(value)); return seconds >= 3600 ? String(format: "%d:%02d:%02d", seconds / 3600, (seconds / 60) % 60, seconds % 60) : String(format: "%d:%02d", seconds / 60, seconds % 60) }
}
extension Color {
    init(hex: String?, fallback: Color = MD.accent) {
        guard let hex, let value = UInt64(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) else { self = fallback; return }
        self.init(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
}
actor ArtworkLoader {
    static let shared = ArtworkLoader()
    private let cache = NSCache<NSURL, NSImage>()
    init() { cache.totalCostLimit = 24 * 1024 * 1024 }
    func image(_ url: URL) async throws -> NSImage? {
        if let cached = cache.object(forKey: url as NSURL) { return cached }
        let data: Data
        if url.isFileURL { data = try Data(contentsOf: url) }
        else { let result = try await URLSession.shared.data(from: url); guard let response = result.1 as? HTTPURLResponse, response.statusCode == 200 else { return nil }; data = result.0 }
        guard let source = CGImageSourceCreateWithData(data as CFData, nil), let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 640, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary) else { return nil }
        let result = NSImage(cgImage: image, size: .zero); cache.setObject(result, forKey: url as NSURL, cost: image.bytesPerRow * image.height); return result
    }
}
struct Artwork: View {
    var url: URL?
    var radius: CGFloat = 12
    @State private var image: NSImage?
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        ZStack {
            MD.surface(scheme)
            if let image { Image(nsImage: image).resizable().scaledToFill() }
            else { Image(systemName: "music.note").font(.title2).foregroundStyle(.secondary) }
        }.clipped().clipShape(RoundedRectangle(cornerRadius: radius))
            .task(id: url) { image = nil; guard let url else { return }; image = try? await ArtworkLoader.shared.image(url) }
    }
}
struct MDButtonStyle: ButtonStyle {
    @Environment(\.colorScheme) private var scheme
    var prominent = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.padding(.horizontal, 18).padding(.vertical, 10)
            .background(prominent ? MD.accent.opacity(configuration.isPressed ? 0.7 : 1) : MD.container(scheme).opacity(configuration.isPressed ? 0.6 : 1), in: Capsule())
            .foregroundStyle(prominent ? Color.white : Color.primary)
    }
}
struct CircleControl: View {
    var symbol: String
    var label: String
    var large = false
    var active = false
    var action: () -> Void
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: large ? 29 : 17, weight: .semibold))
                .frame(width: large ? 68 : 38, height: large ? 68 : 38)
                .background(large ? MD.container(scheme) : active ? MD.container(scheme).opacity(0.7) : .clear, in: Circle())
        }.buttonStyle(.plain).help(label).accessibilityLabel(label)
    }
}

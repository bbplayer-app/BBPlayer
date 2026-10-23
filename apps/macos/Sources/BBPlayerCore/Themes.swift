import Foundation
import ImageIO
import Observation

public struct ThemeCatalogItem: Codable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var kind: String
    public var itemID: String
    public var actID: String?
    public var lotteryID: String?
    public var cover: URL?
}
public struct ThemeAsset: Codable, Identifiable, Sendable {
    public var id: String { role + ":" + name + ":" + remoteURL.absoluteString }
    public var role: String
    public var name: String
    public var remoteURL: URL
    public var filename: String
}
public struct ThemeVariant: Codable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var properties: [String: String]
}
public struct InstalledTheme: Codable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var variants: [ThemeVariant]
    public var assets: [ThemeAsset]
    public var root: URL
    public func asset(role: String, index: Int = 0) -> URL? {
        let matches = assets.filter { $0.role == role }
        return matches.indices.contains(index) ? root.appendingPathComponent(matches[index].filename) : nil
    }
    public func asset(remote: String?) -> URL? {
        guard let remote, let match = assets.first(where: { $0.remoteURL.absoluteString == remote }) else { return nil }
        return root.appendingPathComponent(match.filename)
    }
}

@MainActor @Observable public final class ThemeManager {
    public private(set) var installed: [InstalledTheme] = []
    public private(set) var active: InstalledTheme?
    public var variantIndex = 0 { didSet { try? database.saveState(variantIndex, key: "theme-variant") } }
    public var avatarIndex = 0 { didSet { try? database.saveState(avatarIndex, key: "theme-avatar") } }
    public var splashIndex = 0 { didSet { try? database.saveState(splashIndex, key: "theme-splash") } }
    public var progress: Double?
    public var status = ""
    @ObservationIgnored private let root: URL
    @ObservationIgnored private let api: BilibiliClient
    @ObservationIgnored private let database: LibraryDatabase
    public var variant: ThemeVariant? { active.flatMap { $0.variants.indices.contains(variantIndex) ? $0.variants[variantIndex] : $0.variants.first } }
    public init(root: URL, api: BilibiliClient, database: LibraryDatabase) throws {
        self.root = root; self.api = api; self.database = database
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        // Recover a previous complete pack if the process exited between the two atomic moves.
        for backup in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) where backup.lastPathComponent.hasPrefix(".previous-") {
            if let data = try? Data(contentsOf: backup.appendingPathComponent("theme.json")), let previous = try? JSONDecoder().decode(InstalledTheme.self, from: data) {
                let destination = root.appendingPathComponent(previous.id)
                if !FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.moveItem(at: backup, to: destination) }
            }
        }
        for folder in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) where !folder.lastPathComponent.hasPrefix(".") {
            if let data = try? Data(contentsOf: folder.appendingPathComponent("theme.json")), var theme = try? JSONDecoder().decode(InstalledTheme.self, from: data) { theme.root = folder; installed.append(theme) }
        }
        let selected = try database.state(String.self, key: "theme-id")
        active = installed.first { $0.id == selected }
        variantIndex = (try database.state(Int.self, key: "theme-variant")) ?? 0
        avatarIndex = (try database.state(Int.self, key: "theme-avatar")) ?? 0
        splashIndex = (try database.state(Int.self, key: "theme-splash")) ?? 0
    }
    public func apply(_ theme: InstalledTheme?) {
        active = theme; variantIndex = 0; avatarIndex = 0; splashIndex = 0
        try? database.saveState(theme?.id ?? "", key: "theme-id")
    }
    public func uninstall(_ theme: InstalledTheme) throws {
        try FileManager.default.removeItem(at: theme.root)
        installed.removeAll { $0.id == theme.id }; if active?.id == theme.id { apply(nil) }
    }
    public func search(_ keyword: String, page: Int = 1) async throws -> [ThemeCatalogItem] {
        let body = try await api.request("/x/garb/v2/mall/home/search", parameters: ["key_word": keyword, "pn": String(page), "ps": "20"])
        return body.array("list").compactMap { item in
            let part = item.int("part_id"), props = item.object("properties")
            guard part == 0 || part == 6 else { return nil }
            let act = props.string("dlc_act_id"), lottery = props.string("dlc_lottery_id"), itemID = String(item.int64("item_id"))
            return ThemeCatalogItem(id: part == 0 ? "collection_\(act)_\(lottery)" : "suit_\(itemID)", name: item.string("name"), kind: part == 0 ? "collection" : "suit", itemID: itemID, actID: act.nonEmpty, lotteryID: lottery.nonEmpty,
                cover: BilibiliClient.imageURL(props.string("image_cover").nonEmpty ?? props.string("image_cover_long").nonEmpty ?? props.string("fan_share_image")))
        }
    }
    public func install(_ item: ThemeCatalogItem) async throws {
        guard progress == nil else { throw APIError.unavailable("请等待当前装扮下载结束。") }
        progress = 0; status = "读取装扮资源"
        defer { progress = nil }
        var variants: [ThemeVariant] = [], assets: [ThemeAsset] = []
        func appendURL(_ value: String, role: String, name: String) {
            guard let url = BilibiliClient.imageURL(value), url.scheme == "https" else { return }
            let ext = role == "svga" ? "svga" : ["png", "jpg", "jpeg", "webp", "gif", "mp4", "svga", "bin", "json"].first { url.path.lowercased().hasSuffix("." + $0) } ?? (role == "svga" ? "svga" : "bin")
            assets.append(ThemeAsset(role: role, name: name, remoteURL: url, filename: WBI.md5(Data(url.absoluteString.utf8)) + "." + ext))
        }
        func component(_ entry: [String: Any], kind: String) {
            let props = entry.object("properties"), name = entry.string("name").nonEmpty ?? item.name
            if kind == "skin" {
                let properties = props.compactMapValues { $0 as? String }
                variants.append(ThemeVariant(id: String(entry.int64("item_id")), name: name, properties: properties))
                for (key, value) in properties where key.contains("bg") || key.contains("icon") || key.hasPrefix("image_") {
                    appendURL(value, role: key == "head_myself_mp4_bg" ? "video" : key, name: name)
                }
            } else if kind == "card" { appendURL(props.string("image"), role: "avatar", name: name) }
            else if kind == "thumbup" { appendURL(props.string("image_ani"), role: "svga", name: name); appendURL(props.string("image_preview"), role: "preview", name: name) }
            else if kind == "space_bg" {
                for index in 1...8 {
                    appendURL(props.string("image\(index)_portrait"), role: "splash", name: name)
                    appendURL(props.string("image\(index)_landscape"), role: "space", name: name)
                }
            } else if kind == "play_icon" {
                for key in ["drag_left_png", "drag_right_png", "middle_png", "static_icon_image"] { appendURL(props.string(key), role: key, name: name) }
            } else if kind == "loading" {
                appendURL(props.string("loading_url"), role: "loading", name: name)
                appendURL(props.string("image_preview_small"), role: "preview", name: name)
            } else if kind == "card_bg" { appendURL(props.string("image"), role: "card_bg", name: name) }
        }
        if let cover = item.cover { appendURL(cover.absoluteString, role: "cover", name: item.name) }
        if item.kind == "suit" {
            let body = try await api.request("/x/garb/v2/mall/suit/detail", parameters: ["item_id": item.itemID])
            let components = body.object("suit_items")
            for kind in ["skin", "card", "thumbup", "space_bg", "play_icon", "loading", "card_bg"] {
                for entry in components.array(kind) { component(entry, kind: kind) }
            }
        } else {
            guard let act = item.actID, let lottery = item.lotteryID else { throw APIError.invalidResponse }
            let body = try await api.request("/x/vas/dlc_act/asset_bag", parameters: ["act_id": act, "lottery_id": lottery])
            func card(_ entry: [String: Any]) {
                appendURL(entry.string("card_img"), role: "splash", name: entry.string("card_name"))
                for url in entry["video_list"] as? [String] ?? [] { appendURL(url, role: "video", name: entry.string("card_name")) }
            }
            for entry in body.array("item_list") { card(entry.object("card_item")) }
            for entry in body.array("collect_list") {
                try Task.checkCancellation()
                if entry.int("redeem_item_type") == 1 { card(entry.object("card_item").object("card_asset_info").object("card_item")); continue }
                for id in entry.string("redeem_item_id").split(separator: "&") {
                    let benefit = try await api.request("/x/garb/v2/user/suit/benefit", parameters: ["item_id": String(id), "part": "emoji_package"])
                    let kind = [1: "card", 3: "thumbup", 9: "skin", 10: "loading", 11: "play_icon"][benefit.int("part_id")]
                    if let kind { component(benefit, kind: kind) }
                }
            }
        }
        guard !assets.isEmpty else { throw APIError.unavailable("装扮中没有可用资源。") }
        let staging = root.appendingPathComponent(".install-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: staging) }
        var downloaded = Set<String>()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        for (index, asset) in assets.enumerated() {
            try Task.checkCancellation()
            status = "下载资源 \(index + 1) / \(assets.count)"
            if downloaded.insert(asset.filename).inserted {
                let (temporary, response) = try await session.download(from: asset.remoteURL)
                guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw APIError.unavailable("装扮资源下载失败。") }
                let size = try temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size > 0, size < 128 * 1024 * 1024 else { throw APIError.unavailable("装扮资源为空或单文件超过 128MB，已停止安装。") }
                if ["png", "jpg", "jpeg", "webp", "gif"].contains(asset.filename.components(separatedBy: ".").last ?? "") {
                    guard let image = CGImageSourceCreateWithURL(temporary as CFURL, nil), CGImageSourceGetCount(image) > 0 else { throw APIError.unavailable("装扮图片损坏，已保留当前主题。") }
                }
                try FileManager.default.moveItem(at: temporary, to: staging.appendingPathComponent(asset.filename))
            }
            progress = Double(index + 1) / Double(assets.count)
        }
        let destination = root.appendingPathComponent(item.id)
        let theme = InstalledTheme(id: item.id, name: item.name, variants: variants, assets: assets, root: destination)
        try JSONEncoder().encode(theme).write(to: staging.appendingPathComponent("theme.json"), options: .atomic)
        // Do not destroy the active pack until every new asset has arrived.
        if FileManager.default.fileExists(atPath: destination.path) {
            let backup = root.appendingPathComponent(".previous-\(UUID().uuidString)")
            try FileManager.default.moveItem(at: destination, to: backup)
            do { try FileManager.default.moveItem(at: staging, to: destination); try? FileManager.default.removeItem(at: backup) }
            catch { try? FileManager.default.moveItem(at: backup, to: destination); throw error }
        } else { try FileManager.default.moveItem(at: staging, to: destination) }
        installed.removeAll { $0.id == theme.id }; installed.append(theme); apply(theme); status = "已安装"
    }
}

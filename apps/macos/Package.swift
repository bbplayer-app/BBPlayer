// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "BBPlayerMac",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "BBPlayerCore", targets: ["BBPlayerCore"]),
        .executable(name: "BBPlayerMac", targets: ["BBPlayerMac"]),
        .executable(name: "BBPlayerProbe", targets: ["BBPlayerProbe"])
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift.git", exact: "7.11.1")
    ],
    targets: [
        .target(name: "AudioRealtime", publicHeadersPath: "include"),
        .target(name: "BBPlayerCore", dependencies: ["AudioRealtime", .product(name: "GRDB", package: "GRDB.swift")]),
        .executableTarget(name: "BBPlayerProbe", dependencies: ["BBPlayerCore"]),
        .executableTarget(name: "BBPlayerMac", dependencies: ["BBPlayerCore"], resources: [.process("Resources")]),
        .testTarget(name: "BBPlayerCoreTests", dependencies: ["BBPlayerCore"])
    ],
    swiftLanguageModes: [.v5]
)


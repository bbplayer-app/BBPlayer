import Foundation

public struct PlaybackTiming: Codable, Sendable {
    public var sourceReady: TimeInterval?
    public var firstByte: TimeInterval?
    public var firstDelivery: TimeInterval?
    public var itemReady: TimeInterval?
    public init() { }
}

// Compiled once under each Apple framework name the sources import, so that the imports
// resolve on Linux. The types themselves come from Mocks.swift.
@_exported import Foundation
@_exported import Dispatch
#if canImport(FoundationNetworking)
@_exported import FoundationNetworking
#endif

import Foundation

// 队列中所有有关 index 的操作都是以 backingQueue 为准的
class OrpheusQueueManager {
    private var backingQueue: [Track] = []
    private var shuffleIndices: [Int]?
    private var currentIndex: Int = -1 // This is ALWAYS the index in backingQueue
    private var pendingShuffleInit: Bool = false
    
    // MARK: - Getters
    
    func getQueue() -> [Track] {
        return backingQueue
    }
    
    func getCurrentTrack() -> Track? {
        guard currentIndex >= 0 && currentIndex < backingQueue.count else { return nil }
        return backingQueue[currentIndex]
    }
    
    func getCurrentIndex() -> Int {
        return currentIndex
    }
    
    func getQueueCount() -> Int {
        return backingQueue.count
    }
    
    func isShuffled() -> Bool {
        return shuffleIndices != nil
    }
    
    // MARK: - Queue Operations
    
    func setQueue(_ tracks: [Track], startFromIndex: Int, inputShuffleMode: Bool) {
        backingQueue = tracks
        
        if inputShuffleMode {
            shuffleIndices = Array(0..<tracks.count).shuffled()
            
            if startFromIndex >= 0 && startFromIndex < tracks.count {
                currentIndex = startFromIndex
            } else {
            currentIndex = shuffleIndices?.first ?? -1 // Start with first in shuffle if no specific start
                 if currentIndex == -1 && !tracks.isEmpty { currentIndex = tracks.indices.contains(0) ? shuffleIndices?.first ?? 0 : 0 }
            }
            
        } else {
            shuffleIndices = nil
            pendingShuffleInit = false
            if tracks.isEmpty {
                currentIndex = -1
            } else if startFromIndex >= 0 && startFromIndex < tracks.count {
                currentIndex = startFromIndex
            } else {
                currentIndex = 0 // Safe default
            }
        }
    }
    
    func setShuffleMode(_ enabled: Bool) {
        if enabled {
            if backingQueue.isEmpty {
                pendingShuffleInit = true
            } else if shuffleIndices == nil {
                generateShuffleIndices()
            }
        } else {
            shuffleIndices = nil
            pendingShuffleInit = false
        }
    }
    
    private func generateShuffleIndices() {
        guard !backingQueue.isEmpty else { return }
        var newIndices = Array(0..<backingQueue.count).shuffled()

        if currentIndex >= 0 && currentIndex < backingQueue.count {
            if let pos = newIndices.firstIndex(of: currentIndex) {
                newIndices.swapAt(0, pos)
            }
        }
        
        shuffleIndices = newIndices
    }
    
    func setRepeatMode(_ mode: RepeatMode) {
        // Queue manager might not need to store this if we pass it in next/prev methods
    }
    
    // MARK: - Navigation
    
    // Returns the backing index of the next track
    func getNextIndex(repeatMode: RepeatMode) -> Int? {
        guard !backingQueue.isEmpty else { return nil }
        
        let playbackIndex = getPlaybackIndex(for: currentIndex)
        var nextPlaybackIndex = playbackIndex + 1
        
        if nextPlaybackIndex >= backingQueue.count {
            if repeatMode == .queue || repeatMode == .track { 
                 nextPlaybackIndex = 0
            } else {
                return nil // End of queue
            }
        }
        
        return getBackingIndex(from: nextPlaybackIndex)
    }
    
    func getPreviousIndex(repeatMode: RepeatMode) -> Int? {
        guard !backingQueue.isEmpty else { return nil }
        
        let playbackIndex = getPlaybackIndex(for: currentIndex)
        var prevPlaybackIndex = playbackIndex - 1
        
        if prevPlaybackIndex < 0 {
             if repeatMode == .queue || repeatMode == .track {
                 prevPlaybackIndex = backingQueue.count - 1
             } else {
                 return nil // Start of queue
             }
        }
        
        return getBackingIndex(from: prevPlaybackIndex)
    }
     
    func skipTo(backingIndex: Int) {
        if backingIndex >= 0 && backingIndex < backingQueue.count {
            currentIndex = backingIndex
        }
    }
    
    // MARK: - Modification
    
    func removeTrack(at backingIndex: Int) -> Bool {
        // Returns true if current track was removed (requiring player stop/next)
        guard backingIndex >= 0 && backingIndex < backingQueue.count else { return false }
        
        let wasCurrent = (backingIndex == currentIndex)
        var removedShufflePos: Int? = nil
        
        if let indices = shuffleIndices, let pos = indices.firstIndex(of: backingIndex) {
            removedShufflePos = pos
        }
        
        backingQueue.remove(at: backingIndex)
        
        // Update shuffle indices
        if let indices = shuffleIndices {
            var newIndices = indices.filter { $0 != backingIndex }
            // Shift indices > removed index down
            newIndices = newIndices.map { $0 > backingIndex ? $0 - 1 : $0 }
            shuffleIndices = newIndices
        }
        
        // Update current index
        if backingIndex < currentIndex {
            currentIndex -= 1
        } else if wasCurrent {
             // Current track removed.
             if backingQueue.isEmpty {
                 currentIndex = -1
             } else {
                 if currentIndex >= backingQueue.count {
                     currentIndex = 0 
                 }
                 
                 // If shuffled, pick the next one in shuffle order
                 if let indices = shuffleIndices, let removedPos = removedShufflePos {
                     if !indices.isEmpty {
                         // We want the item that is now at removedPos (or wrap)
                         let nextPos = removedPos < indices.count ? removedPos : 0
                         currentIndex = indices[nextPos]
                     } else {
                         currentIndex = -1
                     }
                 }
             }
        }
        
        return wasCurrent
    }
    
    func append(tracks: [Track]) {
        let startIndex = backingQueue.count
        backingQueue.append(contentsOf: tracks)
        
        if pendingShuffleInit {
            generateShuffleIndices()
            pendingShuffleInit = false
        } else if var indices = shuffleIndices {
            // Add new items to end of shuffle order (standard "Add to Queue" behavior)
             let newIndices = (startIndex..<(startIndex + tracks.count))
             indices.append(contentsOf: newIndices)
             shuffleIndices = indices
        }
    }

    func insertNext(track: Track) {
        if backingQueue.isEmpty {
             backingQueue = [track]
             currentIndex = 0
             return
        }
        
        let insertIndex = currentIndex + 1
        backingQueue.insert(track, at: insertIndex)
        
        if var indices = shuffleIndices {
             // We inserted at `insertIndex`.
             // Any index >= insertIndex in `indices` needs to be incremented.
             for i in 0..<indices.count {
                 if indices[i] >= insertIndex {
                     indices[i] += 1
                 }
             }
             
             // Now add our new item (which is at `insertIndex`) to the playback order
             // It should be after current PLAYBACK position.
             let currentPlaybackPos = getPlaybackIndex(for: currentIndex)
             let targetPlaybackPos = currentPlaybackPos + 1
             indices.insert(insertIndex, at: targetPlaybackPos)
             
             shuffleIndices = indices
        }
    }
    
    func clear() {
        backingQueue.removeAll()
        shuffleIndices = nil
        currentIndex = -1
    }
    
    // MARK: - Helpers
    
    private func getPlaybackIndex(for backingIndex: Int) -> Int {
        if let indices = shuffleIndices {
            return indices.firstIndex(of: backingIndex) ?? -1
        }
        return backingIndex
    }
    
    private func getBackingIndex(from playbackIndex: Int) -> Int? {
        if let indices = shuffleIndices {
            guard playbackIndex >= 0 && playbackIndex < indices.count else { return nil }
            return indices[playbackIndex]
        }
        guard playbackIndex >= 0 && playbackIndex < backingQueue.count else { return nil }
        return playbackIndex
    }
}

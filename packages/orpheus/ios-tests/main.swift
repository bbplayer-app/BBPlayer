// Drives the real OrpheusPlayerManager against a scripted AVPlayer and Bilibili API.
import Foundation

// MARK: - Plumbing

var failedChecks = 0
var failedTests: [String] = []
var currentTestFailed = false

func check(_ condition: @autoclosure () -> Bool, _ message: String, line: Int = #line) {
    guard !condition() else { return }
    failedChecks += 1
    currentTestFailed = true
    print("    FAILED (line \(line)): \(message)")
}

/// Lets the blocks the manager queued on the main thread run.
func pump() {
    RunLoop.main.run(until: Date().addingTimeInterval(0.02))
}

final class Events {
    var states: [PlaybackState] = []
    var playing: [Bool] = []
    var started: [(id: String, reason: TransitionReason)] = []
    var finished: [(id: String, position: Double, duration: Double)] = []
    var errors: [String] = []
}

struct Fixture {
    let manager: OrpheusPlayerManager
    let player: AVPlayer
    let events: Events

    /// Posts the end-of-item notification for the item that is loaded now.
    func postPlayedToEnd() {
        guard let item = player.currentItem else { return }
        player.reachEnd()
        manager.playerDidFinishPlaying(note: NSNotification(name: .AVPlayerItemDidPlayToEndTime, object: item))
        pump()
    }

    /// A segment request fails for good while the item's status stays ready.
    func postFailedToPlayToEnd(_ error: Error) {
        guard let item = player.currentItem else { return }
        player.stall()
        manager.playerDidFailToPlayToEnd(note: NSNotification(
            name: .AVPlayerItemFailedToPlayToEndTime, object: item,
            userInfo: [AVPlayerItemFailedToPlayToEndTimeErrorKey: error]))
        pump()
    }

    func postInterruption(began: Bool, shouldResume: Bool = false) {
        var info: [AnyHashable: Any] = [AVAudioSessionInterruptionTypeKey: UInt(began ? 1 : 0)]
        if !began {
            info[AVAudioSessionInterruptionOptionKey] = UInt(shouldResume ? 1 : 0)
        }
        manager.handleInterruption(notification: Notification(name: AVAudioSession.interruptionNotification, object: nil, userInfo: info))
        pump()
    }
}

func resetWorld() {
    MMKV.resetAll()
    BilibiliApi.shared.reset()
    OrpheusDownloadManager.shared.localFiles = [:]
    UIApplication.shared.reset()
    AVPlayer.created.removeAll()
    MPRemoteCommandCenter.reset()
    AVAsset.trackLoads.removeAll()
}

func makeFixture() -> Fixture {
    let manager = OrpheusPlayerManager()
    let events = Events()
    manager.onPlaybackStateChanged = { events.states.append($0) }
    manager.onIsPlayingChanged = { events.playing.append($0) }
    manager.onTrackStarted = { events.started.append(($0, $1)) }
    manager.onTrackFinished = { events.finished.append(($0, $1, $2)) }
    manager.onPlayerError = { events.errors.append($0) }
    pump()
    return Fixture(manager: manager, player: AVPlayer.created.last!, events: events)
}

func track(_ id: String, cid: Bool = true) -> Track {
    var track = Track()
    track.id = id
    track.url = "orpheus://bilibili?bvid=BV\(id)" + (cid ? "&cid=1" : "")
    track.title = id
    track.duration = 200
    return track
}

func mediaUrl(_ id: String, mirror: Int = 0) -> String {
    return "https://cdn\(mirror).test/\(id).mp4"
}

/// Answers the oldest unanswered lookup with a plain stream for `id`.
func answer(_ id: String, mirrors: Int = 0, line: Int = #line) {
    guard !BilibiliApi.shared.streamRequests.isEmpty else {
        check(false, "there is no lookup to answer", line: line)
        return
    }
    let urls = (0...mirrors).map { mediaUrl(id, mirror: $0) }
    BilibiliApi.shared.answerStream(.success(BilibiliStream(urls: urls, segmentBase: nil, measuredLoudness: nil)))
    pump()
}

let offline = NSError(domain: NSURLErrorDomain, code: -1009, userInfo: [NSLocalizedDescriptionKey: "offline"])

/// A queue of A and B with A loaded, ready and playing.
func playingA(mirrors: Int = 0, queue: [String] = ["A", "B"], duration: Double = 200) -> Fixture {
    let f = makeFixture()
    f.manager.setQueue(queue.map { track($0) }, startIndex: 0)
    answer("A", mirrors: mirrors)
    f.player.becomeReady(duration: duration)
    return f
}

func test(_ name: String, _ body: () -> Void) {
    resetWorld()
    currentTestFailed = false
    print("- \(name)")
    body()
    if currentTestFailed {
        failedTests.append(name)
    }
}

// MARK: - 1. A pause that arrives while a stream is on the way

test("pause while the next stream is on the way keeps it paused") {
    let f = playingA()
    f.manager.playNext()
    f.manager.pause()
    f.player.calls.removeAll()
    answer("B")
    check(f.player.currentItem?.url == mediaUrl("B"), "B should be loaded")
    check(f.player.count("play") == 0, "the loaded stream must not start playing")
    check(f.player.rate == 0, "nothing should be audible")
    check(UIApplication.shared.runningTasks.isEmpty, "the background task should be released")
    f.manager.play()
    check(f.player.rate > 0, "play should start it afterwards")
}

test("sleep timer between a natural end and the next stream keeps it paused") {
    let f = playingA()
    f.postPlayedToEnd()
    check(f.manager.getCurrentTrack()?.id == "B", "the queue should have advanced")
    f.manager.pause()
    f.player.calls.removeAll()
    answer("B")
    check(f.player.count("play") == 0, "the next track must not start after the timer fired")
    check(f.player.rate == 0, "nothing should be audible")
}

test("interruption while a stream is on the way holds playback until it ends") {
    let f = playingA()
    f.manager.playNext()
    f.postInterruption(began: true)
    answer("B")
    check(f.player.rate == 0, "must not play into the interruption")
    f.postInterruption(began: false, shouldResume: true)
    check(f.player.rate > 0, "should resume once the interruption ends")
}

test("mirror failover while paused stays paused") {
    let f = playingA(mirrors: 1)
    f.player.advance(to: 50)
    f.manager.pause()
    f.player.calls.removeAll()
    f.player.failItem(offline)
    pump()
    check(f.player.currentItem?.url == mediaUrl("A", mirror: 1), "the mirror should be loaded")
    check(f.player.count("play") == 0, "a retry must not start a paused track")
    check(f.events.errors.isEmpty, "a failover is not an error")
}

// MARK: - 2. Play after the queue has ended

test("play after the queue has ended starts the last track over") {
    let f = playingA(queue: ["A"])
    f.postPlayedToEnd()
    check(f.events.states.last == .ended, "the queue should report its end")
    check(f.events.finished.count == 1, "the first listen should be recorded")
    f.player.calls.removeAll()
    f.manager.play()
    check(f.player.calls.contains("seek:0"), "should go back to the start")
    check(f.player.rate > 0, "should be playing again")
    check(f.events.started.last?.reason == .repeatMode, "should count as a new start of the track")
    f.postPlayedToEnd()
    check(f.events.finished.count == 2, "the second listen should be recorded too")
    check(f.events.states.last == .ended, "the queue should report its end again")
}

test("seeking back into a finished queue plays on from there") {
    let f = playingA(queue: ["A"])
    f.postPlayedToEnd()
    f.manager.seek(to: 40)
    f.player.calls.removeAll()
    f.manager.play()
    check(f.player.count("seek:0") == 0, "must not jump back to the start")
    check(f.player.now == 40 && f.player.rate > 0, "should play from where the user moved to")
    f.postPlayedToEnd()
    check(f.events.finished.count == 2, "reaching the end again should be recorded")
    check(f.events.states.last == .ended, "the queue should report its end again")
}

// MARK: - 3. The previous track while the next stream is fetched

test("the previous track is silent while the next stream is fetched") {
    let f = playingA()
    f.player.advance(to: 120)
    f.manager.playNext()
    check(f.player.currentItem == nil, "the previous item should be gone")
    check(f.player.rate == 0, "the previous track must not play on")
    check(f.manager.getPosition() == 0, "the new entry starts at zero")
    check(f.manager.getBufferedPosition() == 0, "the previous buffer is not the new entry's")
    check(f.events.states.last == .buffering, "the UI should see buffering")
    check(!UIApplication.shared.runningTasks.isEmpty, "a background task should keep the app running")
    let lookups = BilibiliApi.shared.streamRequestCount
    let starts = f.events.started.count
    f.manager.play()
    check(BilibiliApi.shared.streamRequestCount == lookups, "play must not start a second lookup")
    check(f.events.started.count == starts, "play must not report the track again")
    answer("B")
    check(f.player.currentItem?.url == mediaUrl("B") && f.player.rate > 0, "B should play once fetched")
    check(UIApplication.shared.runningTasks.isEmpty, "the background task should end once it plays")
}

test("the reported state follows pause and play while a stream is on the way") {
    let f = makeFixture()
    f.manager.setQueue([track("A")], startIndex: 0)
    check(f.events.states.last == .buffering, "a pending stream is buffering")
    f.manager.pause()
    check(f.events.states.last == .ready, "a paused pending stream is not buffering")
    f.manager.play()
    check(f.events.states.last == .buffering, "and buffers again after play")
}

// MARK: - 4. Retrying a failed item

test("play after a failed item resumes where it stopped") {
    let f = playingA(queue: ["A"], duration: 2400)
    f.player.advance(to: 1800)
    f.player.failItem(offline)
    pump()
    check(f.events.errors.count == 1, "the failure should be reported")
    f.player.calls.removeAll()
    f.manager.play()
    check(BilibiliApi.shared.streamRequests.count == 1, "play should fetch the stream again")
    check(f.manager.getPosition() == 1800, "the position should stay where it stopped")
    answer("A")
    check(f.player.calls.contains("seek:1800"), "should carry on from 30:00")
    check(f.player.rate > 0, "should be playing")
}

test("play after a stream stalled for good fetches it again") {
    let f = playingA(queue: ["A"], duration: 2400)
    f.player.advance(to: 900)
    f.postFailedToPlayToEnd(offline)
    check(f.events.errors.count == 1, "the failure should be reported")
    f.player.calls.removeAll()
    f.manager.play()
    check(BilibiliApi.shared.streamRequests.count == 1, "play should fetch the stream again")
    answer("A")
    check(f.player.calls.contains("seek:900"), "should carry on from 15:00")
    check(f.player.rate > 0, "should be playing")
}

// MARK: - 5. Previous and seek while the next stream is fetched

test("previous while the next stream is on the way goes back a track") {
    let f = playingA()
    f.player.advance(to: 120)
    f.manager.playNext()
    f.manager.skipToPrevious()
    check(f.manager.getCurrentTrack()?.id == "A", "should be back on A")
    answer("B")
    check(f.player.currentItem == nil, "B's late answer must not load")
    answer("A")
    check(f.player.currentItem?.url == mediaUrl("A") && f.player.rate > 0, "A should play")
}

test("seek while the stream is on the way moves where it starts") {
    let f = playingA()
    f.manager.playNext()
    f.manager.seek(to: 42)
    check(f.manager.getPosition() == 42, "the position should show the seek")
    f.player.calls.removeAll()
    answer("B")
    check(f.player.calls.contains("seek:42"), "B should start from the seek")
}

test("previous on a restored position restarts the track") {
    GeneralStorage.shared.saveQueue([track("A"), track("B")])
    GeneralStorage.shared.savePosition(index: 1, positionSec: 75)
    GeneralStorage.shared.isRestoreEnabled = true
    let f = makeFixture()
    check(f.manager.getPosition() == 75, "the saved position should be restored")
    f.manager.skipToPrevious()
    check(f.manager.getCurrentTrack()?.id == "B", "should stay on B")
    check(f.manager.getPosition() == 0, "and go back to its start")
}

// MARK: - Superseded lookups

test("an answer for an earlier request of the same track is dropped") {
    let f = makeFixture()
    f.manager.setQueue([track("A"), track("B")], startIndex: 0)
    f.manager.skipTo(index: 1)
    f.manager.skipTo(index: 0)
    answer("A")
    check(f.player.loaded.isEmpty, "the first request for A was superseded")
    answer("B")
    check(f.player.loaded.isEmpty, "the request for B was superseded")
    answer("A")
    check(f.player.loaded.count == 1 && f.player.rate > 0, "only the last request should load")
}

test("a second play during the first lookup of a restored session does nothing more") {
    GeneralStorage.shared.saveQueue([track("A"), track("B")])
    GeneralStorage.shared.savePosition(index: 1, positionSec: 75)
    GeneralStorage.shared.isRestoreEnabled = true
    let f = makeFixture()
    f.manager.seek(to: 30)
    f.manager.play()
    f.manager.play()
    check(BilibiliApi.shared.streamRequestCount == 1, "one lookup")
    check(f.events.started.count == 1, "one start")
    f.player.calls.removeAll()
    answer("B")
    check(f.player.calls.contains("seek:30") && f.player.rate > 0, "B should play from the seek")
    check(f.player.loaded.count == 1, "loaded once")
}

// MARK: - Behaviour that must not change

test("a natural end plays the next track and records the listen") {
    let f = playingA()
    f.postPlayedToEnd()
    check(f.events.finished.count == 1 && f.events.finished[0].id == "A" && f.events.finished[0].position == 200, "A should be recorded as played through")
    check(f.events.started.last?.id == "B" && f.events.started.last?.reason == .auto, "B should start automatically")
    answer("B")
    check(f.player.currentItem?.url == mediaUrl("B") && f.player.rate > 0, "B should play")
}

test("repeat one loops the track and counts each loop") {
    let f = playingA()
    f.manager.setExecuteRepeatMode(.track)
    f.player.calls.removeAll()
    f.postPlayedToEnd()
    check(f.player.calls.contains("seek:0") && f.player.rate > 0, "should loop")
    check(f.events.started.last?.reason == .repeatMode, "each loop is a new start")
    check(f.events.finished.count == 1, "and the finished loop is recorded")
    check(BilibiliApi.shared.streamRequests.isEmpty, "without another lookup")
    check(UIApplication.shared.runningTasks.isEmpty, "the background task should end")
}

test("a manual skip records how far the track got") {
    let f = playingA()
    f.player.advance(to: 30)
    f.manager.playNext()
    check(f.events.finished.count == 1 && f.events.finished[0].position == 30 && f.events.finished[0].duration == 200, "A should be recorded at 0:30")
}

test("mirror failover carries on from the same position") {
    let f = playingA(mirrors: 1)
    f.player.advance(to: 50)
    f.player.calls.removeAll()
    f.player.failItem(offline)
    pump()
    check(f.player.currentItem?.url == mediaUrl("A", mirror: 1), "the mirror should be loaded")
    check(f.player.calls.contains("seek:50") && f.player.rate > 0, "and play on from 0:50")
    check(f.events.errors.isEmpty, "a failover is not an error")
}

test("a downloaded track replaces the previous one without a lookup") {
    OrpheusDownloadManager.shared.localFiles["B"] = URL(fileURLWithPath: "/downloads/B.mp4")
    let f = playingA()
    f.player.calls.removeAll()
    f.manager.playNext()
    check(BilibiliApi.shared.streamRequests.isEmpty, "no lookup for a local file")
    check(f.player.count("replace:nil") == 0, "no gap before a local file")
    check(f.player.currentItem?.url.hasSuffix("/downloads/B.mp4") == true && f.player.rate > 0, "the local file should play")
}

test("clearing the queue drops a lookup that is on the way") {
    let f = playingA()
    f.manager.playNext()
    f.manager.clearQueue()
    answer("B")
    check(f.player.currentItem == nil, "nothing should load into an empty queue")
    check(f.events.states.last == .idle, "the player should be idle")
    check(UIApplication.shared.runningTasks.isEmpty, "the background task should be released")
}

test("a lookup that fails reports it, and play tries again") {
    let f = makeFixture()
    f.manager.setQueue([track("A")], startIndex: 0)
    BilibiliApi.shared.answerStream(.failure(offline))
    pump()
    check(f.events.errors.first?.contains("Unable to connect") == true, "the error should name the connection")
    check(f.events.states.last == .idle, "the player should be idle")
    check(UIApplication.shared.runningTasks.isEmpty, "the background task should be released")
    f.manager.play()
    check(BilibiliApi.shared.streamRequests.count == 1, "play should look the stream up again")
    answer("A")
    check(f.player.rate > 0, "and play it")
}

test("a single-part video is looked up through its page list") {
    let f = makeFixture()
    f.manager.setQueue([track("A", cid: false)], startIndex: 0)
    check(BilibiliApi.shared.pageListRequests.count == 1, "the page list should be requested")
    check(f.events.states.last == .buffering, "and count as buffering")
    BilibiliApi.shared.answerPageList(.success(7))
    pump()
    check(BilibiliApi.shared.streamRequests.count == 1, "then the stream")
    answer("A")
    check(f.player.currentItem?.url == mediaUrl("A") && f.player.rate > 0, "A should play")
}

test("a seek before the first play of a restored session is where it starts") {
    GeneralStorage.shared.saveQueue([track("A"), track("B")])
    GeneralStorage.shared.savePosition(index: 0, positionSec: 75)
    GeneralStorage.shared.isRestoreEnabled = true
    let f = makeFixture()
    check(f.manager.getCurrentTrack()?.id == "A" && f.manager.getPosition() == 75, "the session should be restored")
    check(BilibiliApi.shared.streamRequests.isEmpty, "nothing loads before play")
    f.manager.play()
    f.player.calls.removeAll()
    answer("A")
    check(f.player.calls.contains("seek:75") && f.player.rate > 0, "A should play from the saved position")
}

test("the lock screen buttons act on the player") {
    let f = playingA()
    let center = MPRemoteCommandCenter.shared()
    _ = center.togglePlayPauseCommand.handler?(MPRemoteCommandEvent())
    check(f.player.rate == 0, "toggle should pause")
    _ = center.togglePlayPauseCommand.handler?(MPRemoteCommandEvent())
    check(f.player.rate > 0, "toggle should play")
    _ = center.nextTrackCommand.handler?(MPRemoteCommandEvent())
    check(f.manager.getCurrentTrack()?.id == "B", "next should move to B")
}

test("next on the last track changes nothing") {
    let f = playingA(queue: ["A"])
    f.player.advance(to: 50)
    let states = f.events.states.count
    f.manager.playNext()
    check(f.events.states.count == states, "no state should be reported")
    check(f.events.finished.isEmpty, "the track is not finished")
    check(f.player.rate > 0, "it should keep playing")
    check(GeneralStorage.shared.getSavedPosition() == 50, "the saved position should stay")
}

// MARK: - Turning the spectrum on while an HLS stream plays

let hlsPlaylist = DashAudioPlaylistLoader.playlistUrl.absoluteString

/// Answers the oldest unanswered lookup with an audio-only DASH stream, which plays as HLS.
func answerHls(_ id: String, mirrors: Int = 0, line: Int = #line) {
    guard !BilibiliApi.shared.streamRequests.isEmpty else {
        check(false, "there is no lookup to answer", line: line)
        return
    }
    let urls = (0...mirrors).map { "https://cdn\($0).test/\(id).m4s" }
    let segmentBase = BilibiliPlayUrlResponse.SegmentBase(initialization: "0-999", index_range: "1000-1999")
    BilibiliApi.shared.answerStream(.success(BilibiliStream(urls: urls, segmentBase: segmentBase, measuredLoudness: nil)))
    pump()
}

/// A queue of A and B with A playing as HLS.
func playingHlsA(mirrors: Int = 0) -> Fixture {
    let f = makeFixture()
    f.manager.setQueue(["A", "B"].map { track($0) }, startIndex: 0)
    answerHls("A", mirrors: mirrors)
    f.player.becomeReady(duration: 200)
    return f
}

/// What the module's setter does.
func setSpectrum(_ f: Fixture, _ enabled: Bool) {
    GeneralStorage.shared.isSpectrumVisualizerEnabled = enabled
    f.manager.spectrumVisualizerChanged(enabled: enabled)
    pump()
}

/// The tracks of the asset loaded from `url` finish loading. False when nothing was loading them.
@discardableResult
func finishTrackLoad(_ url: String) -> Bool {
    guard let index = AVAsset.trackLoads.firstIndex(where: { ($0.asset as? AVURLAsset)?.url.absoluteString == url }) else { return false }
    AVAsset.trackLoads.remove(at: index).completion([AVAssetTrack()], nil)
    pump()
    return true
}

test("turning the spectrum on mid-stream moves to the MP4 where playback has got to") {
    let f = playingHlsA()
    f.player.advance(to: 30)
    f.player.calls.removeAll()
    setSpectrum(f, true)
    check(BilibiliApi.shared.streamRequests.map(\.audioOnly) == [false], "the MP4 should be fetched")
    check(f.player.currentItem?.url == hlsPlaylist && f.player.rate > 0, "the HLS item should play on meanwhile")
    answer("A")
    check(f.player.currentItem?.url == hlsPlaylist, "the swap should wait for the MP4's tracks")
    f.player.advance(to: 34)
    check(finishTrackLoad(mediaUrl("A")), "the MP4's tracks should be loading")
    check(f.player.currentItem?.url == mediaUrl("A"), "the MP4 should replace the HLS item")
    check(f.player.calls.contains("seek:34"), "at the position reached at the swap, not where it was when turned on")
    check(f.player.currentItem?.audioMix != nil, "with the spectrum tap already attached")
    check(f.player.rate > 0, "and keep playing")
    check(f.events.started.count == 1 && f.events.finished.isEmpty, "the same listen goes on")
    check(f.events.errors.isEmpty, "no error should be reported")
}

test("play and pause still act on the HLS item while the MP4 is fetched") {
    let f = playingHlsA()
    setSpectrum(f, true)
    f.manager.pause()
    check(f.player.rate == 0, "pause should stop playback")
    f.manager.play()
    check(f.player.rate > 0, "play should start it again")
}

test("turned on while paused, the move keeps it paused") {
    let f = playingHlsA()
    f.player.advance(to: 20)
    f.manager.pause()
    setSpectrum(f, true)
    answer("A")
    finishTrackLoad(mediaUrl("A"))
    check(f.player.currentItem?.url == mediaUrl("A"), "the MP4 should be loaded")
    check(f.player.calls.contains("seek:20"), "at the paused position")
    check(f.player.rate == 0, "it should stay paused")
    check(UIApplication.shared.runningTasks.isEmpty, "the background task should be released")
}

test("a skip while the MP4 is fetched drops it") {
    let f = playingHlsA()
    setSpectrum(f, true)
    f.manager.playNext()
    answer("A")
    finishTrackLoad(mediaUrl("A"))
    answer("B")
    check(f.player.currentItem?.url == mediaUrl("B"), "B should play")
    check(!f.player.loaded.contains { $0.url == mediaUrl("A") }, "A's MP4 must never be loaded")
}

test("turning the spectrum off before the MP4 is ready cancels the move") {
    let f = playingHlsA()
    setSpectrum(f, true)
    answer("A")
    setSpectrum(f, false)
    finishTrackLoad(mediaUrl("A"))
    check(f.player.currentItem?.url == hlsPlaylist, "the HLS item should play on")
}

test("a failed MP4 lookup leaves the HLS item playing, and turning it on again retries") {
    let f = playingHlsA()
    setSpectrum(f, true)
    check(!BilibiliApi.shared.streamRequests.isEmpty, "the MP4 should be fetched")
    if !BilibiliApi.shared.streamRequests.isEmpty {
        BilibiliApi.shared.answerStream(.failure(offline))
        pump()
    }
    check(f.player.currentItem?.url == hlsPlaylist && f.player.rate > 0, "the HLS item should play on")
    check(f.events.errors.isEmpty, "a failed move is not a playback error")
    setSpectrum(f, false)
    setSpectrum(f, true)
    check(BilibiliApi.shared.streamRequests.map(\.audioOnly) == [false], "turning it on again should try again")
}

test("the move still works after a mirror failover") {
    let f = playingHlsA(mirrors: 1)
    f.player.advance(to: 40)
    f.player.failItem(offline)
    pump()
    check(f.player.currentItem?.url == hlsPlaylist, "the mirror should load as HLS")
    f.player.becomeReady(duration: 200)
    setSpectrum(f, true)
    check(BilibiliApi.shared.streamRequests.map(\.audioOnly) == [false], "the MP4 should be fetched for the mirror too")
}

test("MP4 and downloaded items need no move") {
    let f = playingA()
    setSpectrum(f, true)
    check(BilibiliApi.shared.streamRequests.isEmpty, "an MP4 item already takes the tap")

    resetWorld()
    OrpheusDownloadManager.shared.localFiles["A"] = URL(string: "file:///downloads/A.m4a")!
    let g = makeFixture()
    g.manager.setQueue(["A", "B"].map { track($0) }, startIndex: 0)
    g.player.becomeReady(duration: 200)
    setSpectrum(g, true)
    check(BilibiliApi.shared.streamRequests.isEmpty, "a downloaded file already takes the tap")
}

test("turned on while the first lookup is on the way, the move starts once HLS arrives") {
    let f = makeFixture()
    f.manager.setQueue(["A", "B"].map { track($0) }, startIndex: 0)
    setSpectrum(f, true)
    check(BilibiliApi.shared.streamRequests.count == 1, "only the first lookup should be out")
    answerHls("A")
    check(BilibiliApi.shared.streamRequests.map(\.audioOnly) == [false], "the MP4 should be fetched once the HLS item loads")
}

// MARK: - The queue on its own

func queueOf(_ ids: [String], startAt index: Int = 0, shuffled: Bool = false) -> OrpheusQueueManager {
    let queue = OrpheusQueueManager()
    queue.setQueue(ids.map { track($0) }, startFromIndex: index, inputShuffleMode: shuffled)
    return queue
}

func ids(_ tracks: [Track]) -> [String] {
    return tracks.map(\.id)
}

test("a shuffled queue starts on the chosen track and plays every track once") {
    let all = ["A", "B", "C", "D", "E", "F"]
    let queue = queueOf(all, startAt: 2, shuffled: true)
    check(queue.getPlaybackQueue().first?.id == "C", "the chosen track should come first")
    var played = ["C"]
    while let next = queue.getNextIndex(repeatMode: .off) {
        queue.skipTo(backingIndex: next)
        played.append(queue.getCurrentTrack()?.id ?? "?")
        if played.count > all.count { break }
    }
    check(played.count == all.count && Set(played) == Set(all), "every track should play exactly once")
    check(ids(queue.getQueue()) == all, "the stored order should not change")
}

test("the queue wraps around only when it repeats") {
    let queue = queueOf(["A", "B"], startAt: 1)
    check(queue.getNextIndex(repeatMode: .off) == nil, "no next track without repeat")
    check(queue.getNextIndex(repeatMode: .queue) == 0, "repeat goes back to the first")
    queue.skipTo(backingIndex: 0)
    check(queue.getPreviousIndex(repeatMode: .off) == nil, "no previous track without repeat")
    check(queue.getPreviousIndex(repeatMode: .queue) == 1, "repeat goes back to the last")
}

test("play next moves a queued track instead of adding a copy") {
    let queue = queueOf(["A", "B", "C"])
    queue.insertNext(track: track("C"))
    check(ids(queue.getPlaybackQueue()) == ["A", "C", "B"], "C should move up behind A")
    queue.insertNext(track: track("A"))
    check(ids(queue.getPlaybackQueue()) == ["A", "C", "B"], "the current track should stay where it is")
    queue.insertNext(track: track("D"))
    check(ids(queue.getPlaybackQueue()) == ["A", "D", "C", "B"], "a new track should come next")
}

test("play next while shuffled comes right after the current track") {
    let queue = queueOf(["A", "B", "C", "D"], startAt: 1, shuffled: true)
    queue.insertNext(track: track("E"))
    let order = ids(queue.getPlaybackQueue())
    check(order.count == 5 && order[0] == "B" && order[1] == "E", "E should play right after B")
    check(queue.getCurrentTrack()?.id == "B", "the current track should not change")
}

test("removing tracks keeps the right one current") {
    let queue = queueOf(["A", "B", "C"], startAt: 2)
    check(queue.removeTrack(at: 0) == false, "removing an earlier track is not a track change")
    check(queue.getCurrentTrack()?.id == "C", "C should still be current")
    queue.skipTo(backingIndex: 0)
    check(queue.removeTrack(at: 0) == true, "removing the current track is a track change")
    check(queue.getCurrentTrack()?.id == "C", "the track after it should take over")
    check(queue.removeTrack(at: 0) == true && queue.getCurrentTrack() == nil, "an emptied queue has no current track")
}

test("moving a track keeps the current one") {
    let queue = queueOf(["A", "B", "C", "D"], startAt: 1)
    check(queue.moveTrack(fromIndex: 0, toIndex: 3), "the move should apply")
    check(ids(queue.getQueue()) == ["B", "C", "D", "A"], "A should be last")
    check(queue.getCurrentTrack()?.id == "B", "B should still be current")
    check(queue.moveTrack(fromIndex: 0, toIndex: 2), "moving the current track should apply")
    check(ids(queue.getQueue()) == ["C", "D", "B", "A"] && queue.getCurrentTrack()?.id == "B", "B should still be current after moving")
}

test("moving while shuffled changes only the playback order") {
    let all = ["A", "B", "C", "D"]
    let queue = queueOf(all, startAt: 0, shuffled: true)
    let before = ids(queue.getPlaybackQueue())
    check(queue.moveTrack(fromIndex: 1, toIndex: 3), "the move should apply")
    check(ids(queue.getPlaybackQueue()) == [before[0], before[2], before[3], before[1]], "the playback order should follow the move")
    check(ids(queue.getQueue()) == all, "the stored order should not change")
    check(queue.getCurrentTrack()?.id == "A", "the current track should not change")
}

test("only the tracks still to come are reversed") {
    let queue = queueOf(["A", "B", "C", "D"], startAt: 1)
    check(queue.reverseRemainingQueue(), "the reversal should apply")
    check(ids(queue.getQueue()) == ["A", "B", "D", "C"], "only C and D should swap")
    check(queueOf(["A", "B", "C"], shuffled: true).reverseRemainingQueue() == false, "a shuffled queue has no direction to reverse")
}

test("shuffle outlives a cleared queue") {
    let queue = queueOf(["A", "B"], shuffled: true)
    queue.clear()
    queue.append(tracks: ["C", "D", "E"].map { track($0) })
    check(queue.isShuffled(), "the new tracks should be shuffled")
    check(queue.getPlaybackQueue().first?.id == queue.getCurrentTrack()?.id, "and start on the current track")
}

// MARK: - Audio quality

/// What the chooser takes from a video with these streams, as "kind id", or "none" for the MP4.
func choose(_ preference: AudioQualityPreference, aac: [Int] = [30216, 30232, 30280], hiRes: Bool = false, dolby: Bool = false,
            unindexed: Set<Int> = []) -> String {
    func candidate(_ id: Int) -> AudioStreamCandidate<Int> {
        return AudioStreamCandidate(stream: id, id: id, playable: !unindexed.contains(id))
    }
    let choice = AudioStreamChooser.choose(preference, aac: aac.map(candidate), hiRes: hiRes ? candidate(AudioStreamId.hires) : nil,
                                           dolby: dolby ? [candidate(AudioStreamId.dolby)] : [])
    return choice.map { "\($0.kind.rawValue) \($0.candidate.id)" } ?? "none"
}

test("each AAC choice takes its own stream") {
    check(choose(.low) == "normal 30216", "低 should take 64k")
    check(choose(.standard) == "normal 30232", "标准 should take 132k")
    check(choose(.high) == "normal 30280", "高品 should take 192k")
}

test("a missing AAC stream gives way to the best one below it, else the lowest") {
    check(choose(.high, aac: [30216, 30232]) == "normal 30232", "高品 should settle for 132k")
    check(choose(.standard, aac: [30216, 30280]) == "normal 30216", "a stream below comes before one above")
    check(choose(.low, aac: [30232, 30280]) == "normal 30232", "with nothing below, the lowest")
}

test("Hi-Res and Dolby are taken only when asked for and offered") {
    check(choose(.high, hiRes: true, dolby: true) == "normal 30280", "高品 stays with AAC")
    check(choose(.hires, hiRes: true, dolby: true) == "hires 30251", "Hi-Res should take the FLAC stream")
    check(choose(.dolby, hiRes: true, dolby: true) == "dolby 30250", "Dolby should take the Dolby stream")
    check(choose(.dolby, hiRes: true) == "hires 30251", "Dolby without a Dolby stream should take Hi-Res")
    check(choose(.hires) == "normal 30280", "Hi-Res without a FLAC stream should take 高品")
    check(choose(.dolby) == "normal 30280", "Dolby with neither should take 高品")
}

test("a stream without an index gives way to the next choice") {
    check(choose(.dolby, hiRes: true, dolby: true, unindexed: [30250]) == "hires 30251", "Dolby should give way to Hi-Res")
    check(choose(.hires, hiRes: true, unindexed: [30251]) == "normal 30280", "Hi-Res should give way to 高品")
    check(choose(.high, unindexed: [30280]) == "normal 30232", "192k should give way to 132k")
    check(choose(.high, unindexed: [30216, 30232, 30280]) == "none", "with no playable stream it's the MP4")
}

test("the offered qualities follow the answer, not what can play") {
    check(AudioStreamChooser.offeredQualities(aacIds: [30216, 30232, 30280], hasHiRes: true, hasDolby: false) == [.low, .standard, .high, .hires],
          "three AAC streams and Hi-Res")
    check(AudioStreamChooser.offeredQualities(aacIds: [30280], hasHiRes: false, hasDolby: true) == [.high, .dolby], "高品 and Dolby")
}

test("a fallback is anything short of the choice") {
    func info(_ preference: AudioQualityPreference, _ kind: AudioQualityKind, _ id: Int? = nil) -> AudioQualityInfo {
        return AudioQualityInfo(preferredQuality: preference, actualKind: kind, actualStreamId: id)
    }
    check(!info(.high, .normal, 30280).isFallback, "192k for 高品 is what was asked for")
    check(info(.high, .normal, 30232).isFallback, "132k for 高品 is a fallback")
    check(!info(.low, .normal, 30280).isFallback, "a better stream than asked for is not")
    check(info(.hires, .normal, 30280).isFallback, "AAC for Hi-Res is a fallback")
    check(info(.dolby, .hires, 30251).isFallback, "Hi-Res for Dolby is a fallback")
    check(info(.high, .durl).isFallback, "the MP4 is a fallback")
    check(!info(.high, .unknown).isFallback && !info(.high, .local).isFallback, "an unknown or local stream is not")
}

test("an unknown saved choice reads as 高品") {
    check(AudioQualityPreference.normalize(nil) == .high, "nothing saved")
    check(AudioQualityPreference.normalize("lossless") == .high, "a value this version doesn't know")
    check(AudioQualityPreference.normalize("dolby") == .dolby, "a known value")
}

test("the panel reads a stream only once AVPlayer has accepted it") {
    let f = makeFixture()
    var reported: [AudioQualityInfo] = []
    f.manager.onAudioQualityChanged = { reported.append($0) }
    GeneralStorage.shared.preferredAudioQuality = .hires
    f.manager.setQueue(["A", "B"].map { track($0) }, startIndex: 0)
    check(f.manager.getCurrentAudioQuality()?.actualKind == .unknown, "unknown while the lookup runs")
    let segmentBase = BilibiliPlayUrlResponse.SegmentBase(initialization: "0-999", index_range: "1000-1999")
    BilibiliApi.shared.answerStream(.success(BilibiliStream(urls: ["https://cdn0.test/A.m4s"], segmentBase: segmentBase, measuredLoudness: nil,
                                                            kind: .hires, streamId: AudioStreamId.hires, codecs: "fLaC",
                                                            availableQualities: [.high, .hires])))
    pump()
    check(f.manager.getCurrentAudioQuality()?.actualKind == .unknown, "still unknown before the item is ready")
    check(reported.isEmpty, "nothing reported before the item is ready")
    f.player.becomeReady(duration: 200)
    pump()
    check(f.manager.getCurrentAudioQuality()?.actualKind == .hires, "Hi-Res once ready")
    check(reported.map(\.actualKind) == [.hires], "reported once, when ready")
    GeneralStorage.shared.preferredAudioQuality = .low
    check(f.manager.getCurrentAudioQuality()?.preferredQuality == .hires, "the playing track keeps the choice it was loaded with")
}

test("the MP4 fallback keeps the choice the track was loaded with") {
    GeneralStorage.shared.preferredAudioQuality = .low
    let f = playingHlsA()
    check(BilibiliApi.shared.streamRequestCount == 1, "A should have been looked up once")
    GeneralStorage.shared.preferredAudioQuality = .hires
    f.player.failItem(offline)
    pump()
    check(BilibiliApi.shared.streamRequests.map(\.audioOnly) == [false], "the MP4 should be fetched")
    check(BilibiliApi.shared.streamRequests.map(\.quality) == [.low], "with A's own choice, not the new one")
    answer("A")
    f.manager.playNext()
    check(BilibiliApi.shared.streamRequests.map(\.quality) == [.hires], "the next track should use the new choice")
}

test("a new quality choice reloads the track where playback has got to") {
    let f = playingHlsA()
    f.player.advance(to: 30)
    GeneralStorage.shared.preferredAudioQuality = .hires
    let result = f.manager.reloadCurrentTrackForQualityChange()
    check(result.reloaded && result.reason == "reloaded", "A should reload")
    check(BilibiliApi.shared.streamRequests.map(\.quality) == [.hires], "with the new choice")
    check(f.player.currentItem?.url == hlsPlaylist && f.player.rate > 0, "A should play on meanwhile")
    f.player.advance(to: 33)
    f.player.calls.removeAll()
    answerHls("A")
    check(f.player.calls.contains("seek:33"), "at the position reached when the stream came back")
    check(f.player.rate > 0, "and keep playing")
    check(f.events.errors.isEmpty, "a reload is not an error")
}

test("a reload that comes back after a skip is dropped") {
    let f = playingHlsA()
    GeneralStorage.shared.preferredAudioQuality = .low
    _ = f.manager.reloadCurrentTrackForQualityChange()
    f.manager.playNext()
    answerHls("A")
    check(f.player.currentItem == nil || f.player.currentItem?.url != hlsPlaylist, "A's reload must not load over B")
    answer("B")
    check(f.player.currentItem?.url == mediaUrl("B"), "B should play")
}

test("a reload that comes back after a failover is dropped") {
    let f = playingHlsA(mirrors: 1)
    GeneralStorage.shared.preferredAudioQuality = .low
    _ = f.manager.reloadCurrentTrackForQualityChange()
    f.player.calls.removeAll()
    f.player.failItem(offline)
    pump()
    check(f.player.count("replace:\(hlsPlaylist)") == 1, "the mirror should replace the failed item")
    answerHls("A")
    check(f.player.count("replace:\(hlsPlaylist)") == 1, "the reload must not replace the mirror")
}

test("the spectrum turned on during a reload moves to the MP4 even if the reload fails") {
    let f = playingHlsA()
    GeneralStorage.shared.preferredAudioQuality = .hires
    _ = f.manager.reloadCurrentTrackForQualityChange()
    setSpectrum(f, true)
    check(BilibiliApi.shared.streamRequests.map(\.audioOnly) == [true], "the move should wait for the reload")
    BilibiliApi.shared.answerStream(.failure(offline))
    pump()
    check(BilibiliApi.shared.streamRequests.map(\.audioOnly) == [false], "the MP4 should be fetched once the reload has failed")
}

test("the spectrum turned on during a reload moves to the MP4 when a failover drops the reload") {
    let f = playingHlsA(mirrors: 1)
    _ = f.manager.reloadCurrentTrackForQualityChange()
    setSpectrum(f, true)
    f.player.failItem(offline)
    pump()
    answerHls("A")
    check(BilibiliApi.shared.streamRequests.map(\.audioOnly) == [false], "the MP4 should be fetched for the mirror")
}

test("a lookup a failure started during a reload doesn't replace the reloaded stream") {
    let f = playingHlsA()
    GeneralStorage.shared.preferredAudioQuality = .hires
    _ = f.manager.reloadCurrentTrackForQualityChange()
    f.player.failItem(offline)
    pump()
    check(BilibiliApi.shared.streamRequests.map(\.audioOnly) == [true, false], "the reload and the MP4 fallback should both be on their way")
    answerHls("A")
    check(f.player.currentItem?.url == hlsPlaylist, "the reloaded stream should be loaded")
    answer("A")
    check(f.player.currentItem?.url == hlsPlaylist, "the older MP4 lookup must not replace it")
}

test("with the spectrum on, a new choice is kept for when it is off") {
    GeneralStorage.shared.isSpectrumVisualizerEnabled = true
    let f = playingA()
    GeneralStorage.shared.preferredAudioQuality = .hires
    let result = f.manager.reloadCurrentTrackForQualityChange()
    check(!result.reloaded && result.reason == "spectrum", "the MP4 the spectrum needs comes in one quality")
    check(BilibiliApi.shared.streamRequestCount == 1, "nothing more should be looked up")
    setSpectrum(f, false)
    f.manager.playNext()
    check(BilibiliApi.shared.streamRequests.map(\.quality) == [.hires], "the next track should use the choice")
    check(BilibiliApi.shared.streamRequests.map(\.audioOnly) == [true], "as audio, now the spectrum is off")
}

test("an MP4 played for the spectrum says why") {
    GeneralStorage.shared.isSpectrumVisualizerEnabled = true
    let f = playingA()
    check(BilibiliApi.shared.streamRequests.isEmpty, "the lookup should have been answered")
    check(f.manager.getCurrentAudioQuality()?.fallbackReason == .spectrum, "the spectrum's MP4 should say so")
    check(f.manager.getCurrentAudioQuality()?.dictionary["fallbackReason"] as? String == "spectrum", "and JS should get the reason")
}

test("the MP4 a failed stream falls back to gives no reason") {
    let f = playingHlsA()
    f.player.failItem(offline)
    pump()
    answer("A")
    f.player.becomeReady(duration: 200)
    pump()
    check(f.manager.getCurrentAudioQuality()?.actualKind == .durl, "the failed HLS item should have fallen back to the MP4")
    check(f.manager.getCurrentAudioQuality()?.fallbackReason == nil, "which is a plain fallback")
    check(f.manager.getCurrentAudioQuality()?.dictionary["fallbackReason"] == nil, "so JS gets no reason at all")
}

test("the move to the MP4 for the spectrum says why") {
    let f = playingHlsA()
    setSpectrum(f, true)
    answer("A")
    check(finishTrackLoad(mediaUrl("A")), "the MP4's tracks should be loading")
    f.player.becomeReady(duration: 200)
    pump()
    check(f.manager.getCurrentAudioQuality()?.fallbackReason == .spectrum, "the MP4 should say it is there for the spectrum")
}

test("a reload is declined for a download or a track not from Bilibili") {
    let f = makeFixture()
    check(f.manager.reloadCurrentTrackForQualityChange().reason == "no_track", "an empty queue has nothing to reload")
    OrpheusDownloadManager.shared.localFiles["A"] = URL(fileURLWithPath: "/downloads/A.mp4")
    var web = track("C")
    web.url = "https://example.test/C.mp3"
    f.manager.setQueue([track("A"), web], startIndex: 0)
    pump()
    check(f.manager.reloadCurrentTrackForQualityChange().reason == "downloaded", "a download plays as it was downloaded")
    f.manager.playNext()
    pump()
    check(f.manager.reloadCurrentTrackForQualityChange().reason == "not_bilibili", "a web stream has no qualities")
    check(BilibiliApi.shared.streamRequestCount == 0, "nothing should have been looked up")
}

// MARK: - Result

print("")
if failedChecks == 0 {
    print("all tests passed")
} else {
    print("\(failedChecks) failed checks in \(failedTests.count) tests:")
    failedTests.forEach { print("  \($0)") }
}
exit(failedChecks == 0 ? 0 : 1)

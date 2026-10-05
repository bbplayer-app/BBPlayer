import expo.modules.orpheus.util.PlaybackHistoryTracker
import kotlin.math.abs

private fun assertNear(actual: Double, expected: Double) { check(abs(actual - expected) < 1e-5) { "$actual != $expected" } }
private fun loop(start: Double = 60.0, end: Double = 90.0): PlaybackHistoryTracker {
    return PlaybackHistoryTracker().also { it.begin("track", start, 1234L); it.setLoop(start, end); it.sample(start, true, 180.0) }
}

fun main() {
    var cases = 0
    fun test(name: String, body: () -> Unit) { body(); cases++; println("PASS: $name") }
    test("absolute position does not imply segment completion") {
        val t = loop(); t.sample(61.0, true, 180.0)
        val s = t.finish()!!; check(!s.completed); assertNear(s.playedSeconds, 1.0); check(s.startedAt == 1234L)
    }
    test("completion and duration survive multiple wraps") {
        val t = loop(0.0, 30.0)
        repeat(3) { t.jump(30.0, 0.0, true, 180.0) }
        t.sample(1.0, true, 180.0)
        val s = t.finish()!!; check(s.completed); assertNear(s.playedSeconds, 91.0); check(t.finish() == null)
    }
    test("pause and buffering do not add duration") {
        val t = loop(); t.sample(65.0, false, 180.0); t.sample(65.0, false, 180.0)
        t.sample(65.0, true, 180.0); t.sample(70.0, false, 180.0)
        assertNear(t.finish()!!.playedSeconds, 10.0)
    }
    test("manual seeks do not count skipped content and reset the round") {
        val t = loop(); t.jump(61.0, 89.0, true, 180.0); t.jump(90.0, 60.0, true, 180.0)
        val s = t.finish()!!; check(!s.completed); assertNear(s.playedSeconds, 2.0)
    }
    test("playback speed uses media seconds") {
        val t = loop(); t.sample(62.0, true, 180.0); assertNear(t.finish()!!.playedSeconds, 2.0)
    }
    test("editing and clearing preserve totals and completion") {
        val t = loop(); t.sample(89.0, true, 180.0); t.setLoop(80.0, 100.0)
        t.sample(95.0, true, 180.0); t.setLoop(null, null); t.sample(105.0, true, 180.0)
        val s = t.finish()!!; check(s.completed); assertNear(s.playedSeconds, 45.0)
    }
    test("reapplying the same range does not reset a round") {
        val t = loop(); t.sample(75.0, true, 180.0); t.setLoop(60.0, 90.0); t.sample(89.0, true, 180.0)
        check(t.finish()!!.completed)
    }
    test("subsecond segments require actual playback") {
        val t = loop(0.0, 0.5); t.sample(0.1, true, 180.0); check(!t.finish()!!.completed)
        val full = loop(0.0, 0.5); full.sample(0.5, true, 180.0); check(full.finish()!!.completed)
    }
    test("intro and content after B are excluded") {
        val t = PlaybackHistoryTracker(); t.begin("track", 0.0); t.setLoop(60.0, 90.0)
        t.sample(0.0, true, 180.0); t.sample(100.0, false, 180.0)
        assertNear(t.finish()!!.playedSeconds, 30.0)
    }
    test("completion survives leaving exactly at A after a wrap") {
        val t = loop(); t.jump(90.0, 60.0, true, 180.0)
        val s = t.finish()!!; check(s.completed); assertNear(s.playedSeconds, 30.0)
    }
    test("clearing an incomplete loop uses the ordinary track target") {
        val t = loop(); t.sample(61.0, true, 180.0); t.setLoop(null, null)
        t.sample(90.0, true, 180.0)
        val s = t.finish()!!; check(!s.completed); assertNear(s.playedSeconds, 30.0)
    }
    test("unknown duration does not discard played media before enabling AB") {
        val t = PlaybackHistoryTracker(); t.begin("track", 0.0); t.sample(0.0, true, 0.0)
        t.sample(5.0, true, 0.0); t.setLoop(5.0, 10.0); t.sample(10.0, true, 20.0)
        assertNear(t.finish()!!.playedSeconds, 10.0)
    }
    println("$cases playback-history cases passed")
}

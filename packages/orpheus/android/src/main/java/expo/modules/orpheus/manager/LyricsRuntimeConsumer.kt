package expo.modules.orpheus.manager

import expo.modules.orpheus.model.LyricsData
import expo.modules.orpheus.model.LyricsLine
import expo.modules.orpheus.util.GeneralStorage

interface LyricsRuntimeConsumer {
    fun submit(data: LyricsData, timeline: LyricsTimeline)
    fun clear(softHide: Boolean = false)
    fun tick(seconds: Double)
    fun setPlaybackState(isPlaying: Boolean) = Unit
}

class DesktopLyricsConsumer(
    private val floatingLyricsManager: FloatingLyricsManager,
    private val currentPlaybackSeconds: () -> Double?,
) : LyricsRuntimeConsumer {
    private var timeline: LyricsTimeline? = null
    private var lastLineIndex = UNSET_LINE_INDEX

    override fun submit(data: LyricsData, timeline: LyricsTimeline) {
        this.timeline = timeline

        if (
            data.lyrics.isNotEmpty() &&
            GeneralStorage.isDesktopLyricsShown() &&
            !floatingLyricsManager.isShowing
        ) {
            floatingLyricsManager.show()
        }

        lastLineIndex = UNSET_LINE_INDEX
        currentPlaybackSeconds()?.let(::tick) ?: floatingLyricsManager.clearLyrics()
    }

    override fun clear(softHide: Boolean) {
        timeline = null
        lastLineIndex = UNSET_LINE_INDEX
        floatingLyricsManager.clearLyrics()
        if (softHide) {
            floatingLyricsManager.softHide()
        }
    }

    override fun tick(seconds: Double) {
        val snapshot = timeline?.snapshotAt(seconds) ?: return

        if (snapshot.lineIndex != lastLineIndex) {
            floatingLyricsManager.setCurrentLine(snapshot.line)
            lastLineIndex = snapshot.lineIndex
        }

        floatingLyricsManager.updateLyricProgress(snapshot.adjustedTimeMs)
    }
}

class StatusBarLyricsConsumer(
    private val statusBarLyricsManager: StatusBarLyricsManager,
    private val currentPlaybackSeconds: () -> Double?,
) : LyricsRuntimeConsumer {
    private var timeline: LyricsTimeline? = null
    private var lastLineIndex = UNSET_LINE_INDEX

    override fun submit(data: LyricsData, timeline: LyricsTimeline) {
        this.timeline = timeline

        statusBarLyricsManager.setLyricsData(data)
        lastLineIndex = UNSET_LINE_INDEX
        currentPlaybackSeconds()?.let(::tick) ?: statusBarLyricsManager.renderLyricFrame(null)
    }

    override fun clear(softHide: Boolean) {
        timeline = null
        lastLineIndex = UNSET_LINE_INDEX
        statusBarLyricsManager.onStop()
    }

    override fun tick(seconds: Double) {
        val snapshot = timeline?.snapshotAt(seconds) ?: return

        if (snapshot.lineIndex != lastLineIndex) {
            statusBarLyricsManager.renderLyricFrame(
                snapshot.line?.let { line ->
                    StatusBarLyricFrame(
                        line = line,
                        positionMs = snapshot.adjustedTimeMs,
                        lineDurationMs = snapshot.lineDurationMs,
                        lineProgressMs = snapshot.lineProgressMs,
                        delayMs = snapshot.delayMs,
                    )
                },
            )
            if (snapshot.line == null) {
                statusBarLyricsManager.updateProgress(snapshot.adjustedTimeMs, snapshot.lineProgressMs)
            }
            lastLineIndex = snapshot.lineIndex
        } else if (snapshot.line != null) {
            statusBarLyricsManager.updateProgress(snapshot.adjustedTimeMs, snapshot.lineProgressMs)
        }
    }

    override fun setPlaybackState(isPlaying: Boolean) {
        statusBarLyricsManager.setPlaybackState(isPlaying)
    }
}

class CarLyricsConsumer(
    private val currentPlaybackSeconds: () -> Double?,
    private val onCarLyricsChanged: (String?) -> Unit,
) : LyricsRuntimeConsumer {
    private var timeline: LyricsTimeline? = null
    private var lastLyricText: String? = null

    override fun submit(data: LyricsData, timeline: LyricsTimeline) {
        this.timeline = timeline
        lastLyricText = null

        if (GeneralStorage.isCarLyricsEnabled()) {
            currentPlaybackSeconds()?.let { tick(it, force = true) }
        } else {
            onCarLyricsChanged(null)
        }
    }

    override fun clear(softHide: Boolean) {
        timeline = null
        lastLyricText = null
        onCarLyricsChanged(null)
    }

    override fun tick(seconds: Double) {
        tick(seconds, force = false)
    }

    fun setEnabled(enabled: Boolean) {
        if (enabled) {
            currentPlaybackSeconds()?.let { tick(it, force = true) }
        } else {
            lastLyricText = null
            onCarLyricsChanged(null)
        }
    }

    private fun tick(seconds: Double, force: Boolean) {
        if (!GeneralStorage.isCarLyricsEnabled()) return

        val nextLyric = timeline
            ?.snapshotAt(seconds)
            ?.line
            ?.text
            ?.takeIf { it.isNotBlank() }
        if (!force && nextLyric == lastLyricText) return

        lastLyricText = nextLyric
        onCarLyricsChanged(nextLyric)
    }
}

private const val UNSET_LINE_INDEX = Int.MIN_VALUE

private enum class LyricTextField {
    TEXT,
    TRANSLATION,
    ROMAJI,
    TRANSLATION_OR_ROMAJI,
}

private data class LyricsConsumerProfile(
    val primaryText: LyricTextField = LyricTextField.TEXT,
    val secondaryText: LyricTextField? = null,
    val preserveTranslation: Boolean = false,
    val preserveRomaji: Boolean = false,
    val preserveWordTiming: Boolean = false,
)

fun projectLyricsForConsumer(data: LyricsData, consumer: LyricsConsumer): LyricsData {
    val profile = when (consumer) {
        LyricsConsumer.DESKTOP -> LyricsConsumerProfile(
            preserveTranslation = true,
            preserveRomaji = true,
            preserveWordTiming = true,
        )
        LyricsConsumer.STATUS_BAR -> LyricsConsumerProfile(
            secondaryText = LyricTextField.TRANSLATION_OR_ROMAJI,
            preserveWordTiming = true,
        )
        LyricsConsumer.CAR -> LyricsConsumerProfile(
            primaryText = LyricTextField.TEXT,
        )
    }

    return LyricsData(
        lyrics = data.lyrics.mapNotNull { line -> projectLine(line, profile) },
        offset = data.offset,
    )
}

private fun projectLine(line: LyricsLine, profile: LyricsConsumerProfile): LyricsLine? {
    val primaryText = resolveText(line, profile.primaryText)
        ?.takeIf { it.isNotBlank() }
        ?: return null
    val secondaryText = profile.secondaryText
        ?.let { field -> resolveText(line, field) }
        ?.takeIf { it.isNotBlank() }

    val translation = when {
        profile.preserveTranslation -> line.translation
        profile.secondaryText == LyricTextField.TRANSLATION ||
            profile.secondaryText == LyricTextField.TRANSLATION_OR_ROMAJI -> secondaryText
        else -> null
    }
    val romaji = when {
        profile.preserveRomaji -> line.romaji
        profile.secondaryText == LyricTextField.ROMAJI -> secondaryText
        else -> null
    }
    val spans = if (profile.preserveWordTiming && primaryText == line.text) {
        line.spans
    } else {
        null
    }

    return line.copy(
        text = primaryText,
        translation = translation,
        romaji = romaji,
        spans = spans,
    )
}

private fun resolveText(line: LyricsLine, field: LyricTextField): String? {
    return when (field) {
        LyricTextField.TEXT -> line.text
        LyricTextField.TRANSLATION -> line.translation
        LyricTextField.ROMAJI -> line.romaji
        LyricTextField.TRANSLATION_OR_ROMAJI -> line.translation ?: line.romaji
    }
}

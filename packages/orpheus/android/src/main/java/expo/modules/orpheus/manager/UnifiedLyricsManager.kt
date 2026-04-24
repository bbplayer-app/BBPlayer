package expo.modules.orpheus.manager

import expo.modules.orpheus.model.LyricsData
import expo.modules.orpheus.model.LyricsLine
import expo.modules.orpheus.util.GeneralStorage

enum class LyricsConsumer {
    DESKTOP,
    STATUS_BAR,
    CAR;

    companion object {
        fun all(): Set<LyricsConsumer> = linkedSetOf(DESKTOP, STATUS_BAR, CAR)

        fun fromIdentifier(value: String): LyricsConsumer? {
            return when (value.lowercase()) {
                "desktop" -> DESKTOP
                "statusbar", "status_bar", "status-bar" -> STATUS_BAR
                "car" -> CAR
                else -> null
            }
        }
    }
}

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

class UnifiedLyricsManager(
    private val floatingLyricsManager: FloatingLyricsManager,
    private val statusBarLyricsManager: StatusBarLyricsManager,
    private val currentPlaybackSeconds: () -> Double?,
    private val onCarLyricsChanged: (String?) -> Unit,
) {

    private var sharedLyrics: LyricsData = EMPTY_LYRICS
    private val consumerOverrides = mutableMapOf<LyricsConsumer, LyricsData>()
    private val projectedLyrics = mutableMapOf<LyricsConsumer, LyricsData>()
    private var lastCarLyricText: String? = null
    private var lastDesktopLineIndex: Int = UNSET_LINE_INDEX
    private var lastStatusBarLineIndex: Int = UNSET_LINE_INDEX

    fun submitLyrics(data: LyricsData, consumers: Set<LyricsConsumer> = LyricsConsumer.all()) {
        val normalized = normalize(data)
        val isAllConsumers = consumers.size == LyricsConsumer.entries.size
        val affectedConsumers = if (isAllConsumers) LyricsConsumer.all() else consumers

        if (isAllConsumers) {
            sharedLyrics = normalized
            consumerOverrides.clear()
        } else {
            consumers.forEach { consumer ->
                consumerOverrides[consumer] = normalized
            }
        }

        refreshProjectedLyrics(affectedConsumers)
        affectedConsumers.forEach(::applyLyricsToConsumer)
    }

    fun clearConsumers(consumers: Set<LyricsConsumer>, softHideDesktop: Boolean = false) {
        if (consumers.isEmpty()) return

        if (consumers.size == LyricsConsumer.entries.size) {
            sharedLyrics = EMPTY_LYRICS
            consumerOverrides.clear()
        } else {
            consumers.forEach { consumerOverrides[it] = EMPTY_LYRICS }
        }

        refreshProjectedLyrics(consumers)

        consumers.forEach { consumer ->
            when (consumer) {
                LyricsConsumer.DESKTOP -> {
                    lastDesktopLineIndex = UNSET_LINE_INDEX
                    floatingLyricsManager.clearLyrics()
                    if (softHideDesktop) {
                        floatingLyricsManager.softHide()
                    }
                }
                LyricsConsumer.STATUS_BAR -> {
                    lastStatusBarLineIndex = UNSET_LINE_INDEX
                    statusBarLyricsManager.onStop()
                }
                LyricsConsumer.CAR -> {
                    lastCarLyricText = null
                    onCarLyricsChanged(null)
                }
            }
        }
    }

    fun updateTime(seconds: Double) {
        updateDesktopConsumer(seconds)
        updateStatusBarConsumer(seconds)
        updateCarLyrics(seconds)
    }

    fun setPlaybackState(isPlaying: Boolean) {
        statusBarLyricsManager.setPlaybackState(isPlaying)
    }

    fun setCarLyricsEnabled(enabled: Boolean) {
        if (enabled) {
            currentPlaybackSeconds()?.let { seconds ->
                updateCarLyrics(seconds, force = true)
            }
        } else {
            lastCarLyricText = null
            onCarLyricsChanged(null)
        }
    }

    private fun applyLyricsToConsumer(consumer: LyricsConsumer) {
        val projected = projectedLyrics[consumer] ?: EMPTY_LYRICS

        when (consumer) {
            LyricsConsumer.DESKTOP -> {
                if (
                    projected.lyrics.isNotEmpty() &&
                    GeneralStorage.isDesktopLyricsShown() &&
                    !floatingLyricsManager.isShowing
                ) {
                    floatingLyricsManager.show()
                }
                lastDesktopLineIndex = UNSET_LINE_INDEX
                currentPlaybackSeconds()?.let(::updateDesktopConsumer) ?: floatingLyricsManager.clearLyrics()
            }
            LyricsConsumer.STATUS_BAR -> {
                lastStatusBarLineIndex = UNSET_LINE_INDEX
                currentPlaybackSeconds()?.let(::updateStatusBarConsumer)
                    ?: statusBarLyricsManager.renderLyricFrame(null)
            }
            LyricsConsumer.CAR -> {
                lastCarLyricText = null
                if (GeneralStorage.isCarLyricsEnabled()) {
                    currentPlaybackSeconds()?.let { seconds ->
                        updateCarLyrics(seconds, force = true)
                    }
                } else {
                    onCarLyricsChanged(null)
                }
            }
        }
    }

    private fun dataForConsumer(consumer: LyricsConsumer): LyricsData {
        return consumerOverrides[consumer] ?: sharedLyrics
    }

    private fun refreshProjectedLyrics(consumers: Set<LyricsConsumer>) {
        consumers.forEach { consumer ->
            projectedLyrics[consumer] = projectLyrics(dataForConsumer(consumer), consumer)
        }
    }

    private fun updateDesktopConsumer(seconds: Double) {
        val snapshot = snapshotFor(LyricsConsumer.DESKTOP, seconds)

        if (snapshot.lineIndex != lastDesktopLineIndex) {
            floatingLyricsManager.setCurrentLine(snapshot.line)
            lastDesktopLineIndex = snapshot.lineIndex
        }

        floatingLyricsManager.updateLyricProgress(snapshot.adjustedTimeMs)
    }

    private fun updateStatusBarConsumer(seconds: Double) {
        val snapshot = snapshotFor(LyricsConsumer.STATUS_BAR, seconds)

        if (snapshot.lineIndex != lastStatusBarLineIndex) {
            statusBarLyricsManager.renderLyricFrame(
                snapshot.line?.let { line ->
                    StatusBarLyricFrame(
                        line = line,
                        lineDurationMs = snapshot.lineDurationMs,
                        lineProgressMs = snapshot.lineProgressMs,
                        delayMs = snapshot.delayMs,
                    )
                },
            )
            lastStatusBarLineIndex = snapshot.lineIndex
        } else if (snapshot.line != null) {
            statusBarLyricsManager.updateProgress(snapshot.lineProgressMs)
        }
    }

    private fun updateCarLyrics(seconds: Double, force: Boolean = false) {
        if (!GeneralStorage.isCarLyricsEnabled()) return

        val nextLyric = snapshotFor(LyricsConsumer.CAR, seconds).line?.text?.takeIf { it.isNotBlank() }
        if (!force && nextLyric == lastCarLyricText) return

        lastCarLyricText = nextLyric
        onCarLyricsChanged(nextLyric)
    }

    private fun snapshotFor(consumer: LyricsConsumer, seconds: Double): LyricSnapshot {
        val data = projectedLyrics[consumer] ?: EMPTY_LYRICS
        if (data.lyrics.isEmpty()) {
            return LyricSnapshot(
                lineIndex = NO_LINE_INDEX,
                line = null,
                adjustedTimeMs = 0L,
                lineProgressMs = 0L,
                lineDurationMs = 0L,
                delayMs = 0,
            )
        }

        val adjustedTime = seconds - data.offset
        val adjustedTimeMs = (adjustedTime * 1000).toLong().coerceAtLeast(0L)
        val index = data.lyrics.indexOfLast { it.timestamp <= adjustedTime }
        if (index < 0) {
            return LyricSnapshot(
                lineIndex = NO_LINE_INDEX,
                line = null,
                adjustedTimeMs = adjustedTimeMs,
                lineProgressMs = 0L,
                lineDurationMs = 0L,
                delayMs = 0,
            )
        }

        val line = data.lyrics[index]
        val lineStartMs = (line.timestamp * 1000).toLong().coerceAtLeast(0L)
        val lineEndMs = resolveLineEndMs(data, index, lineStartMs)
        val lineProgressMs = (adjustedTimeMs - lineStartMs).coerceAtLeast(0L)
        val nextLineStartMs = data.lyrics.getOrNull(index + 1)
            ?.timestamp
            ?.times(1000)
            ?.toLong()

        return LyricSnapshot(
            lineIndex = index,
            line = line,
            adjustedTimeMs = adjustedTimeMs,
            lineProgressMs = lineProgressMs,
            lineDurationMs = (lineEndMs - lineStartMs).coerceAtLeast(1L),
            delayMs = nextLineStartMs?.minus(lineStartMs)?.toInt() ?: 0,
        )
    }

    private fun projectLyrics(data: LyricsData, consumer: LyricsConsumer): LyricsData {
        val profile = profileFor(consumer)
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

    private fun profileFor(consumer: LyricsConsumer): LyricsConsumerProfile {
        return when (consumer) {
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
    }

    private fun normalize(data: LyricsData): LyricsData {
        return data.copy(
            lyrics = data.lyrics
                .filter { it.text.isNotBlank() }
                .sortedBy { it.timestamp },
        )
    }

    private fun resolveLineEndMs(data: LyricsData, index: Int, lineStartMs: Long): Long {
        val line = data.lyrics[index]

        line.endTime?.let {
            return (it * 1000).toLong().coerceAtLeast(lineStartMs)
        }

        data.lyrics.getOrNull(index + 1)?.let {
            return (it.timestamp * 1000).toLong().coerceAtLeast(lineStartMs)
        }

        line.spans?.lastOrNull()?.let {
            return it.endTime.coerceAtLeast(lineStartMs)
        }

        return lineStartMs + DEFAULT_LINE_DURATION_MS
    }

    private companion object {
        val EMPTY_LYRICS = LyricsData(emptyList(), 0.0)
        const val DEFAULT_LINE_DURATION_MS = 5000L
        const val NO_LINE_INDEX = -1
        const val UNSET_LINE_INDEX = Int.MIN_VALUE
    }

    private data class LyricSnapshot(
        val lineIndex: Int,
        val line: LyricsLine?,
        val adjustedTimeMs: Long,
        val lineProgressMs: Long,
        val lineDurationMs: Long,
        val delayMs: Int,
    )
}

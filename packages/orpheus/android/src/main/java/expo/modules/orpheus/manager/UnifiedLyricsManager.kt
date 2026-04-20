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
    private var lastCarLyricText: String? = null

    fun submitLyrics(data: LyricsData, consumers: Set<LyricsConsumer> = LyricsConsumer.all()) {
        val normalized = normalize(data)
        val allConsumers = LyricsConsumer.all()

        if (consumers.size == allConsumers.size && consumers.containsAll(allConsumers)) {
            sharedLyrics = normalized
            consumerOverrides.clear()
        } else {
            consumers.forEach { consumer ->
                consumerOverrides[consumer] = normalized
            }
        }

        consumers.forEach(::applyLyricsToConsumer)
    }

    fun clearConsumers(consumers: Set<LyricsConsumer>, softHideDesktop: Boolean = false) {
        if (consumers.isEmpty()) return

        val allConsumers = LyricsConsumer.all()
        if (consumers.size == allConsumers.size && consumers.containsAll(allConsumers)) {
            sharedLyrics = EMPTY_LYRICS
            consumerOverrides.clear()
        } else {
            consumers.forEach { consumerOverrides.remove(it) }
        }

        consumers.forEach { consumer ->
            when (consumer) {
                LyricsConsumer.DESKTOP -> {
                    floatingLyricsManager.setLyrics(emptyList())
                    if (softHideDesktop) {
                        floatingLyricsManager.softHide()
                    }
                }
                LyricsConsumer.STATUS_BAR -> statusBarLyricsManager.onStop()
                LyricsConsumer.CAR -> {
                    lastCarLyricText = null
                    onCarLyricsChanged(null)
                }
            }
        }
    }

    fun updateTime(seconds: Double) {
        floatingLyricsManager.updateTime(seconds)
        statusBarLyricsManager.updateTime(seconds)
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
        val projected = projectLyrics(dataForConsumer(consumer), consumer)

        when (consumer) {
            LyricsConsumer.DESKTOP -> {
                if (
                    projected.lyrics.isNotEmpty() &&
                    GeneralStorage.isDesktopLyricsShown() &&
                    !floatingLyricsManager.isShowing
                ) {
                    floatingLyricsManager.show()
                }
                floatingLyricsManager.setLyrics(projected.lyrics, projected.offset)
            }
            LyricsConsumer.STATUS_BAR -> {
                statusBarLyricsManager.setLyrics(projected.lyrics, projected.offset)
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

    private fun updateCarLyrics(seconds: Double, force: Boolean = false) {
        if (!GeneralStorage.isCarLyricsEnabled()) return

        val line = currentLineFor(projectLyrics(dataForConsumer(LyricsConsumer.CAR), LyricsConsumer.CAR), seconds)
        val nextLyric = line?.text?.takeIf { it.isNotBlank() }
        if (!force && nextLyric == lastCarLyricText) return

        lastCarLyricText = nextLyric
        onCarLyricsChanged(nextLyric)
    }

    private fun currentLineFor(data: LyricsData, seconds: Double): LyricsLine? {
        if (data.lyrics.isEmpty()) return null

        val adjustedTime = seconds - data.offset
        val index = data.lyrics.indexOfLast { it.timestamp <= adjustedTime }
        if (index < 0) return null

        return data.lyrics[index]
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

    private companion object {
        val EMPTY_LYRICS = LyricsData(emptyList(), 0.0)
    }
}

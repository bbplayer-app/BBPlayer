package expo.modules.orpheus.manager

import expo.modules.orpheus.model.LyricsData

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

class UnifiedLyricsManager(
    floatingLyricsManager: FloatingLyricsManager,
    statusBarLyricsManager: StatusBarLyricsManager,
    currentPlaybackSeconds: () -> Double?,
    onCarLyricsChanged: (String?) -> Unit,
) {
    private val carConsumer = CarLyricsConsumer(
        currentPlaybackSeconds = currentPlaybackSeconds,
        onCarLyricsChanged = onCarLyricsChanged,
    )
    private val consumers: Map<LyricsConsumer, LyricsRuntimeConsumer> = mapOf(
        LyricsConsumer.DESKTOP to DesktopLyricsConsumer(
            floatingLyricsManager = floatingLyricsManager,
            currentPlaybackSeconds = currentPlaybackSeconds,
        ),
        LyricsConsumer.STATUS_BAR to StatusBarLyricsConsumer(
            statusBarLyricsManager = statusBarLyricsManager,
            currentPlaybackSeconds = currentPlaybackSeconds,
        ),
        LyricsConsumer.CAR to carConsumer,
    )

    private var sharedLyrics: LyricsData = EMPTY_LYRICS
    private val consumerOverrides = mutableMapOf<LyricsConsumer, LyricsData>()

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

        consumers.forEach { consumer ->
            this.consumers[consumer]?.clear(
                softHide = softHideDesktop && consumer == LyricsConsumer.DESKTOP,
            )
        }
    }

    fun updateTime(seconds: Double) {
        consumers.values.forEach { it.tick(seconds) }
    }

    fun setPlaybackState(isPlaying: Boolean) {
        consumers.values.forEach { it.setPlaybackState(isPlaying) }
    }

    fun setCarLyricsEnabled(enabled: Boolean) {
        carConsumer.setEnabled(enabled)
    }

    private fun applyLyricsToConsumer(consumer: LyricsConsumer) {
        val projected = projectLyricsForConsumer(dataForConsumer(consumer), consumer)
        val timeline = LyricsTimeline(projected)

        consumers[consumer]?.submit(projected, timeline)
    }

    private fun dataForConsumer(consumer: LyricsConsumer): LyricsData {
        return consumerOverrides[consumer] ?: sharedLyrics
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

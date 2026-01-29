package expo.modules.orpheus.models

data class LyricsLine(
    val timestamp: Double,
    val text: String,
    val translation: String? = null
)

data class LyricsData(
    val lyrics: List<LyricsLine>,
    val offset: Double = 0.0
)

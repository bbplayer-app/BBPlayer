package expo.modules.orpheus.model

import kotlinx.serialization.Serializable
import java.util.UUID

@Serializable
data class PlaybackContext(val id: String, val mode: String) {
    fun toMap(): Map<String, String> = mapOf("id" to id, "mode" to mode)

    companion object {
        fun create(mode: String?): PlaybackContext {
            require(mode == null || mode == "music" || mode == "podcast") { "Invalid player mode" }
            return PlaybackContext(UUID.randomUUID().toString(), mode ?: "music")
        }
    }
}

@Serializable
data class PlaybackQueueSnapshot(
    val version: Int = 1,
    val tracks: List<String>,
    val context: PlaybackContext? = null,
)

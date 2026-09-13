package expo.modules.orpheus.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class TrackResumeRecord(
    @SerialName("id")
    val id: String = "",

    // unit: second
    @SerialName("position")
    val position: Double = 0.0,

    // unit: second
    @SerialName("duration")
    val duration: Double = 0.0,

    // unit: millisecond (epoch)
    @SerialName("updatedAt")
    val updatedAt: Long = 0L,
)

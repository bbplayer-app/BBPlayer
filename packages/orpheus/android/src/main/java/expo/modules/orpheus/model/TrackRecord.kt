package expo.modules.orpheus.model

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
class TrackRecord : Record {
    @Field
    @SerialName("id")
    var id: String = ""

    @Field
    @SerialName("url")
    var url: String = ""

    @Field
    @SerialName("title")
    var title: String? = null

    @Field
    @SerialName("artist")
    var artist: String? = null

    @Field
    @SerialName("artwork")
    var artwork: String? = null

    // unit: second
    @Field
    @SerialName("duration")
    var duration: Double? = null
}
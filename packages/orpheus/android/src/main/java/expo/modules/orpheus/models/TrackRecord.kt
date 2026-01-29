package expo.modules.orpheus.models

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class TrackRecord : Record {
    @Field
    var id: String = ""

    @Field
    var url: String = ""

    @Field
    var title: String? = null

    @Field
    var artist: String? = null

    @Field
    var artwork: String? = null

    // unit: second
    @Field
    var duration: Double? = null
}
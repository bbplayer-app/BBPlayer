package expo.modules.orpheus.model

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord

@OptimizedRecord
class DownloadTaskRecord : Record {
    @Field
    var id: String = ""

    @Field
    var state: Int = 0

    @Field
    var percentDownloaded: Float = 0f

    @Field
    var bytesDownloaded: Long = 0

    @Field
    var contentLength: Long = 0

    @Field
    var track: TrackRecord? = null
}

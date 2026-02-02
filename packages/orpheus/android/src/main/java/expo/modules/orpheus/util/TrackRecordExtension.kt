package expo.modules.orpheus.util

import android.os.Bundle
import androidx.core.net.toUri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import expo.modules.orpheus.model.TrackRecord
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString

fun TrackRecord.toMediaItem(): MediaItem {
    val trackJson = Json.encodeToString(this)

    val extras = Bundle()
    extras.putString("track_json", trackJson)

    val artUri = if (!this.artwork.isNullOrEmpty()) this.artwork?.toUri() else null

    val metadata = MediaMetadata.Builder()
        .setTitle(this.title)
        .setArtist(this.artist)
        .setArtworkUri(artUri)
        .setExtras(extras)
        .build()

    return MediaItem.Builder()
        .setMediaId(this.id)
        .setUri(this.url)
        .setMediaMetadata(metadata)
        .build()
}
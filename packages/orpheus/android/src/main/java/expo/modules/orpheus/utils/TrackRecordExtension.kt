package expo.modules.orpheus.utils

import android.os.Bundle
import androidx.core.net.toUri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.google.gson.Gson
import expo.modules.orpheus.models.TrackRecord

fun TrackRecord.toMediaItem(gson: Gson): MediaItem {
    val trackJson = gson.toJson(this)

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
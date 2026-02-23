package expo.modules.orpheus.util

import android.os.Bundle
import androidx.core.net.toUri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import expo.modules.orpheus.model.TrackRecord
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

fun TrackRecord.toMediaItem(context: android.content.Context? = null): MediaItem {
    val trackJson = Json.encodeToString(this)

    val extras = Bundle()
    extras.putString("track_json", trackJson)

    val downloadedCoverUri = context?.let { 
        expo.modules.orpheus.manager.CoverDownloadManager.getCoverFile(it, this.id)?.absolutePath?.let { path -> "file://$path" }
    }

    val finalArtUri = downloadedCoverUri ?: this.artwork

    val artUri = if (!finalArtUri.isNullOrEmpty()) finalArtUri.toUri() else null

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
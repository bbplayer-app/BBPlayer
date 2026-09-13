package expo.modules.bbplayerdlna

import java.net.HttpURLConnection
import java.net.URL

internal object UpnpSoap {
    private const val AV = "urn:schemas-upnp-org:service:AVTransport:1"
    private const val RC = "urn:schemas-upnp-org:service:RenderingControl:1"

    @Synchronized
    fun play(controlURL: String, mediaUrl: String, title: String, mime: String) {
        runCatching { soap(controlURL, AV, "Stop", "<InstanceID>0</InstanceID>") }
        Thread.sleep(400)
        val didl = didl(mediaUrl, title, mime)
        soap(
            controlURL,
            AV,
            "SetAVTransportURI",
            "<InstanceID>0</InstanceID>" +
                "<CurrentURI>${escape(mediaUrl)}</CurrentURI>" +
                "<CurrentURIMetaData>${escape(didl)}</CurrentURIMetaData>",
        )
        soap(controlURL, AV, "Play", "<InstanceID>0</InstanceID><Speed>1</Speed>")
    }

    @Synchronized
    fun stop(controlURL: String) {
        soap(controlURL, AV, "Stop", "<InstanceID>0</InstanceID>")
    }

    @Synchronized
    fun pause(controlURL: String) {
        soap(controlURL, AV, "Pause", "<InstanceID>0</InstanceID>")
    }

    @Synchronized
    fun resume(controlURL: String) {
        soap(controlURL, AV, "Play", "<InstanceID>0</InstanceID><Speed>1</Speed>")
    }

    @Synchronized
    fun seek(controlURL: String, seconds: Double) {
        soap(
            controlURL,
            AV,
            "Seek",
            "<InstanceID>0</InstanceID><Unit>REL_TIME</Unit><Target>${secondsToHms(seconds)}</Target>",
        )
    }

    @Synchronized
    fun getStatus(controlURL: String, renderingControlURL: String? = null): Map<String, Any> {
        val transport = soap(controlURL, AV, "GetTransportInfo", "<InstanceID>0</InstanceID>")
        val position = soap(controlURL, AV, "GetPositionInfo", "<InstanceID>0</InstanceID>")
        val state = parseTag(transport, "CurrentTransportState") ?: "STOPPED"
        val volume = renderingControlURL?.let { runCatching { readVolume(it) }.getOrNull() }
        return buildMap {
            put("state", state)
            put("position", hmsToSeconds(parseTag(position, "RelTime").orEmpty()))
            put("duration", hmsToSeconds(parseTag(position, "TrackDuration").orEmpty()))
            if (volume != null) put("volume", volume)
        }
    }

    @Synchronized
    fun getVolume(renderingControlURL: String): Int = readVolume(renderingControlURL)

    @Synchronized
    fun setVolume(renderingControlURL: String, volume: Int) {
        val clamped = volume.coerceIn(0, 100)
        soap(
            renderingControlURL,
            RC,
            "SetVolume",
            "<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>$clamped</DesiredVolume>",
        )
    }

    private fun readVolume(renderingControlURL: String): Int {
        val xml = soap(
            renderingControlURL,
            RC,
            "GetVolume",
            "<InstanceID>0</InstanceID><Channel>Master</Channel>",
        )
        return parseTag(xml, "CurrentVolume")?.toIntOrNull()?.coerceIn(0, 100) ?: 0
    }

    private fun didl(url: String, title: String, mime: String): String {
        return """
            <DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">
              <item id="0" parentID="-1" restricted="1">
                <dc:title>${escape(title)}</dc:title>
                <upnp:class>object.item.audioItem.musicTrack</upnp:class>
                <res protocolInfo="http-get:*:$mime:*">${escape(url)}</res>
              </item>
            </DIDL-Lite>
        """.trimIndent()
    }

    private fun soap(url: String, ns: String, action: String, body: String): String {
        val payload =
            """<?xml version="1.0" encoding="utf-8"?>""" +
                """<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">""" +
                """<s:Body><u:$action xmlns:u="$ns">$body</u:$action></s:Body></s:Envelope>"""
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "text/xml; charset=\"utf-8\"")
            conn.setRequestProperty("SOAPAction", "\"$ns#$action\"")
            conn.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
            val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (conn.responseCode !in 200..299) {
                throw IllegalStateException("UPnP $action failed: HTTP ${conn.responseCode} $text")
            }
            return text
        } finally {
            conn.disconnect()
        }
    }

    private fun parseTag(xml: String, tag: String): String? {
        return Regex("<(?:\\w+:)?$tag>([^<]*)</(?:\\w+:)?$tag>").find(xml)?.groupValues?.get(1)
    }

    private fun hmsToSeconds(hms: String): Double {
        if (hms.isBlank() || hms.equals("NOT_IMPLEMENTED", ignoreCase = true)) return 0.0
        val parts = hms.trim().split(":")
        if (parts.size < 2) return 0.0
        return try {
            when (parts.size) {
                2 -> parts[0].toDouble() * 60 + parts[1].toDouble()
                else -> parts[0].toDouble() * 3600 + parts[1].toDouble() * 60 + parts[2].toDouble()
            }
        } catch (_: NumberFormatException) {
            0.0
        }
    }

    private fun secondsToHms(seconds: Double): String {
        val total = seconds.toInt().coerceAtLeast(0)
        val h = total / 3600
        val m = (total % 3600) / 60
        val s = total % 60
        return "%02d:%02d:%02d".format(h, m, s)
    }

    private fun escape(value: String): String {
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&apos;")
    }
}

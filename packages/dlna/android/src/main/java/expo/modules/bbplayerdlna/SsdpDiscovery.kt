package expo.modules.bbplayerdlna

import android.content.Context
import android.net.wifi.WifiManager
import android.util.Xml
import java.io.StringReader
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.net.URL
import java.nio.charset.StandardCharsets
import org.xmlpull.v1.XmlPullParser

internal object SsdpDiscovery {
    private val SEARCH_TARGETS = arrayOf(
        "urn:schemas-upnp-org:device:MediaRenderer:1",
        "upnp:rootdevice",
    )

    fun discover(context: Context, timeoutMs: Int): List<Map<String, String?>> {
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        val lock = wifi.createMulticastLock("bbplayer-dlna")
        lock.setReferenceCounted(false)
        lock.acquire()
        val locations = LinkedHashSet<String>()
        try {
            DatagramSocket().use { socket ->
                socket.broadcast = true
                socket.reuseAddress = true
                socket.soTimeout = 400
                val group = InetAddress.getByName("239.255.255.250")
                for (st in SEARCH_TARGETS) {
                    val bytes = msearch(st)
                    socket.send(DatagramPacket(bytes, bytes.size, group, 1900))
                }
                val deadline = System.currentTimeMillis() + timeoutMs.coerceAtLeast(800)
                val buf = ByteArray(4096)
                while (System.currentTimeMillis() < deadline) {
                    try {
                        val packet = DatagramPacket(buf, buf.size)
                        socket.receive(packet)
                        val text = String(packet.data, 0, packet.length, StandardCharsets.UTF_8)
                        val location = header(text, "location") ?: continue
                        locations.add(location.trim())
                    } catch (_: SocketTimeoutException) {
                    }
                }
            }
        } finally {
            if (lock.isHeld) lock.release()
        }

        val devices = LinkedHashMap<String, Map<String, String?>>()
        for (location in locations) {
            val device = runCatching { fetchDevice(location) }.getOrNull() ?: continue
            val key = device["udn"] ?: device["controlURL"] ?: location
            devices[key] = device
        }
        return devices.values.toList()
    }

    private fun msearch(st: String): ByteArray {
        val body = listOf(
            "M-SEARCH * HTTP/1.1",
            "HOST: 239.255.255.250:1900",
            "MAN: \"ssdp:discover\"",
            "MX: 2",
            "ST: $st",
            "",
            "",
        ).joinToString("\r\n")
        return body.toByteArray(StandardCharsets.UTF_8)
    }

    private fun header(response: String, name: String): String? {
        val prefix = "$name:"
        return response.lineSequence()
            .map { it.trim() }
            .firstOrNull { it.startsWith(prefix, ignoreCase = true) }
            ?.substring(prefix.length)
            ?.trim()
    }

    private fun fetchDevice(location: String): Map<String, String?>? {
        val xml = URL(location).readText()
        val parsed = parseDescription(xml, location) ?: return null
        if (parsed["controlURL"].isNullOrBlank()) return null
        return parsed
    }

    private fun parseDescription(xml: String, location: String): Map<String, String?>? {
        val parser = Xml.newPullParser()
        parser.setInput(StringReader(xml))
        val base = URL(location)
        var event = parser.eventType
        var friendlyName: String? = null
        var manufacturer: String? = null
        var modelName: String? = null
        var udn: String? = null
        var deviceType: String? = null
        var currentServiceType: String? = null
        var avTransport: String? = null
        var renderingControl: String? = null
        var depthDevice = 0
        var inService = false

        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> {
                    when (parser.name) {
                        "device" -> depthDevice++
                        "service" -> inService = true
                        "friendlyName" -> if (depthDevice == 1 && friendlyName == null) {
                            friendlyName = parser.nextText()
                        }
                        "manufacturer" -> if (depthDevice == 1 && manufacturer == null) {
                            manufacturer = parser.nextText()
                        }
                        "modelName" -> if (depthDevice == 1 && modelName == null) {
                            modelName = parser.nextText()
                        }
                        "UDN" -> if (depthDevice == 1 && udn == null) {
                            udn = parser.nextText()
                        }
                        "deviceType" -> if (depthDevice == 1 && deviceType == null) {
                            deviceType = parser.nextText()
                        }
                        "serviceType" -> if (inService) {
                            currentServiceType = parser.nextText()
                        }
                        "controlURL" -> if (inService) {
                            val path = parser.nextText().trim()
                            val absolute = resolve(base, path)
                            when {
                                currentServiceType?.contains("AVTransport") == true ->
                                    avTransport = absolute
                                currentServiceType?.contains("RenderingControl") == true ->
                                    renderingControl = absolute
                            }
                        }
                    }
                }
                XmlPullParser.END_TAG -> {
                    when (parser.name) {
                        "device" -> depthDevice--
                        "service" -> {
                            inService = false
                            currentServiceType = null
                        }
                    }
                }
            }
            event = parser.next()
        }

        val isRenderer = deviceType?.contains("MediaRenderer") == true || avTransport != null
        if (!isRenderer || avTransport == null) return null

        return mapOf(
            "name" to (friendlyName ?: "DLNA 设备"),
            "location" to location,
            "controlURL" to avTransport,
            "renderingControlURL" to renderingControl,
            "udn" to udn,
            "manufacturer" to manufacturer,
            "model" to modelName,
        )
    }

    private fun resolve(base: URL, path: String): String {
        if (path.startsWith("http://") || path.startsWith("https://")) return path
        return URL(base, path).toString()
    }
}

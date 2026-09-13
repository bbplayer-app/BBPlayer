package expo.modules.bbplayerdlna

import java.net.Inet4Address
import java.net.NetworkInterface

internal object LanAddress {
    fun ipv4(): String {
        val interfaces = NetworkInterface.getNetworkInterfaces() ?: return "127.0.0.1"
        for (nif in interfaces) {
            if (!nif.isUp || nif.isLoopback) continue
            val addresses = nif.inetAddresses
            while (addresses.hasMoreElements()) {
                val addr = addresses.nextElement()
                if (addr is Inet4Address && addr.isSiteLocalAddress) {
                    return addr.hostAddress ?: continue
                }
            }
        }
        return "127.0.0.1"
    }
}

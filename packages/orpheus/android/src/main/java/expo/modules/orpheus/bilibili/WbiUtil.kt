package expo.modules.orpheus.bilibili

import java.net.URLEncoder
import java.security.MessageDigest
import java.util.TreeMap

object WbiUtil {
    private val mixinKeyEncTab = intArrayOf(
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
        33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
        61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
        36, 20, 34, 44, 52
    )

    private fun String.toMD5(): String {
        val md = MessageDigest.getInstance("MD5")
        val digest = md.digest(this.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }

    private fun Any?.encodeURIComponent(): String {
        if (this == null) return ""
        return URLEncoder.encode(this.toString(), "UTF-8")
            .replace("+", "%20")
            .replace("*", "%2A")
            .replace("%7E", "~")
    }

    /**
     * 计算 WBI 混淆键
     */
    private fun getMixinKey(orig: String): String {
        return buildString {
            repeat(32) {
                if (it < mixinKeyEncTab.size && mixinKeyEncTab[it] < orig.length) {
                    append(orig[mixinKeyEncTab[it]])
                }
            }
        }
    }

    /**
     * 核心签名方法
     * @param params 原始参数 Map
     * @param imgKey 来自 /nav 接口
     * @param subKey 来自 /nav 接口
     * @return 包含 w_rid 和 wts 的完整参数 Map
     */
    fun sign(params: Map<String, Any?>, imgKey: String, subKey: String): Map<String, String> {
        val mixinKey = getMixinKey(imgKey + subKey)
        val currTime = System.currentTimeMillis() / 1000

        val sortedParams = TreeMap<String, Any?>()
        params.forEach { (k, v) -> if (v != null) sortedParams[k] = v }
        sortedParams["wts"] = currTime

        val queryStr = sortedParams.entries.joinToString("&") { (k, v) ->
            "${k.encodeURIComponent()}=${v.encodeURIComponent()}"
        }

        val w_rid = (queryStr + mixinKey).toMD5()

        val finalMap = HashMap<String, String>()
        sortedParams.forEach { (k, v) -> finalMap[k] = v.toString() }
        finalMap["w_rid"] = w_rid

        return finalMap
    }

    fun extractKey(url: String): String {
        return url.substringAfterLast("/").substringBeforeLast(".")
    }
}
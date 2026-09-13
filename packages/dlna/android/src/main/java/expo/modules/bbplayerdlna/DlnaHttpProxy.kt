package expo.modules.bbplayerdlna

import android.content.Context
import android.net.Uri
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

internal class DlnaHttpProxy(private val context: Context) {
    sealed class Source {
        data class Remote(val url: String, val headers: Map<String, String>) : Source()
        data class LocalFile(val path: String) : Source()
        data class Content(val uri: String) : Source()
    }

    @Volatile
    private var source: Source? = null

    @Volatile
    private var mime: String = "audio/mp4"

    private var server: ServerSocket? = null
    private var acceptThread: Thread? = null
    private val running = AtomicBoolean(false)

    @Synchronized
    fun start(next: Source, nextMime: String): String {
        source = next
        mime = nextMime
        if (server == null || !running.get()) {
            val socket = ServerSocket(0)
            server = socket
            running.set(true)
            acceptThread = Thread({
                while (running.get()) {
                    try {
                        val client = socket.accept()
                        Thread({ handle(client) }, "dlna-proxy-client").apply {
                            isDaemon = true
                            start()
                        }
                    } catch (_: Exception) {
                        if (!running.get()) break
                    }
                }
            }, "dlna-proxy").apply {
                isDaemon = true
                start()
            }
        }
        val ext = extensionForMime(nextMime)
        return "http://${LanAddress.ipv4()}:${server!!.localPort}/media-${System.currentTimeMillis()}.$ext"
    }

    @Synchronized
    fun stop() {
        running.set(false)
        runCatching { server?.close() }
        server = null
        acceptThread = null
        source = null
    }

    private fun handle(socket: Socket) {
        try {
            socket.use { client ->
                val input = client.getInputStream().bufferedReader(Charsets.ISO_8859_1)
                val requestLine = input.readLine() ?: return
                val parts = requestLine.split(" ")
                if (parts.size < 2) return
                val method = parts[0].uppercase(Locale.US)
                val path = parts[1]
                val headers = LinkedHashMap<String, String>()
                while (true) {
                    val line = input.readLine() ?: break
                    if (line.isEmpty()) break
                    val idx = line.indexOf(':')
                    if (idx > 0) {
                        headers[line.substring(0, idx).trim().lowercase(Locale.US)] =
                            line.substring(idx + 1).trim()
                    }
                }
                val out = client.getOutputStream()
                if (!path.startsWith("/media")) {
                    android.util.Log.w("BBPlayerDlna", "404 $method $path")
                    writeStatus(out, 404, "Not Found", 0)
                    return
                }
                if (method != "GET" && method != "HEAD") {
                    writeStatus(out, 405, "Method Not Allowed", 0)
                    return
                }
                val range = parseRange(headers["range"])
                serve(out, method == "HEAD", range)
            }
        } catch (e: Exception) {
            android.util.Log.w("BBPlayerDlna", "client closed early: ${e.message}")
        }
    }

    private fun serve(out: OutputStream, headOnly: Boolean, range: LongRange?) {
        when (val src = source) {
            is Source.Remote -> serveRemote(out, src, headOnly, range)
            is Source.LocalFile -> serveFile(out, File(stripFileScheme(src.path)), headOnly, range)
            is Source.Content -> serveContent(out, Uri.parse(src.uri), headOnly, range)
            null -> writeStatus(out, 503, "No Source", 0)
        }
    }

    private fun serveFile(out: OutputStream, file: File, headOnly: Boolean, range: LongRange?) {
        if (!file.exists() || !file.isFile) {
            writeStatus(out, 404, "Not Found", 0)
            return
        }
        val total = file.length()
        val (start, end, status) = resolveRange(total, range)
        writeMediaHeaders(out, status, end - start + 1, total, start, end)
        if (headOnly) return
        FileInputStream(file).use { input ->
            input.skip(start)
            copyLimited(input, out, end - start + 1)
        }
    }

    private fun serveContent(out: OutputStream, uri: Uri, headOnly: Boolean, range: LongRange?) {
        val resolver = context.contentResolver
        val total = resolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
        val (start, end, status) = if (total > 0) resolveRange(total, range) else Triple(0L, -1L, 200)
        val length = if (total > 0) end - start + 1 else -1L
        writeMediaHeaders(out, status, length, total, start, if (total > 0) end else -1L)
        if (headOnly) return
        resolver.openInputStream(uri)?.use { input ->
            if (start > 0) input.skip(start)
            if (length > 0) copyLimited(input, out, length) else input.copyTo(out)
        }
    }

    private fun serveRemote(
        out: OutputStream,
        src: Source.Remote,
        headOnly: Boolean,
        range: LongRange?,
    ) {
        val conn = openUpstream(src, headOnly, range) ?: run {
            writeStatus(out, 502, "Bad Gateway", 0)
            return
        }
        try {
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            if (stream == null || code !in 200..299) {
                android.util.Log.w("BBPlayerDlna", "upstream HTTP $code")
                writeStatus(out, if (code > 0) code else 502, "Bad Gateway", 0)
                return
            }
            val remoteLength = conn.contentLengthLong
            val reason = if (code == 206) "Partial Content" else "OK"
            val header = StringBuilder()
            header.append("HTTP/1.1 ").append(code).append(' ').append(reason).append("\r\n")
            header.append("Content-Type: ").append(mime).append("\r\n")
            if (remoteLength >= 0) {
                header.append("Content-Length: ").append(remoteLength).append("\r\n")
            }
            header.append("Accept-Ranges: bytes\r\n")
            header.append("Connection: close\r\n")
            header.append("transferMode.dlna.org: Streaming\r\n")
            header.append("contentFeatures.dlna.org: DLNA.ORG_OP=01;DLNA.ORG_CI=0\r\n")
            conn.getHeaderField("Content-Range")?.let {
                header.append("Content-Range: ").append(it).append("\r\n")
            }
            header.append("\r\n")
            out.write(header.toString().toByteArray(Charsets.US_ASCII))
            if (!headOnly) {
                BufferedInputStream(stream).copyTo(out)
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun openUpstream(
        src: Source.Remote,
        headOnly: Boolean,
        range: LongRange?,
    ): HttpURLConnection? {
        var current = URL(src.url)
        repeat(5) {
            val conn = current.openConnection() as HttpURLConnection
            conn.instanceFollowRedirects = false
            conn.connectTimeout = 8000
            conn.readTimeout = 20000
            conn.requestMethod = if (headOnly) "HEAD" else "GET"
            src.headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
            if (range != null) {
                val end = if (range.last == Long.MAX_VALUE) "" else range.last.toString()
                conn.setRequestProperty("Range", "bytes=${range.first}-$end")
            }
            val code = conn.responseCode
            if (code in 301..308) {
                val location = conn.getHeaderField("Location")
                conn.disconnect()
                if (location.isNullOrBlank()) return null
                current = URL(current, location)
                return@repeat
            }
            return conn
        }
        return null
    }

    private fun extensionForMime(value: String): String {
        return when {
            value.contains("mpeg") -> "mp3"
            value.contains("aac") && !value.contains("mp4") -> "aac"
            else -> "m4a"
        }
    }

    private fun writeMediaHeaders(
        out: OutputStream,
        status: Int,
        length: Long,
        total: Long,
        start: Long,
        end: Long,
    ) {
        val reason = if (status == 206) "Partial Content" else "OK"
        val header = StringBuilder()
        header.append("HTTP/1.1 ").append(status).append(' ').append(reason).append("\r\n")
        header.append("Content-Type: ").append(mime).append("\r\n")
        if (length >= 0) header.append("Content-Length: ").append(length).append("\r\n")
        header.append("Accept-Ranges: bytes\r\n")
        if (status == 206 && total > 0) {
            header.append("Content-Range: bytes ").append(start).append('-').append(end)
                .append('/').append(total).append("\r\n")
        }
        header.append("Connection: close\r\n")
        header.append("transferMode.dlna.org: Streaming\r\n")
        header.append("contentFeatures.dlna.org: DLNA.ORG_OP=01;DLNA.ORG_CI=0\r\n")
        header.append("\r\n")
        out.write(header.toString().toByteArray(Charsets.US_ASCII))
    }

    private fun writeStatus(out: OutputStream, code: Int, reason: String, length: Int) {
        val header =
            "HTTP/1.1 $code $reason\r\nContent-Length: $length\r\nConnection: close\r\n\r\n"
        out.write(header.toByteArray(Charsets.US_ASCII))
    }

    private fun parseRange(header: String?): LongRange? {
        if (header.isNullOrBlank() || !header.startsWith("bytes=")) return null
        val spec = header.removePrefix("bytes=").substringBefore(',').trim()
        val startText = spec.substringBefore('-', "")
        val endText = spec.substringAfter('-', "")
        val start = startText.toLongOrNull() ?: return null
        val end = endText.toLongOrNull() ?: Long.MAX_VALUE
        return start..end
    }

    private fun resolveRange(total: Long, range: LongRange?): Triple<Long, Long, Int> {
        if (range == null) return Triple(0L, total - 1, 200)
        val start = range.first.coerceAtLeast(0)
        val end = if (range.last == Long.MAX_VALUE) total - 1 else range.last.coerceAtMost(total - 1)
        return Triple(start, end, 206)
    }

    private fun copyLimited(input: java.io.InputStream, out: OutputStream, count: Long) {
        var remaining = count
        val buf = ByteArray(64 * 1024)
        while (remaining > 0) {
            val read = input.read(buf, 0, minOf(buf.size.toLong(), remaining).toInt())
            if (read <= 0) break
            out.write(buf, 0, read)
            remaining -= read
        }
    }

    private fun stripFileScheme(path: String): String {
        return if (path.startsWith("file://")) Uri.parse(path).path ?: path else path
    }
}

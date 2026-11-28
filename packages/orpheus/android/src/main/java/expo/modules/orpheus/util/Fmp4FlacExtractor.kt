package expo.modules.orpheus.util

import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.nio.ByteBuffer

/**
 * 把 B 站 Hi-Res 下载（fragmented MP4 里装的 FLAC）原样取出成 .flac 文件，不解码、不重新编码。
 *
 * MP4 里的 FLAC 样本本身就是完整的 FLAC 帧，`dfLa` 盒里存的就是原始的 METADATA_BLOCK（至少有 STREAMINFO），
 * 所以只要写 `fLaC` 标记 + dfLa 里的元数据块 + 依次拼接每个 mdat 的内容，就是一个标准 FLAC 文件。
 * 这依赖 B 站音频流只有一条音轨、mdat 里只有这条音轨的样本，因此先检查只有一个 trak、
 * 第一个 mdat 以 FLAC 帧同步码开头，不满足就放弃，调用方按 m4a 导出。
 */
internal object Fmp4FlacExtractor {
    private const val SAMPLE_ENTRY_HEADER_SIZE = 28 // AudioSampleEntry 在子盒之前的固定字段
    private const val MAX_MOOV_SIZE = 16L * 1024 * 1024

    private data class Box(val type: String, val start: Long, val payloadStart: Long, val end: Long)

    /** 是 FLAC 就写出 [output] 并返回 true；不是 FLAC 或结构不符合预期返回 false（不会留下 [output]）。 */
    fun extractIfFlac(input: File, output: File): Boolean {
        RandomAccessFile(input, "r").use { file ->
            val topLevel = readBoxes(file, 0, file.length())
            val moov = topLevel.firstOrNull { it.type == "moov" } ?: return false
            val mdats = topLevel.filter { it.type == "mdat" }
            if (mdats.isEmpty() || moov.end - moov.payloadStart > MAX_MOOV_SIZE) return false

            val moovBytes = ByteArray((moov.end - moov.payloadStart).toInt())
            file.seek(moov.payloadStart)
            file.readFully(moovBytes)
            val buffer = ByteBuffer.wrap(moovBytes)

            val traks = readBoxes(buffer, 0, moovBytes.size).filter { it.type == "trak" }
            if (traks.size != 1) return false
            val dfLa = findDfLa(buffer, traks.single()) ?: return false
            // dfLa 是 FullBox：先跳过 4 字节 version/flags
            val metadataStart = dfLa.payloadStart.toInt() + 4
            val metadataEnd = dfLa.end.toInt()
            if (metadataEnd - metadataStart < 4 + 34) return false
            // 第一个元数据块必须是 STREAMINFO（type 0，长度 34）
            if (moovBytes[metadataStart].toInt() and 0x7F != 0) return false

            val firstPayload = mdats.first().payloadStart
            if (mdats.first().end - firstPayload < 2) return false
            file.seek(firstPayload)
            val sync = (file.readUnsignedByte() shl 8) or file.readUnsignedByte()
            if (sync and 0xFFFE != 0xFFF8) return false

            try {
                output.outputStream().use { out ->
                    out.write("fLaC".toByteArray(Charsets.US_ASCII))
                    out.write(moovBytes, metadataStart, metadataEnd - metadataStart)
                    val channel = file.channel
                    val outChannel = out.channel
                    for (mdat in mdats) {
                        var position = mdat.payloadStart
                        while (position < mdat.end) {
                            val written = channel.transferTo(position, mdat.end - position, outChannel)
                            if (written <= 0) throw IOException("mdat 拷贝中断")
                            position += written
                        }
                    }
                }
            } catch (e: Exception) {
                output.delete()
                throw e
            }
            return true
        }
    }

    private fun findDfLa(moov: ByteBuffer, trak: Box): Box? {
        var parent = trak
        for (type in listOf("mdia", "minf", "stbl", "stsd")) {
            parent = readBoxes(moov, parent.payloadStart.toInt(), parent.end.toInt())
                .firstOrNull { it.type == type } ?: return null
        }
        // stsd 是 FullBox，后面还有 4 字节 entry_count
        val entries = readBoxes(moov, parent.payloadStart.toInt() + 8, parent.end.toInt())
        val flacEntry = entries.firstOrNull { it.type == "fLaC" } ?: return null
        return readBoxes(
            moov,
            flacEntry.payloadStart.toInt() + SAMPLE_ENTRY_HEADER_SIZE,
            flacEntry.end.toInt(),
        ).firstOrNull { it.type == "dfLa" }
    }

    private fun readBoxes(file: RandomAccessFile, start: Long, end: Long): List<Box> {
        val boxes = mutableListOf<Box>()
        var position = start
        val header = ByteArray(16)
        while (position + 8 <= end) {
            file.seek(position)
            file.readFully(header, 0, 8)
            val buffer = ByteBuffer.wrap(header)
            var size = buffer.getInt(0).toLong() and 0xFFFFFFFFL
            val type = String(header, 4, 4, Charsets.ISO_8859_1)
            var headerSize = 8L
            if (size == 1L) {
                file.readFully(header, 8, 8)
                size = buffer.getLong(8)
                headerSize = 16
            } else if (size == 0L) {
                size = end - position
            }
            if (size < headerSize || position + size > end) throw IOException("MP4 盒结构损坏：$type")
            boxes += Box(type, position, position + headerSize, position + size)
            position += size
        }
        return boxes
    }

    private fun readBoxes(buffer: ByteBuffer, start: Int, end: Int): List<Box> {
        val boxes = mutableListOf<Box>()
        var position = start
        while (position + 8 <= end) {
            var size = buffer.getInt(position).toLong() and 0xFFFFFFFFL
            val type = String(ByteArray(4) { buffer.get(position + 4 + it) }, Charsets.ISO_8859_1)
            var headerSize = 8
            if (size == 1L) {
                if (position + 16 > end) throw IOException("MP4 盒结构损坏：$type")
                size = buffer.getLong(position + 8)
                headerSize = 16
            } else if (size == 0L) {
                size = (end - position).toLong()
            }
            if (size < headerSize || position + size > end) throw IOException("MP4 盒结构损坏：$type")
            boxes += Box(type, position.toLong(), (position + headerSize).toLong(), position + size)
            position += size.toInt()
        }
        return boxes
    }
}

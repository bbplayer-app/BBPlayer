package expo.modules.orpheus.util

import java.io.File

/**
 * 用 TagLib（JNI，见 src/main/cpp）给导出的文件写标签。MP4 与 FLAC 走同一套接口，
 * 键名是 TagLib 的通用属性名（TITLE / ARTIST / ALBUM / LYRICS）
 */
internal object TagWriter {
    init {
        System.loadLibrary("orpheus_tags")
    }

    class Cover(val data: ByteArray, val mimeType: String, val width: Int, val height: Int)

    fun write(file: File, properties: Map<String, String>, cover: Cover?): Boolean = nativeWrite(
        file.absolutePath,
        properties.keys.toTypedArray(),
        properties.values.toTypedArray(),
        cover?.data,
        cover?.mimeType,
        cover?.width ?: 0,
        cover?.height ?: 0,
    )

    @JvmStatic
    private external fun nativeWrite(
        path: String,
        keys: Array<String>,
        values: Array<String>,
        cover: ByteArray?,
        coverMime: String?,
        coverWidth: Int,
        coverHeight: Int,
    ): Boolean
}

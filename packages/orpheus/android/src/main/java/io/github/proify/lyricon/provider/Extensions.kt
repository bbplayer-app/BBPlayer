/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import kotlinx.serialization.json.Json
import java.io.ByteArrayOutputStream
import java.util.zip.Deflater

internal val json: Json = Json {
    coerceInputValues = true     // 尝试转换类型
    ignoreUnknownKeys = true     // 忽略未知字段
    isLenient = true             // 宽松的 JSON 语法
    explicitNulls = false        // 不序列化 null
    encodeDefaults = false       // 不序列化默认值
}

/**
 * ZLIB压缩字节数组
 */
internal fun ByteArray.deflate(): ByteArray {
    if (isEmpty()) return byteArrayOf()

    return Deflater().run {
        setInput(this@deflate)
        finish()

        ByteArrayOutputStream().use { output ->
            val buffer = ByteArray(4096)
            while (!finished()) {
                output.write(buffer, 0, deflate(buffer))
            }
            output.toByteArray()
        }.also { end() }
    }
}
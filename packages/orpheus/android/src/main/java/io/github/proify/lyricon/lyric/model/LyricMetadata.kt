/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

@file:Suppress("unused")

package io.github.proify.lyricon.lyric.model

import kotlinx.serialization.Serializable

@Serializable
data class LyricMetadata(
    private val map: Map<String, String?> = emptyMap(),
) : Map<String, String?> by map {

    fun getDouble(key: String, default: Double = 0.0): Double =
        map[key]?.toDoubleOrNull() ?: default

    fun getBoolean(key: String, default: Boolean = false): Boolean =
        map[key]?.toBoolean() ?: default

    fun getFloat(key: String, default: Float = 0f): Float = map[key]?.toFloatOrNull() ?: default
    fun getLong(key: String, default: Long = 0): Long = map[key]?.toLongOrNull() ?: default
    fun getInt(key: String, default: Int = 0): Int = map[key]?.toIntOrNull() ?: default
    fun getString(key: String, default: String? = null): String? = map[key] ?: default
}

fun lyricMetadataOf(vararg pairs: Pair<String, String?>): LyricMetadata =
    LyricMetadata(mapOf(*pairs))
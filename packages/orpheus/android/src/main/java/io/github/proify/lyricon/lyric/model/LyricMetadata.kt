/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

@file:Suppress("unused")

package io.github.proify.lyricon.lyric.model

import kotlinx.serialization.Serializable

/**
 * 歌词元数据模型类
 * 使用委托模式继承自 [Map]，用于存储和获取歌词相关的配置信息。
 * 提供了多种基本类型的扩展获取方法，并包含默认值处理。
 *
 * @property map 存储元数据的底层映射表，键和值均为字符串类型（值可为空）
 */
@Serializable
data class LyricMetadata(
    private val map: Map<String, String?> = emptyMap(),
) : Map<String, String?> by map {

    /**
     * 获取 Double 类型的值
     * @param key 元数据键名
     * @param default 转换失败或键不存在时的默认值
     * @return 对应的 Double 数值
     */
    fun getDouble(key: String, default: Double = 0.0): Double =
        map[key]?.toDoubleOrNull() ?: default

    /**
     * 获取 Boolean 类型的值
     * @param key 元数据键名
     * @param default 转换失败或键不存在时的默认值
     * @return 对应的 Boolean 布尔值
     */
    fun getBoolean(key: String, default: Boolean = false): Boolean =
        map[key]?.toBoolean() ?: default

    /**
     * 获取 Float 类型的值
     * @param key 元数据键名
     * @param default 转换失败或键不存在时的默认值
     * @return 对应的 Float 数值
     */
    fun getFloat(key: String, default: Float = 0f): Float = map[key]?.toFloatOrNull() ?: default

    /**
     * 获取 Long 类型的值
     * @param key 元数据键名
     * @param default 转换失败或键不存在时的默认值
     * @return 对应的 Long 数值
     */
    fun getLong(key: String, default: Long = 0): Long = map[key]?.toLongOrNull() ?: default

    /**
     * 获取 Int 类型的值
     * @param key 元数据键名
     * @param default 转换失败或键不存在时的默认值
     * @return 对应的 Int 数值
     */
    fun getInt(key: String, default: Int = 0): Int = map[key]?.toIntOrNull() ?: default

    /**
     * 获取 String 类型的值
     * @param key 元数据键名
     * @param default 键不存在时的默认值
     * @return 对应的字符串值
     */
    fun getString(key: String, default: String? = null): String? = map[key] ?: default

    /**
     * 判断对象是否相等
     * 基于底层的 map 内容进行比对
     */
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is LyricMetadata) return false
        return map == other.map
    }

    /**
     * 生成哈希值
     * 基于底层的 map 生成，确保与 equals 逻辑一致
     */
    override fun hashCode(): Int {
        return map.hashCode()
    }

    /**
     * 返回对象的字符串表示
     */
    override fun toString(): String {
        return "LyricMetadata(map=$map)"
    }
}

/**
 * 构建 [LyricMetadata] 的便捷工厂函数
 * * @param pairs 键值对序列
 * @return 包含指定数据的 LyricMetadata 实例
 */
fun lyricMetadataOf(vararg pairs: Pair<String, String?>): LyricMetadata =
    LyricMetadata(mapOf(*pairs))
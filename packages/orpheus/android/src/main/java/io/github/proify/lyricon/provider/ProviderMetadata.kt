/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
@file:Suppress("unused")

package io.github.proify.lyricon.provider

import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import kotlinx.serialization.Serializable

/**
 * 提供者元数据封装类。
 *
 * 使用键值对存储提供者相关信息
 *
 * @property map 内部存储的键值对
 */
@Parcelize
@Serializable
class ProviderMetadata(
    private val map: Map<String, String?> = emptyMap()
) : Map<String, String?> by map, Parcelable

/**
 * 创建 [ProviderMetadata] 的简便方法。
 *
 * @param pairs 键值对数组
 * @return 对应的 [ProviderMetadata] 实例
 */
fun providerMetadataOf(vararg pairs: Pair<String, String?>): ProviderMetadata =
    ProviderMetadata(mapOf(*pairs))
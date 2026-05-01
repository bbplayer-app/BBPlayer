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
 * 提供端元数据。
 *
 * 用键值对携带额外展示或能力信息。该类型委托实现 [Map]，可直接按普通 Map 读取。
 *
 * @property map 元数据键值对。
 */
@Parcelize
@Serializable
class ProviderMetadata(
    private val map: Map<String, String?> = emptyMap()
) : Map<String, String?> by map, Parcelable

/** 使用键值对快速创建 [ProviderMetadata]。 */
fun providerMetadataOf(vararg pairs: Pair<String, String?>): ProviderMetadata =
    ProviderMetadata(mapOf(*pairs))

/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import kotlinx.serialization.Serializable

/**
 * 提供者信息
 *
 * @property providerPackageName 提供者包名
 * @property playerPackageName 播放器包名
 * @property logo 播放器Logo
 * @property metadata 元数据
 * @property processName 播放器进程名
 */
@Serializable
@Parcelize
data class ProviderInfo(
    val providerPackageName: String,
    val playerPackageName: String,
    val logo: ProviderLogo? = null,
    val metadata: ProviderMetadata? = null,
    val processName: String? = null
) : Parcelable {

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ProviderInfo) return false
        return providerPackageName == other.providerPackageName
                && playerPackageName == other.playerPackageName
                && processName == other.processName

    }

    override fun hashCode(): Int {
        var result = providerPackageName.hashCode()
        result = 31 * result + playerPackageName.hashCode()
        result = 31 * result + processName.hashCode()
        return result
    }
}
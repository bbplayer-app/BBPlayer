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
 * 提供端注册信息。
 *
 * 中心服务通过该对象识别歌词提供端。相等性仅比较包名、播放器包名和进程名，
 * [logo] 与 [metadata] 只作为展示信息，不参与身份判断。
 *
 * @property providerPackageName 提供端应用包名。
 * @property playerPackageName 播放器应用包名。
 * @property logo 提供端或播放器图标。
 * @property metadata 提供端附加元数据。
 * @property processName 播放器所在进程名。
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

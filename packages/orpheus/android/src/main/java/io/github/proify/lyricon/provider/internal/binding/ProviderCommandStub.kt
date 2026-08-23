/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider.internal.binding

import android.content.Intent
import android.os.Bundle
import io.github.proify.lyricon.provider.IProviderService
import io.github.proify.lyricon.provider.ProviderService

/**
 * 将 [ProviderService] 适配为提供给中心服务调用的 AIDL Binder。
 *
 * @property handler 当前命令处理回调；可通过 LyriconProvider.providerService 更新。
 */
internal class ProviderCommandStub(handler: ProviderService? = null) :
    IProviderService.Stub() {

    /** 当前命令处理回调，可为 null（此时命令返回空结果）。 */
    var handler: ProviderService? = handler

    override fun onRunCommand(intent: Intent?): Bundle? = handler?.onRunCommand(intent)
}

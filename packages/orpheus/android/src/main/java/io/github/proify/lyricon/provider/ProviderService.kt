/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import android.content.Intent
import android.os.Bundle

/**
 * 提供者服务接口，用于处理远程调用。
 *
 * 实现该接口的类将用于处理来自中心服务的远程调用，并返回结果。
 *
 * **目前未实现相关功能，仅作为未来扩展。**
 */
interface ProviderService {

    /**
     * 由远程调用，处理相关命令
     *
     * @return 返回值
     */
    fun onRunCommand(intent: Intent?): Bundle?
}
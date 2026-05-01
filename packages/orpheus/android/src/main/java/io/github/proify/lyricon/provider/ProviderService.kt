/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import android.content.Intent
import android.os.Bundle

/**
 * 提供端本地命令处理器。
 *
 * 中心服务可通过该接口向提供端发起扩展命令。当前核心歌词同步流程不依赖该接口，
 * 它主要用于后续能力扩展。
 */
interface ProviderService {

    /**
     * 处理中心服务发送的命令。
     *
     * @param intent 命令参数，可为空。
     * @return 命令结果，可为空。
     */
    fun onRunCommand(intent: Intent?): Bundle?
}

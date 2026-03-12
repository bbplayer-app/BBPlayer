/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import android.content.Intent
import android.os.Bundle

internal class LocalProviderService(var callback: ProviderService? = null) :
    IProviderService.Stub() {

    override fun onRunCommand(intent: Intent?): Bundle? = callback?.onRunCommand(intent)
}
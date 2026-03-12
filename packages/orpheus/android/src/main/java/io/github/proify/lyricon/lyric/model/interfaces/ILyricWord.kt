/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model.interfaces

import io.github.proify.lyricon.lyric.model.LyricMetadata

interface ILyricWord : ILyricTiming {
    var text: String?
    var metadata: LyricMetadata?
}
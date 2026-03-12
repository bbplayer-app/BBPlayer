/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model.interfaces

import io.github.proify.lyricon.lyric.model.LyricMetadata
import io.github.proify.lyricon.lyric.model.LyricWord

interface ILyricLine : ILyricTiming {
    var isAlignedRight: Boolean
    var metadata: LyricMetadata?
    var text: String?
    var words: List<LyricWord>?
}
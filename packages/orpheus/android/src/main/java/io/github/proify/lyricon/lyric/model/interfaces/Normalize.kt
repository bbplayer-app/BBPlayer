/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model.interfaces

interface Normalize<T : Normalize<T>> {
    /**
     * 规范化对象
     */
    fun normalize(): T
}
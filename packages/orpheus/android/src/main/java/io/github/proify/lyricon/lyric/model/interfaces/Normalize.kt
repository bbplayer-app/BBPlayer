/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model.interfaces

/**
 * 规范化契约。
 *
 * 实现类通过 [normalize] 返回一个**规范化后的深拷贝**：实现通常遵循
 * "先 `deepCopy()`、再就地修正" 的模式，因此原始对象及其嵌套结构不会被修改。
 *
 * 规范化的内容随类型而异，例如：修正时间戳与持续时间、剔除非法行/无效词、
 * 合并碎片与填充空隙、由逐词数据重算文本、按时间排序等。
 *
 * @param T 实现类自身（递归泛型，保证规范化后返回同一类型）
 *
 * @see DeepCopyable
 */
interface Normalize<T : Normalize<T>> {
    /**
     * 规范化对象。
     *
     * 返回规范化后的深拷贝；原对象不受影响。
     *
     * @return 规范化后的深拷贝
     */
    fun normalize(): T
}

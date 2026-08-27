/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.github.proify.lyricon.lyric.model.interfaces

/**
 * 深拷贝契约。
 *
 * 实现类通过 [deepCopy] 返回一个与当前对象等价、但**不共享任何可变引用**的副本：
 * 嵌套的可变结构（如列表中的元素对象）也必须重新创建，以保证修改副本不会影响
 * 原对象（反之亦然）。
 *
 * 区别于 `data class` 自带的 `copy()`（浅拷贝，嵌套引用仍然共享），本契约保证
 * 逐层深拷贝的语义，例如 `List` 扩展 `deepCopy` 会对每个元素分别调用
 * [deepCopy]。
 *
 * @param T 实现类自身（递归泛型，保证深拷贝返回同一类型）
 *
 * @see Normalize
 */
interface DeepCopyable<T : DeepCopyable<T>> {
    /**
     * 返回当前对象的深拷贝。
     *
     * 结果与原对象等价，但不共享任何可变引用。
     *
     * @return 当前对象的深拷贝
     */
    fun deepCopy(): T
}

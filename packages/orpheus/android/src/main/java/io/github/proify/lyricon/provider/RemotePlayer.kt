/*
 * Copyright 2026 Proify, Tomakino
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package io.github.proify.lyricon.provider

import android.media.session.PlaybackState
import androidx.annotation.IntRange
import io.github.proify.lyricon.lyric.model.RichLyricLine
import io.github.proify.lyricon.lyric.model.Song

interface RemotePlayer {

    /**
     * 检查远程播放器连接是否仍然有效。
     */
    val isActive: Boolean

    /**
     * 设置远程播放器当前播放的歌曲信息。
     *
     * @param song 歌曲对象，null 表示清空当前播放
     * @return 命令是否成功发送
     */
    fun setSong(song: Song?): Boolean

    /**
     * 设置远程播放器的播放状态。
     *
     * @param playing true 表示播放中，false 表示暂停
     * @return 命令是否成功发送
     */
    fun setPlaybackState(playing: Boolean): Boolean

    /**
     * 立即跳转到指定播放位置。
     *
     * 通常在用户拖动进度条或主动调整播放位置时调用。
     *
     * @param position 播放位置，单位毫秒，最小值为 0
     * @return 操作是否成功
     */
    fun seekTo(@IntRange(from = 0) position: Long): Boolean

    /**
     * 更新播放位置到待读取区
     *
     * @param position 播放位置，最小值为 0
     * @see setPositionUpdateInterval
     */
    fun setPosition(@IntRange(from = 0) position: Long): Boolean

    /**
     * 设置播放位置读取间隔，一般不用修改
     *
     * @param interval 间隔毫秒数
     * @return 操作是否成功
     */
    fun setPositionUpdateInterval(@IntRange(from = 0) interval: Int): Boolean

    /**
     * 向远程播放器发送文本消息。
     *
     * 调用此方法会清除之前设置的歌曲信息，播放器进入纯文本模式。
     *
     * @param text 要发送的文本内容，可为 null
     * @return 命令是否成功发送
     */
    fun sendText(text: String?): Boolean

    /**
     * 设置显示翻译。
     *
     * 如果[RichLyricLine] 中有翻译信息，则显示翻译。
     *
     * @param displayTranslation 是否显示翻译
     */
    fun setDisplayTranslation(displayTranslation: Boolean): Boolean

    /**
     * 显示罗马音。
     *
     * 如果[RichLyricLine] 中有罗马音信息，则显示罗马音。
     *
     * @param displayRoma 是否显示罗马音
     */
    fun setDisplayRoma(displayRoma: Boolean): Boolean

    /**
     * 设置远程使用[PlaybackState]实现判断播放状态，计算播放位置。
     *
     * @param state 播放状态
     */
    fun setPlaybackState(state: PlaybackState?): Boolean
}
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

/**
 * 远端播放器状态发送接口。
 *
 * 提供端通过该接口把歌曲、播放状态、播放位置和歌词显示配置同步给中心服务。
 */
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
     * 更新播放位置到共享内存待读取区。
     *
     * @param position 播放位置，单位毫秒，最小值为 0。
     * @return 是否成功写入。
     * @see setPositionUpdateInterval
     */
    fun setPosition(@IntRange(from = 0) position: Long): Boolean

    /**
     * 设置中心服务读取播放位置的间隔，一般不用修改。
     *
     * @param interval 间隔毫秒数。
     * @return 命令是否成功发送。
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
     * 设置是否显示翻译。
     *
     * 如果 [RichLyricLine] 中有翻译信息，则中心服务可显示翻译内容。
     *
     * @param isDisplayTranslation 是否显示翻译。
     * @return 命令是否成功发送。
     */
    fun setDisplayTranslation(isDisplayTranslation: Boolean): Boolean

    /**
     * 设置是否显示罗马音。
     *
     * 如果 [RichLyricLine] 中有罗马音信息，则中心服务可显示罗马音内容。
     *
     * @param isDisplayRoma 是否显示罗马音。
     * @return 命令是否成功发送。
     */
    fun setDisplayRoma(isDisplayRoma: Boolean): Boolean

    /**
     * 使用 [PlaybackState] 同步播放状态。
     *
     * 中心服务可根据 [PlaybackState.position]、播放速度和更新时间计算实时进度。
     *
     * @param state 播放状态，传入 `null` 表示停止使用该模式。
     * @return 命令是否成功发送。
     */
    fun setPlaybackState(state: PlaybackState?): Boolean
}

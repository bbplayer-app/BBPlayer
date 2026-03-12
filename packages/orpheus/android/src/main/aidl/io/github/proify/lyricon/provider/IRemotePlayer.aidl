package io.github.proify.lyricon.provider;

import android.os.SharedMemory;
import io.github.proify.lyricon.lyric.model.Song;

//添加新方法，必须放在最后，保证aidl签名顺序，确保各api版本兼容性
interface IRemotePlayer {
    void setSong(in byte[] song);
    void setPlaybackState(boolean isPlaying);
    void seekTo(long position);
    void sendText(String text);
    void setPositionUpdateInterval(int interval);
    void setDisplayTranslation(boolean isDisplayTranslation);
    SharedMemory getPositionMemory();
    void setDisplayRoma(boolean isDisplayRoma);

    //依赖[android.media.session.PlaybackState]实现判断播放状态，计算播放位置
    void setPlaybackState2(in PlaybackState state);
}
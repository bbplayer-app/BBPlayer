package io.github.proify.lyricon.provider;

import android.os.SharedMemory;
import io.github.proify.lyricon.lyric.model.Song;

//添加新方法，必须放在最后，保证顺序
interface IRemotePlayer {
    void setSong(in byte[] song);
    void setPlaybackState(boolean isPlaying);
    void seekTo(long position);
    void sendText(String text);
    void setPositionUpdateInterval(int interval);
    void setDisplayTranslation(boolean isDisplayTranslation);
    SharedMemory getPositionMemory();
    void setDisplayRoma(boolean isDisplayRoma);
}
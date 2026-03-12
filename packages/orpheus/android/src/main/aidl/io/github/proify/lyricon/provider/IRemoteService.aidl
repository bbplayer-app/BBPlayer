package io.github.proify.lyricon.provider;

import io.github.proify.lyricon.provider.IRemotePlayer;

interface IRemoteService {
    IRemotePlayer getPlayer();
    void disconnect();
}
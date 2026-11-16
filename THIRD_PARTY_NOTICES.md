# 第三方组件声明

BBPlayer 本身以 MIT 许可证发布（见 [LICENSE](LICENSE)）。下面列出随安装包分发、需要单独声明许可证的第三方组件。

## FFmpeg

- **用途**：Android 上不走音频 offload 时（开启频谱、蓝牙耳机、非 1x 倍速等），在应用进程内解码 AAC、FLAC、MP3 音频。
- **形式**：动态库 `libffmpegJNI.so`，来自 Maven 包 [`org.jellyfin.media3:media3-ffmpeg-decoder:1.9.0+1`](https://central.sonatype.com/artifact/org.jellyfin.media3/media3-ffmpeg-decoder/1.9.0+1)。该包由 [Jellyfin 项目](https://github.com/jellyfin/jellyfin-androidx-media/tree/v1.9.0%2B1) 用 AndroidX Media3 官方的 `decoder_ffmpeg` 模块（[androidx/media@7cc1056](https://github.com/androidx/media/tree/7cc1056f840ce226598d3b990d4a6f7cd17e2831/libraries/decoder_ffmpeg)）和 FFmpeg 6.0.2（[`37c90f5`](https://git.ffmpeg.org/gitweb/ffmpeg.git/commit/37c90f55d8b6c3948c79449b04755527b4ae1351)）编译。
- **编译配置**：只启用了 `flac alac pcm_mulaw pcm_alaw mp3 aac ac3 eac3 dca mlp truehd` 这些解码器，没有启用 `--enable-gpl`、`--enable-nonfree` 的组件。
- **许可证**：FFmpeg 以 [GNU 宽通用公共许可证（LGPL）2.1](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html) 或更高版本发布。
- **源码**：FFmpeg 源码见 <https://git.ffmpeg.org/ffmpeg.git>（上面的提交）或 <https://ffmpeg.org/download.html>；编译脚本见 Jellyfin 仓库的 `build.sh`。
- FFmpeg 以动态库形式链接，可以替换为自行编译的同名动态库。
- Jellyfin 的仓库和该 Maven 包标注的许可证为 [GPL-3.0](https://github.com/jellyfin/jellyfin-androidx-media/blob/master/LICENSE)。

## AndroidX Media3

- **用途**：播放器内核（ExoPlayer、MediaSession 等），包括上面 FFmpeg 解码器的 Java / JNI 层。
- **许可证**：[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)，源码见 <https://github.com/androidx/media>。

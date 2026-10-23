# BBPlayer for macOS

原生 SwiftUI / AppKit 桌面应用，核心使用 AVPlayer、SQLite / GRDB 和 Keychain。与手机端独立构建，不需要 Expo、Node 或新后端。

## 打开与构建

本机要求：Apple Silicon、Xcode 27。本轮只在当前 Mac 上验证；代码的最低部署版本为 macOS 14，不等于已验证旧系统兼容。

在仓库根目录运行：

```sh
apps/macos/scripts/build-app.sh release
open apps/macos/build/BBPlayer.app
```

产物 `apps/macos/build/BBPlayer.app` 可复制到“应用程序”。目前使用本机临时签名，不是公证的公开发行包；换电脑不承诺直接运行。首次构建由 SwiftPM 获取固定版本 GRDB 7.11.1。

也可打开 `apps/macos/BBPlayer.xcodeproj`，选择 `BBPlayer` scheme，直接运行。核心和命令行探针独立保存在 Swift 包中：

```sh
swift test --package-path apps/macos
swift run --package-path apps/macos BBPlayerProbe BV1Zu411x7mc --play
swift run --package-path apps/macos BBPlayerProbe --services
swift run --package-path apps/macos BBPlayerProbe BV1Zu411x7mc --download-offline
```

探针默认静音，但解码、拖动和 PCM 采样均真实执行；`--audible` 开启 20% 音量。服务探针只读取公共内容。测试中的 HTTP 服务仅绑定 `127.0.0.1`，退出测试后关闭。

## 使用

- 搜索 B 站歌曲、BV / AV 号、视频链接或 b23 短链接。分 P 链接保留 `p` 参数；歌曲菜单可展开并记住全部分 P。双击歌曲播放，右侧菜单可入队、下一首播放、添加歌单或下载。
- 搜索框的“本地曲库”检索本机保存过的曲目。播放列表支持创建、重命名、删除、增删歌曲和调整顺序；远程收藏夹、合集、关注、稍后再看只读。
- 点击底部歌曲区域打开完整播放器。包含实时 PCM 频谱、流光背景、歌词、倍速、快进退、章节、循环、随机和定时停止。播放菜单快捷键为 Cmd+Shift+Space、Cmd+方向键；不会拦截搜索框的空格。
- 导入网易云 / QQ 公开歌单后，逐首限速匹配。低置信、失败项目需确认、改选或明确跳过，再保存；试听临时占用同一播放器，完成后恢复原上下文。
- 播放器右上角可开关弹幕，旁边菜单调整字号、密度、透明度和覆盖范围（上方三分之一 / 上半区 / 整个播放器）。默认关闭，设置自动保留；弹幕点击穿透，暂停和拖动按音频时间定位，隐藏播放器停止绘制。首版显示普通滚动弹幕，不包含高级脚本、发送或完整历史弹幕归档。
- 设置里打开桌面歌词。默认锁定和点击穿透；菜单栏可解锁拖动、调整宽度，再锁定。原文、已开启的翻译和罗马音完整保留并换行；浮窗按内容增高，超出屏幕后滚动。逐字时间可用时跟随唱词，无逐字时间时按本句时长估算位置；解锁后保留手动滚动。关闭主窗口继续播放，真正退出应用停止。恢复队列默认不自动发声。
- 主题装扮支持搜索、下载、应用、样式选择、头像框、开屏和资源预览。开屏显示为可跳过的浮层，主界面仍可操作；SVGA 点赞动画只供预览。不可见时移除动画和视频视图。
- 下载音频与临时缓存分开保存。暂停 / 继续 / 重试下载按分段恢复。清空缓存不会删除下载、装扮或历史。下载同时保留离线响度和章节信息。

## 本机数据和扩展边界

常规数据目录：`~/Library/Application Support/com.bbplayer.macos`。`library.sqlite` 保存歌单、历史、任务、歌词、队列和偏好；`downloads`、`themes`、`stream-cache` 独立。Cookie 只在 Keychain 中，数据库不保存签名播放 URL 或账号凭据。没有 Firebase、Sentry 或统计上传。

`MediaSourceProvider`、`PlaybackEngine`（原生实现 `NativePlaybackEngine`）、`LibraryRepository` 和 `SyncService` 分离内容来源、音频、持久化和后续同步。曲目用来源 + BVID + CID 标识，资源 URL 每次临时解析。歌词实现对照 `packages/splash` 的基础、逐字、重复时间戳和隐式翻译用例。

暂缓：本地音频导入、跨设备同步、手机备份、原 BBPlayer 账号与共享服务、评论、点赞 / 投币 / 收藏写回、音频导出、自动更新和公开发行。界面保留禁用的本地音乐入口。

## 验证与限制

详见 [验收记录](VALIDATION.md) 和 [实施恢复记录](IMPLEMENTATION.md)。构建通过、公共内容可播放不等于所有登录态与异常路径已验收；扫码确认必须由本人在手机完成。外部服务会限流或变更接口，失败会保留任务与队列，不绕过 TLS 校验。

性能测试使用隔离目录，不读取 Keychain 或私人音乐库：

```sh
python3 apps/macos/scripts/benchmark.py --scene hidden --seconds 300 --output /tmp/bbplayer-hidden.json
python3 apps/macos/scripts/benchmark.py --scene foreground --seconds 60 --output /tmp/bbplayer-foreground.json
python3 apps/macos/scripts/benchmark.py --scene lyrics --seconds 60 --output /tmp/bbplayer-lyrics.json
```

`--theme /path/to/validation-theme` 可对照真实装扮；目录须包含资源和安装探针写出的 `source-manifest.json`。启动统计在应用主界面出现时写出；播放预热前检查真实进度推进；频谱另行检查 PCM 数据，避免把未播放状态算作后台成绩。内存采用 RSS，并记录口径，不冒充 Instruments 的 physical footprint。

前台或悬浮歌词的复现实验可加 `--lyrics-fixture packages/splash/src/__tests__/fixtures/bilibili--BV1Zu411x7mc.json --probe /absolute/path/to/BBPlayerProbe`。探针先将真实对应歌词写入隔离库；普通应用音乐库不受影响。

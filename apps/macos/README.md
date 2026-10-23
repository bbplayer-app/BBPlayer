# BBPlayer for macOS

原生 SwiftUI / AppKit 桌面应用，核心使用 AVPlayer、SQLite / GRDB 和 Keychain。与手机端独立构建，不需要 Expo、Node 或新后端。

## 打开与构建

本机要求：Apple Silicon、Xcode 27。本轮只在当前 Mac 上验证；代码的最低部署版本为 macOS 14，不等于已验证旧系统兼容。

在仓库根目录运行：

```sh
apps/macos/scripts/build-app.sh release
open apps/macos/build/BBPlayer.app
```

产物 `apps/macos/build/BBPlayer.app` 可复制到“应用程序”。打包时优先使用显式配置或本机已保存的固定签名身份（见下节）；未配置时仅允许产生临时签名的开发包，更新命令拒绝安装它。不是公证的公开发行包，换电脑不承诺直接运行。首次构建由 SwiftPM 获取固定版本 GRDB 7.11.1。

### 减少钥匙串重复授权

登录凭据已长期保存在系统钥匙串。临时签名（ad-hoc）随可执行文件变化，重新构建后可能再次要求授权；“始终允许”不保证适用于重新构建的应用。

本机专用开发可在明确授权后执行一次：

```sh
python3 apps/macos/scripts/setup-local-signing.py
```

命令创建长期复用的本机签名身份，私钥以不可导出形式保存在本机钥匙串，仅允许系统代码签名工具使用；临时私钥和导入容器随后清除。不修改全局证书信任，也不上传密钥。本机配置仅保存证书指纹，位于开发配置目录，后续构建自动读取；不要删除签名身份或反复重新生成它。重新执行命令会验证并复用已保存身份，不静默换证。

应用启动会尝试无交互读取凭据；若系统要求授权，主界面显示“解锁已保存登录”，由点击该入口或设置里的解锁按钮后再进行系统授权。从旧临时签名首次迁移或钥匙串锁定时仍可能需要授权一次；这不会将 Cookie 改存明文文件。

每台开发机器首次配置时，先准备可用且长期保留的代码签名证书及对应私钥。已有 Apple 开发签名身份时优先使用；没有时可通过“钥匙串访问”的证书助理创建用途为“代码签名”的本地自签名证书，仅用于本机构建。不要为此关闭系统安全保护，也不要把证书私钥提交到仓库。可在终端查看可用身份：

```sh
security find-identity -v -p codesigning
```

将所选身份的 SHA-1 标识替换到下方占位符，然后构建：

```sh
export BBPLAYER_CODESIGN_IDENTITY='REPLACE_WITH_SIGNING_IDENTITY_SHA1'
apps/macos/scripts/build-app.sh release
```

使用手动环境变量方式时，后续构建和运行 `update-local.sh` 时都需保留同一环境变量、证书及应用标识；使用上述本机配置方式则由打包脚本自动读取保存的指纹。打包和更新脚本不会修改终端配置、创建证书或自动选择其他签名身份；证书创建只发生在单独授权的配置命令中。指定身份不可用时签名失败，不回退到临时签名。通过 Xcode 运行时，应在项目签名设置中选择一致的签名身份；上述环境变量只控制打包脚本。

新机器使用其本机钥匙串和登录态，无需复制旧机器的凭据。首次访问已有条目、从临时签名迁移、证书更换或钥匙串锁定时仍可能需要系统授权。固定签名用于保持更新前后的应用身份，不保证所有系统状态下都无弹窗；首次创建凭据、退出重开及连续两次重建后的实际授权行为仍需在对应机器验收。

也可打开 `apps/macos/BBPlayer.xcodeproj`，选择 `BBPlayer` scheme，直接运行。核心和命令行探针独立保存在 Swift 包中：

```sh
swift test --package-path apps/macos
swift run --package-path apps/macos BBPlayerProbe BV1Zu411x7mc --play
swift run --package-path apps/macos BBPlayerProbe --services
swift run --package-path apps/macos BBPlayerProbe BV1Zu411x7mc --download-offline
```

探针默认静音，但解码、拖动和 PCM 采样均真实执行；`--audible` 开启 20% 音量。服务探针只读取公共内容。测试中的 HTTP 服务仅绑定 `127.0.0.1`，退出测试后关闭。

## 本地更新命令

先退出 BBPlayer 并提交代码，再在仓库根目录运行：

```sh
apps/macos/scripts/update-local.sh
```

命令依次测试、构建 Release、推送 `main`、在推送成功后重新构建并校验签名，最后替换 `/Applications/BBPlayer.app`。只允许推送到当前 GitHub CLI 登录账号下、与 `origin` 地址一致的 `BBPlayer-macOS` 仓库，并要求 Actions 关闭。需要已登录的 GitHub CLI 和应用程序目录的写入权限。它不自动提交，不强制推送，也不创建 PR。每次经授权的推送成功后都需从该提交重新构建；普通 `git push` 不会自动调用此脚本，手动推送也必须执行构建步骤。

应用仍运行、工作区未提交、测试、推送或推送后构建失败时停止。若推送后安装失败，远端提交仍然存在，可修正问题后使用 `apps/macos/scripts/update-local.sh --install-only` 重试；该模式支持当前已提交的功能分支，重新测试和构建，仅安装，不连接 GitHub。功能分支推送时先明确推送该分支，再运行 `--install-only`，无需合并 `main`。安装中暂存旧版以便失败回滚；新安装签名验证通过且内容与最新构建完全一致后，自动删除本项目旧应用备份、旧 ZIP 包和已识别的临时歌词测试应用。安装目录和构建目录可各保留一份相同的最新版；曲库、下载、Keychain、签名私钥及源码历史不清理，也不自动启动应用。

## 使用

- 本地歌单支持按歌名或歌手搜索；“播放全部”包含尚未加载的分页，搜索后则播放完整筛选结果。“更多”可批量入队或下载；远程列表明确只处理已加载歌曲。多选后可批量入队、下载或添加到其他本地歌单。
- 删除本地歌单前需确认；底部“撤销删除”可恢复最近一次删除及完整歌曲顺序，重启后仍有效。再次删除会替换恢复记录；这不代替完整备份。
- 队列支持拖动排序及上下移动；重复追加自动跳过，“下一首播放”移动已有条目。侧栏分隔线可拖动调整宽度，双击还原。
- 点击历史热力图或选择日期可查看逐次收听明细，返回“最近播放”查看去重后的歌曲。播放页会显示服务返回的实际音轨规格，未知字段不展示。
- 搜索 B 站歌曲、BV / AV 号、视频链接或 b23 短链接。分 P 链接保留 `p` 参数；歌曲菜单可展开并记住全部分 P。双击歌曲播放，右侧菜单可入队、下一首播放、添加歌单或下载。
- 搜索框的“本地曲库”检索本机保存过的曲目。播放列表支持创建、重命名、删除、增删歌曲和调整顺序；远程收藏夹、合集、关注、稍后再看只读。
- 点击底部歌曲区域打开完整播放器。包含实时 PCM 频谱、流光背景、歌词、倍速、快进退、章节、循环、随机和定时停止。播放菜单快捷键为 Cmd+Shift+Space、Cmd+方向键；不会拦截搜索框的空格。
- 导入网易云 / QQ 公开歌单后，逐首限速匹配。低置信、失败项目需确认、改选或明确跳过，再保存；试听临时占用同一播放器，完成后恢复原上下文。
- 播放器右上角可开关弹幕，旁边菜单调整字号、密度、透明度和覆盖范围（上方三分之一 / 上半区 / 整个播放器）。默认关闭，设置自动保留；弹幕点击穿透，暂停和拖动按音频时间定位，隐藏播放器停止绘制。首版显示普通滚动弹幕，不包含高级脚本、发送或完整历史弹幕归档。
- 设置里打开桌面歌词。默认锁定和点击穿透；先在菜单栏取消“锁定歌词（点击穿透）”，再按住歌词文字拖动位置，滚轮可查看长句，右上角锁按钮重新锁定。解锁时会显示操作提示，也可调整宽度。原文、已开启的翻译和罗马音完整保留并换行；浮窗按内容增高，超出屏幕后滚动。逐字时间可用时跟随唱词，无逐字时间时按本句时长估算位置；解锁后保留手动滚动。关闭主窗口继续播放，真正退出应用停止。恢复队列默认不自动发声。
- 主题装扮支持搜索、下载、应用、样式选择、头像框、开屏和资源预览。开屏显示为可跳过的浮层，主界面仍可操作；SVGA 点赞动画只供预览。不可见时移除动画和视频视图。
- 下载音频与临时缓存分开保存。暂停 / 继续 / 重试下载按分段恢复。清空缓存不会删除下载、装扮或历史。下载同时保留离线响度和章节信息。

## 本机数据和扩展边界

常规数据目录：`~/Library/Application Support/com.bbplayer.macos`。`library.sqlite` 保存歌单、历史、任务、歌词、队列和偏好；`downloads`、`themes`、`stream-cache` 独立。Cookie 只在 Keychain 中，数据库不保存签名播放 URL 或账号凭据。没有 Firebase、Sentry 或统计上传。

`MediaSourceProvider`、`PlaybackEngine`（原生实现 `NativePlaybackEngine`）、`LibraryRepository` 和 `SyncService` 分离内容来源、音频、持久化和后续同步。曲目用来源 + BVID + CID 标识，资源 URL 每次临时解析。歌词实现对照 `packages/splash` 的基础、逐字、重复时间戳和隐式翻译用例。

暂缓：本地音频导入、跨设备同步、手机备份、原 BBPlayer 账号与共享服务、评论、点赞 / 投币 / 收藏写回、音频导出、自动更新和公开发行。界面保留禁用的本地音乐入口。

## 验证与限制

持续待办见 [TODO.md](TODO.md)。本机最新功能包的证据另见 `validation/library-workflows-20261023.json`；历史性能数据不代表新版复测。

详见 [验收记录](VALIDATION.md) 和 [实施恢复记录](IMPLEMENTATION.md)。构建通过、公共内容可播放不等于所有登录态与异常路径已验收；扫码确认必须由本人在手机完成。外部服务会限流或变更接口，失败会保留任务与队列，不绕过 TLS 校验。

性能测试使用隔离目录，不读取 Keychain 或私人音乐库：

```sh
python3 apps/macos/scripts/benchmark.py --scene hidden --seconds 300 --output /tmp/bbplayer-hidden.json
python3 apps/macos/scripts/benchmark.py --scene foreground --seconds 60 --output /tmp/bbplayer-foreground.json
python3 apps/macos/scripts/benchmark.py --scene lyrics --seconds 60 --output /tmp/bbplayer-lyrics.json
```

`--theme /path/to/validation-theme` 可对照真实装扮；目录须包含资源和安装探针写出的 `source-manifest.json`。启动统计在应用主界面出现时写出；播放预热前检查真实进度推进；频谱另行检查 PCM 数据，避免把未播放状态算作后台成绩。内存采用 RSS，并记录口径，不冒充 Instruments 的 physical footprint。

前台或悬浮歌词的复现实验可加 `--lyrics-fixture packages/splash/src/__tests__/fixtures/bilibili--BV1Zu411x7mc.json --probe /absolute/path/to/BBPlayerProbe`。探针先将真实对应歌词写入隔离库；普通应用音乐库不受影响。

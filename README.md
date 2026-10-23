<div align="center">
<img src="./apps/mobile/assets/images/icon_large.png" alt="BBPlayer logo" width="64" />
<h1>BBPlayer for macOS</h1>

一款本地优先的原生 macOS Bilibili 音频播放器。

使用 SwiftUI / AppKit 构建，将歌单、逐字歌词、桌面歌词、弹幕和 B 站主题装扮带到桌面。

**SwiftUI · AppKit · AVPlayer · Apple Silicon · MIT**

[构建与安装](#构建与安装) · [主要功能](#主要功能) · [验证与待办](#验证与待办) · [详细使用说明](./apps/macos/README.md)

</div>

---

本项目基于 BBPlayer 的代码与设计进行原生 macOS 开发，目前处于本机构建、实验使用阶段。macOS 应用独立运行，不依赖 React Native、Expo 或仓库内的后端服务。尚未提供经过公证的公开发行包。

## 主要功能

### 核心播放体验

- **搜索与解析**：搜索 B 站歌曲，支持 BV / AV 号、视频链接和 b23 短链接，识别分 P 链接与章节。
- **播放控制**：播放队列、单曲循环、列表循环、随机播放、倍速、定时停止和基于元数据的响度均衡。
- **进度恢复**：保存队列与播放位置，重启后默认不自动播放；关闭主窗口可继续播放，通过菜单栏恢复窗口。
- **本地歌单**：创建、重命名、删除歌单，管理曲目顺序，搜索本地曲库。
- **账号内容**：提供扫码和 Cookie 登录入口，读取收藏夹、合集、关注与稍后再看；真实账号完整流程仍需人工验收。
- **外部歌单导入**：将网易云音乐、QQ 音乐公开歌单匹配到 B 站视频，支持试听、检查结果与替换匹配后保存。

### 歌词系统

- **逐字歌词**：支持 SPL、LRC、YRC 等格式，展示逐字进度、翻译与罗马音。
- **匹配与调整**：支持在线获取、手动匹配、粘贴歌词和偏移量调整；服务可用性取决于对应平台接口。
- **桌面歌词**：原生悬浮窗，支持锁定、点击穿透、解锁拖动与宽度调整。
- **长句展示**：保留完整的原文、翻译和罗马音，自动换行；内容过长时在屏幕范围内滚动，解锁后可手动查看。

### 弹幕与视觉效果

- **滚动弹幕**：在完整播放器中按音频时间显示普通滚动弹幕，支持字号、密度、透明度和显示区域设置。
- **覆盖范围**：可选播放器上方三分之一、上半区或整个播放器；弹幕默认关闭，绘制层不接收鼠标点击。
- **音频可视化**：基于真实 PCM 采样的频谱与流光背景；不可见时暂停对应视觉处理。

### 主题装扮

可在应用内搜索、下载并应用 B 站主题资源，包括主题图像、导航图标、头像框、开屏视频和资源预览。支持静态图片、视频及部分 SVGA 动画；点赞动画仅供预览，不向 B 站发送点赞操作。

不同装扮的资源格式与兼容性可能存在差异，无法解析的资源会显示错误提示。

### 离线与统计

- **离线下载**：下载、暂停、继续与失败重试，保留响度和章节信息。
- **独立缓存**：流媒体缓存与已下载音频分开管理，清理缓存不会删除已下载内容。
- **收听记录**：播放历史、最近播放、排行榜和热力图，按实际收听时间统计。

## 构建与安装

### 环境要求

- Apple Silicon Mac。
- 当前验证环境为 macOS 27.0.1 / Xcode 27。
- 代码最低部署版本为 macOS 14；Intel 与其他系统版本尚未验证。

### 本机构建

在仓库根目录执行：

```sh
swift test --package-path apps/macos
apps/macos/scripts/build-app.sh release
open apps/macos/build/BBPlayer.app
```

产物位于 `apps/macos/build/BBPlayer.app`，可复制到“应用程序”。首次构建需要联网获取 SwiftPM 依赖；macOS 构建不需要安装整个仓库的 JavaScript 依赖。

也可使用 Xcode 打开 `apps/macos/BBPlayer.xcodeproj`，选择 `BBPlayer` scheme 运行。应用使用本机临时签名，尚未完成公证，不保证复制到其他电脑后可直接运行。

### 开发时更新本机应用

先退出 BBPlayer 并提交修改，再运行：

```sh
apps/macos/scripts/update-local.sh
```

该命令依次执行测试、Release 构建、签名校验、推送 `main`，最后替换 `/Applications/BBPlayer.app` 并备份旧版。它要求 GitHub CLI 已登录，且 `origin` 指向该登录账号下的 `BBPlayer-macOS` 仓库；GitHub Actions 须保持关闭。

只测试、构建并安装，不连接 GitHub：

```sh
apps/macos/scripts/update-local.sh --install-only
```

命令不会自动提交、创建 PR 或启动应用，普通 `git push` 也不会触发本机更新。完整前置条件与恢复方式见[本地更新说明](./apps/macos/README.md#本地更新命令)。

## 技术栈

| 层级 | 实现 |
| --- | --- |
| 桌面界面 | SwiftUI、AppKit |
| 音频播放 | AVPlayer / AVFoundation |
| 本地存储 | SQLite、GRDB.swift |
| 账号凭据 | macOS Keychain |
| 桌面歌词与排版 | AppKit、TextKit |
| 动画预览 | 原生图像与视频渲染、隔离的 WebKit SVGA 渲染器 |
| 构建与测试 | Swift Package Manager、Xcode、XCTest |

## 项目结构

- **[apps/macos](./apps/macos)**：原生 macOS 应用、核心服务、测试与本地构建脚本。
  - **[Sources/BBPlayerMac](./apps/macos/Sources/BBPlayerMac)**：桌面界面、歌词浮窗与应用交互。
  - **[Sources/BBPlayerCore](./apps/macos/Sources/BBPlayerCore)**：播放、网络、存储、歌词、装扮与下载逻辑。
  - **[Tests](./apps/macos/Tests)**：核心回归与界面排版测试。
  - **[scripts](./apps/macos/scripts)**：构建、更新与性能验证工具。
- **[packages/splash](./packages/splash)**：继承的歌词解析库与格式样例，供 macOS 歌词实现对照。
- **[apps/mobile](./apps/mobile)**、**[apps/backend](./apps/backend)**、**[apps/docs](./apps/docs)** 及其他共享包：保留的 BBPlayer 源文件，不参与 macOS 应用构建或发布。

## 隐私与本机数据

- 歌单、历史、播放队列、歌词与偏好保存在本机 SQLite 数据库中。
- Cookie 保存在 macOS Keychain，数据库不保存账号凭据或签名播放 URL。
- 下载、主题和流媒体缓存使用独立目录。
- macOS 应用未集成 Firebase、Sentry 或使用统计上传。

在线播放、搜索、登录、歌词匹配与主题下载仍会访问相应平台。上述说明适用于 `apps/macos`；继承的其他应用目录可能有不同的数据处理方式。

更多数据目录与行为说明见[本机数据说明](./apps/macos/README.md#本机数据和扩展边界)。

## 验证与待办

现有记录包含 **31 项核心测试与 2 项 AppKit 排版测试通过**、Release 和 Xcode Debug 构建、签名检查，以及公共内容播放、真实频谱、离线播放与主题渲染验证。测试通过不代表全部使用场景已验收。

仍需验证：

- 真实扫码登录、登录过期与退出，以及登录态内容完整流程。
- 播放器进度、倍速、切歌与弹幕交互的连续操作。
- 物理媒体键、控制中心、多显示器和全屏切换后的桌面歌词行为。
- 密集弹幕、频繁切换装扮及数小时连续播放的稳定性与资源占用。
- 长时间断网恢复、磁盘耗尽、异常退出和批量下载、导入等故障场景。

暂缓功能：本地音频导入、音频导出、纯音乐识别、跨设备同步、手机备份导入、BBPlayer 账号与共享服务、评论及点赞 / 投币 / 收藏写回、应用内自动更新和公开发行。弹幕目前不支持发送、高级脚本或完整历史归档。

详细证据、测量口径及限制见[验证记录](./apps/macos/VALIDATION.md)；实现范围与迭代记录见[实施记录](./apps/macos/IMPLEMENTATION.md)。

## 开发方式

`main` 保留经过相应检查的代码。小范围、低风险修正可直接提交；较大功能与实验使用描述功能的临时分支，验证后在本地合并回 `main`。不要求长期保留 `dev` 或创建 PR。

开发与推送仅使用本仓库配置的 `origin`，不与 `bbplayer-app/BBPlayer` 同步或向其提交 PR。GitHub Actions 保持关闭，测试与构建在本地进行。

## 来源与开源许可

本项目基于 **bbplayer-app/BBPlayer** 的代码、资源与设计进行开发，保留已有版权声明、来源说明及提交历史。macOS 版本为独立的实验性开发，不代表 BBPlayer 项目维护方的官方 macOS 发行版。

本项目采用 [MIT 许可](./LICENSE)。GRDB.swift、SVGAPlayer-Web、JSZip 等组件的许可与本地修改说明见[第三方声明](./apps/macos/THIRD_PARTY_NOTICES.md)。

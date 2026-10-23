# macOS 首版验收记录

2026-10-22；Apple M2 / 16GB / macOS 27.0.1 / Xcode 27。此记录区分实现、已验证结果与仍需人工完成的验收，不把“构建成功”当作全量通过。

## 已验证

| 项目 | 证据 |
|---|---|
| 原生独立构建 | SwiftPM Debug / Release 成功；Xcode `BBPlayer` scheme Debug 独立构建成功 |
| 本地应用包 | ARM64 `.app`，本机临时签名；`codesign --verify --deep --strict` 成功；具体大小和 SHA 见 `validation/artifact.json` |
| 核心回归 | 27 个 Swift 测试通过；身份、WBI、LRC / SPL / YRC、统计、缓存、请求、队列、试听、恢复和下载 |
| 真实音频 | BVID `BV1Zu411x7mc`；常规 AAC 解析、32KB Range、播放、45 秒定位成功；实际 PCM 采样超过 100 万帧 |
| 频谱暂停与恢复 | 真实正弦音频测试：隐藏频谱后播放进度继续，重新显示后频谱恢复，非模拟柱形动画 |
| 桌面界面 | 实际启动、普通搜索、播放页与设置页已检查；关闭主窗后原生歌词面板仍显示内容；重启不自动发声 |
| 公开内容接口 | B 站关键词 20 条；网易云歌词与 200 首公开歌单；QQ 歌词与 66 首公开歌单；装扮检索与 42 个资源下载 |
| 真实装扮视频 | AVAssetReader 原生解码得到 1080×1618 帧 |
| SVGA | 官方样例、1.x 样例、真实 B 站 2.1 动画均输出非透明像素，结果见 `validation/renderers.json` |
| SVGA 隔离 | 固定本地依赖；无外部脚本、凭据或通用原生调用；静态 protobuf 解码；未开启 unsafe-eval；额外 10 个静态解码断言通过 |
| 下载恢复 | 本机 Range 服务集成测试：暂停后继续、不重复整首下载、文件逐字节相同、离线响度元数据保留、删除后两种内容身份映射均清除；另以真实 AAC 下载 3,397,406 字节，禁用网络解析后本地播放推进超过 1 秒、捕获 65,536 PCM 帧、网络解析次数为 0 |
| 登录错误状态 | 模拟二维码过期 / 已扫码、登录失效、未向二维码轮询传 Cookie、拒绝向其他域名传凭据 |
| 统计规模 | 1 万曲目 / 100 歌单 / 10 万历史，搜索、分页、最近与统计组合查询约 0.12 秒；并发构建时曾为 0.29 秒 |

## Release 性能

最终结果写入 `validation/*-release.json`，每份记录包含被测二进制 SHA。

- 启动：独立新进程三次，主界面出现且可响应时记录，不等远程结果；取中位数。不是磁盘缓存冷启动。
- 隐藏播放：实际确认主窗隐藏、歌词关闭、无下载；确认播放进度推进后预热 20 秒，采集至少 300 秒。CPU 采用进程累计 CPU 时间差，单核 100% 口径。
- 内存：RSS，合计应用及后代进程；这些场景未打开 SVGA 预览，没有存活的 WebKit 视图。RSS 不冒充 Instruments 的 physical footprint。
- 前台与悬浮歌词：另测，使用下载的真实装扮和仓库内与该 BVID 对应的逐字、翻译、罗马音歌词样例，避免空歌词代替渲染成本。短测不代表数小时无增长。
- 旧的 `hidden-before-tap-suspension.json` 仅保留诊断历史。窗口可见性当时未记录，不能作为后台验收；不合条件或提前终止的采样没有计为通过。

| 场景 | CPU 均值（单核 100%） | RSS 均值 / 峰值 | 采样时长 |
|---|---:|---:|---:|
| 主窗隐藏、歌词关闭 | 1.47% | 132.9 / 136.7 MiB | 320.4 秒 |
| 前台完整效果与真实装扮 | 17.28% | 185.5 / 195.8 MiB | 64.2 秒 |
| 主窗隐藏、悬浮歌词开启 | 4.54% | 159.5 / 162.5 MiB | 64.3 秒 |

默认主题的三次进程冷启动为 0.375, 0.301, 0.295 秒，中位数 **0.301 秒**。三种场景均无未播放采样点，后台测试跨越完整歌曲结尾并继续循环。

以上为静音解码播放测量。后台测试后只修正了诊断入口的前台窗口呈现；播放内核与正常应用路径没有变化。后台与另外两场景的构建 SHA 分别保留在各自 JSON，未伪装为同一个二进制。CPU、内存、启动和应用体积在这一测量口径内达到基线目标；完整人工验收仍未完成。


## 仍需本人或专门故障环境验收

- 手机扫码确认、真实 Cookie 失效与退出登录、登录态收藏夹 / 合集 / 关注 / 稍后再看全流程。
- 物理媒体键和控制中心、多个显示器和全屏后的歌词位置恢复；菜单栏打开、解锁拖动、重新锁定。
- 真正过期的 CDN 链接重取、长时间断网 / 恢复、磁盘耗尽、异常退出、下载及导入大批量恢复。
- 1 万首实际列表的长距离滚动、长音频倍速与章节、实际听感响度均衡；不能由 SQL 测试代替。
- 反复切换多个大型装扮、损坏资源、关闭 SVGA 预览后的长期 WebKit 内存回收，以及数小时播放内存增长。

这些项目已有实现或错误处理路径，但尚未获得足够运行证据，不能标记通过。

## 环境限制和复核

- 酷狗补充歌词服务本次遭遇 TLS 证书错误，保持正常证书校验；网易云和 QQ 作为可用来源，仍支持手动粘贴与匹配。
- 根目录 `pnpm type-check` / `pnpm lint` 已尝试；仓库未安装 JS 依赖，命令转而触发整仓安装与网络重试，已停止。没有宣称它们通过；本次未更改手机 / 后端 TS 源码。
- 使用了本机配置的 Codex × DeepSeek 协作技能。前置分析完成，后置源码复核经用户授权后两次超时，没有可用复核结论。后续依靠本地测试与重现纠错。
- 自动审批曾拒绝把新源码发送给 DeepSeek，用户随后明确授权；也拒绝开启 unsafe-eval，该方案未执行，已用静态解码解决兼容问题。
- 首版是供当前 Mac 本地使用的应用，尚未完成全量验收、公证、公开发行或长期稳定性承诺。

## 2026-10-23 fork migration and follow-up

Canonical checkout: this repository root. Migration source files (66) and original archive were hash-verified; original 27 tests passed in the fork before changes. The old checkout was then moved to Trash after a remote migration-baseline backup.

Follow-up checks: **31 core + 2 AppKit tests passed**, static SVGA 10 assertions passed, SwiftPM Release and Xcode Debug builds passed, strict app signing verified. Real public Bilibili segment: HTTP 200 / 18,663 bytes / 98 scrolling comments. Isolated muted Release playback visibly rendered real danmaku and enlarged navigation; screenshot is local under `build/qa/player.png`. Long multilingual lyric tests retain every character, produce overflow layout and preserve unlocked manual scroll. Compact evidence: `validation/iteration-20261023.json`; current package hashes: `validation/artifact.json`.

The performance tables above remain historical v1 measurements. New dense-danmaku resource costs and full manual interaction/multi-display acceptance have not been measured. This round does not implement pure-music recognition.

验证 JSON 中的本机绝对路径已改为相对路径；测量值未改动。迁移清单中的 SHA-256 记录迁移当时的文件内容，不代表隐私清理后的文件哈希。

# macOS 首版验收记录

## Persistent signing, explicit credential unlock and latest-package retention (2026-10-23)

The prior installation still had a content-hash-based ad-hoc requirement and no usable signing identity had been configured. With explicit authorization, a persistent self-signed local code-signing identity was created: the private key was imported non-extractably with access restricted to the system signing tool, temporary import material was deleted, and no global trust settings were changed. Only its fingerprint is saved in local development configuration; it is not committed. Re-running setup retained the same identity.

Two different signed binaries produced the same certificate-based designated requirement. A second test created a uniquely scoped disposable Keychain item with one build and read it with a changed build signed by the same identity while authentication UI was prohibited; it passed and the item was deleted. No existing credential or Bilibili Cookie was read for this test. Actual legacy-item authorization retention and subsequent real-account restart/update behavior remain pending.

The initial noninteractive authentication-context change did not suppress legacy login-keychain ACL prompts, as confirmed by a subsequent real startup report. Startup now also disables legacy Keychain interaction within a serialized, process-local scope and restores its prior state even on errors. A disposable legacy keychain with an ACL trusting a different system executable verifies denied reads return without UI; it does not use real credentials. The redundant LAContext query configuration has since been removed; the legacy interaction policy remains. Interaction-required/authentication-cancelled errors expose an explicit saved-login unlock action in the sidebar/settings instead of initiating a system prompt during startup. Cookies remain in Keychain. The prior build passed **45 core + 4 AppKit tests**. The follow-up adds legacy-policy restoration and real restricted legacy-keychain coverage; the full follow-up run passed **47 core + 4 AppKit tests**. The fix was packaged with the persistent identity, installed with signature and manifest verification, and launched against existing local data. The main window displayed the explicit saved-login unlock action without a startup password prompt. Duplicate app/build executable cleanup completed, leaving the canonical installed app only. Explicit real-account unlock and behavior after another future update remain pending.

Release packaging used the saved certificate identity and passed strict signature verification. The updater rejects ad-hoc installations, verifies the installed signature, and retains rollback material until installed/build manifests match. A scoped cleanup then removes obsolete managed app backups, the historical packaged ZIP and recognized temporary lyric diagnostic apps, preserving only the installed app, data and source history. After manifest verification, cleanup also deletes the source build app, SwiftPM executable copies and matching duplicate apps in accessible common locations. Six cleanup tests passed for package selection, mismatch refusal, identity refusal, symlink safety and diagnostic-path restrictions. Both shell scripts passed syntax checks. Actual installation/cleanup results are recorded locally by the update run, not inferred from these tests.

## Post-push rebuild workflow (2026-10-23)

Every authorized successful push now requires a subsequent Release rebuild and signature verification. The default local updater retains its pre-push verification build, then pushes verified main, rebuilds again, and stages only the post-push result for installation. Install-only mode can verify/install a committed feature branch without pushing or merging main. Both modes stop if the branch, revision or worktree changes, and preserve the previous installed app as a backup.

Both shell scripts passed `zsh -n`. Isolated stubbed update scenarios passed for push→second build→install ordering, preservation of the installed app when the second build fails, and feature-branch install-only without any push. These fixtures used temporary application directories and do not establish actual installation; actual post-push build/install outcomes are reported separately after execution. The prior lyric tests (43 core + 4 AppKit) still describe the unchanged Swift fix.

## Floating lyric drag fix (2026-10-23)

Unlocked lyric text now explicitly calls the native window drag operation on mouse-down; relying only on `isMovableByWindowBackground` was insufficient because the embedded NSTextView consumes mouse events. Locked windows remain immovable and click-through. An unlocked header explains dragging/scrolling and provides a lock button; reserved header space is included in adaptive height.

All 43 core + 4 AppKit tests passed, including a new native mouse-down dispatch test with a tracking NSPanel and the existing long-text/manual-scroll tests. Release app packaging and strict signature verification passed. Current rebuilt-bundle hash is recorded in `validation/lyric-drag-20261023.json`; earlier bundle evidence is historical.

Actual pointer dragging was not accepted as passed: the UI automation connection did not reliably bind to the intended isolated diagnostic process. No private-library interaction was used as evidence. Menu unlock, physical drag/relock, persistence and multiple displays still require end-to-end acceptance. No installed-app replacement, commit or push was performed for this fix. Concurrent signing-related edits were preserved.

## Next-build checkpoint: persistent signing and Keychain (2026-10-23)

The build script now accepts `BBPLAYER_CODESIGN_IDENTITY`, warns on ad-hoc signing and verifies the resulting signature. Shell syntax, Release packaging with the default ad-hoc identity, and strict signature verification passed. No persistent certificate was configured or tested, and no installed application was replaced.

At the next build, check the selected signing identity first. With the required authorization, verify initial credential storage, quit/relaunch, and two successive rebuilds using the same certificate; record actual password prompts. Repeat on a fresh machine when available. Initial authorization or a locked Keychain may still require interaction. This acceptance remains pending; do not claim repeated prompts are resolved from build success alone. See `TODO.md` and the signing setup in `README.md`.

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

## 2026-10-23 deletion confirmation and queue improvements

- Implemented a named playlist deletion confirmation with cancel/delete actions. Actual dialog interaction has not been manually exercised; backup and undo are not implemented in this batch.
- Queue append skips an existing content identity. Play-next moves matching entries behind the current entry while preserving the active index, position and playback intent. Different CIDs remain distinct; play-next on the active identity does nothing.
- `swift test --package-path apps/macos`: 33 core tests and 2 AppKit tests passed. Added two queue regressions for identity, persistence, duplicates before/after the active entry, paused progress and rate. Extended the real PCM playback test to verify queue edits retain playback and do not re-resolve the source.
- `swift build --package-path apps/macos -c release --product BBPlayerMac`: passed. This is a Release executable build, not a newly installed or repackaged application. Existing artifact hashes and performance measurements were not refreshed.
- Restricted-environment runs were not passes: the default manifest cache was unwritable; a temporary-cache test run failed local-server/PCM checks and the scale timing threshold; a restricted Release build failed during dSYM generation. Repeating tests and the Release build in the normal local environment passed. No failing assertions were removed or thresholds relaxed.
- `git diff --check` passed. The new backlog and changed source/test files were checked for personal identifiers and home-directory paths; none were found. No commit, push or application installation was performed.

## 2026-10-23 queue drag sorting

- Queue rows now expose native SwiftUI List move handling and a drag affordance. Existing up/down buttons use the same ordering logic. The core accepts single or multiple source offsets and an insertion boundary; invalid requests are ignored.
- Active playback is tracked by the original queue occurrence during reordering, fixing index selection for legacy queues containing duplicate content identities. Reordering preserves progress, rate and playback intent, and persists the resulting order/index without reloading audio.
- `swift test --package-path apps/macos`: 35 core tests and 2 AppKit tests passed. New regressions cover block moves, top/bottom insertion, no-op/invalid requests, arrow moves, duplicate occurrences and persistence. The real PCM playback test also reorders the playing entry without re-resolving its source.
- `swift build --package-path apps/macos -c release --product BBPlayerMac`: passed. `git diff --check` and identifier/home-path scans of changed files passed.
- Native pointer dragging and the earlier deletion dialog still need runtime interaction acceptance. Core tests and compilation do not establish that acceptance. No application packaging, installation, commit or push was performed.

## 2026-10-23 playlist deletion undo

- Local playlist deletion now writes a complete ordered recovery snapshot and deletes the playlist in the same SQLite transaction. Only the latest successful deletion is retained, including across database reopen/application restart; the next successful deletion replaces it. No schema migration is needed because the existing state table stores the record.
- A persistent footer offers undo. Restore retains playlist identity, title, cover and complete membership beyond the 100-row UI page size, preserves current shared track metadata, and clears the recovery record only after successful restoration. Existing playlists with the same ID are not overwritten. Downloads, lyrics and listening history are not deleted by either operation.
- `swift test --package-path apps/macos`: 38 core tests and 2 AppKit tests passed. Three new regressions cover 205 ordered tracks, database reopen, shared metadata/history/lyrics/download references, latest-only retention, empty-playlist deletion, conflict rejection, and forced SQL failures during deletion/restoration with transactional rollback and retry.
- `swift build --package-path apps/macos -c release --product BBPlayerMac`: passed. Diff whitespace checks and identifier/home-directory path checks passed for changed files.
- Delete/undo footer interaction still requires runtime UI acceptance. This does not implement automatic snapshots or a general backup format. No packaging, application installation, commit or push was performed.

## 2026-10-23 library workflows, history and stream information

- Local playlist playback and whole-list enqueue/download operations query complete membership, including unloaded pages, with the active title/artist filter. Remote/search operations explicitly say they affect loaded entries only. Multi-selection supports queue append, downloads and transactional addition to another local playlist; batch APIs deduplicate while preserving input order.
- Heatmap cells and the date picker select paginated listening sessions, preserving repeated plays as separate events. Recent songs remain deduplicated. Day queries use calendar day boundaries and the existing timestamp index, including 23-hour DST days.
- Sidebar width is draggable, locally persistent, clamped to 180–300 points and resettable to 224 by double-click, with accessibility adjustment. The playback page displays available stream codec/bitrate/sample rate; new offline metadata preserves this information, while old metadata without the optional field still decodes. Higher-quality format selection is not implemented.
- `swift test --package-path apps/macos`: **43 core + 3 AppKit tests passed**, including whole-playlist/filter queries beyond 100 rows, transactional batch append, batch enqueue/download deduplication, repeated sessions and DST bounds, legacy metadata decoding, and an isolated AppModel workflow spanning playlist/filter/history/delete/restore. Test-only failures in temporary-directory cleanup and Retina pixel-size assumptions were corrected; the final full suite passed.
- Four native NSHostingView renders at 1120×740 points were generated and visually inspected for playlist, filtered result, history and undo footer layouts. Screenshots are local at `build/qa/workflows/`. These are rendering/model checks, not pointer-driven UI automation; dialogs, drag handles, batch menus and date controls still need interaction acceptance.
- `apps/macos/scripts/build-app.sh release` passed and rebuilt the local ARM64 `.app`; `codesign --verify --deep --strict` passed. Current bundle evidence is `validation/library-workflows-20261023.json`. The previous `validation/artifact.json` and archived ZIP describe a historical build and were not presented as new artifacts. No installed application was replaced.
- Changes reside on the local `feature/library-workflow-improvements` branch without commits, merges, pushes or external review. No mobile/backend source changed, so mobile JS/Gradle checks do not apply. No new performance or authenticated-provider acceptance is claimed.

## Authentication cleanup review (2026-10-23)

Removed the redundant LocalAuthentication dependency and query-context-only test from the legacy credential path. Retained persistent signing, scoped legacy interaction suppression, explicit unlock actions and application cleanup. Unlock only retries reading the existing item; it does not migrate credentials or modify their ACL. Historical fixture/build results above do not establish real-account authorization retention. This source change does not replace the installed app.


## 2026-10-25 external playlist search and recovery

- Mac import video searches omit the login cookie. Weak candidates trigger one title-only fallback; both use the shared four-second request scheduler. Candidates require song-title relevance and are deduplicated. Long decorated titles retain song-name evidence, unrelated artist videos are excluded, and alternate versions receive a penalty. Scores are heuristic rankings, not calibrated probabilities.
- Five consecutive unmatched songs pause the run for five minutes. Any communication/service/response error stops at the current item without advancing the cursor: known throttling codes wait five minutes; other errors wait one minute. Cooldown and the reason persist across restart, require explicit continuation, and are not proof of provider throttling. Empty results can also indicate genuinely missing content or unsuitable keywords.
- “重试失败项” repositions the existing job to the first unreviewed failure, skips existing selected tracks and explicit skips, and preserves job identity and all choices. Old job JSON remains readable without the new optional cooldown fields. Previously successful matches are not silently rematched. Re-reading a playlist still starts a new job; saving still creates a new local playlist rather than merging by source/name.
- The replacement sheet starts a search on opening, displays loading/empty/error states, supports title-only search and video links/BV identifiers, and cancels superseded/dismissed tasks. Classroom/non-video items are excluded. A missing result payload with an explicit zero result count is accepted as empty; other malformed responses are errors.
- `swift test --package-path apps/macos`: **53 core + 7 AppKit tests passed**. Coverage includes decorated titles, alternate versions, anonymous signed queries, spaced fallback requests, legacy JSON, five-empty pauses, cooldown persistence and refusal across restart, rate-limit and malformed-response cursor retention, recovery preserving manual choices/skips, and cancellation while waiting for fallback. Six application-cleanup tests and shell syntax checks passed. No long-run provider stress test or catalog-wide accuracy claim is made. Earlier public Da Capo client verification ranked a relevant graduation-trip audio video first; it is not repeatedly queried during recovery validation.
- Mobile source changes remain local and are excluded from this Mac update. Per request, no further mobile checks or packaging are run. Earlier JS checks could not run because dependencies were absent; no mobile type/lint/device pass is claimed.
- Installation uses the existing persistent signing identity and the authorized feature-branch push followed by `update-local.sh --install-only`. Post-push packaging, installed-manifest comparison and obsolete-package cleanup are verified by that update procedure; the pre-push test run does not by itself establish installation success. Historical artifact hashes describe their earlier builds.

# @bbplayer/mobile

BBPlayer 移动端应用的主程序。

## 简介

此目录包含 BBPlayer 移动端应用的核心源代码。基于 React Native 和 Expo 构建，旨在提供从 Bilibili 同步音频并在本地流畅播放的体验。

## Android 本地调试

在仓库根目录执行：

```bash
mise -C apps/mobile run android
```

此命令为 prebuild 和运行阶段统一设置 `APP_VARIANT=development`，使用开发包名
`com.roitium.bbplayer.dev` 和 debug 签名，可以与正式版共存，数据各自独立。
单独启动 Metro 时使用 `mise -C apps/mobile run start`。
任务和环境变量统一定义在 `mise.toml`；原有 pnpm Android / Metro 命令仅转发到 mise。
在 `apps/mobile` 目录内执行时，可以省略 `-C apps/mobile`。

需要覆盖正式版并沿用其数据调试时，先在 `apps/mobile` 中执行 `eas credentials`，
选择生产 Android 凭据，使用下载到 `credentials.json` 的选项，同时保存对应 keystore。
`keystorePath` 相对于 `apps/mobile/credentials.json` 所在目录解析，也支持绝对路径。
凭据文件、`.jks` 和 `.keystore` 文件已被 Git 忽略，请勿提交。

```bash
mise -C apps/mobile run android:production-debug
# 如需单独重启 Metro：
mise -C apps/mobile run start:production-debug
```

该命令使用生产包名，仅将本地 debug 构建切换为生产签名，配置会在 clean prebuild
时重新生成。EAS 构建仍使用原来的签名流程。切换模式时先停止正在运行的 Metro。
覆盖安装还需要兼容的 `versionCode`；调试版本如果升级了数据库，旧正式版可能无法读取，
建议先使用应用的备份功能保留数据。

## EAS 构建和模拟器

在仓库根目录执行，`<version>` 为输出 APK 的文件名前缀：

```bash
mise -C apps/mobile run buildprod <version>
mise -C apps/mobile run builddev <version>
mise -C apps/mobile run buildpreview <version>
mise -C apps/mobile run emulator
```

构建产物保存在 `apps/mobile/temp-builds/`。这些任务沿用原来的 EAS profile 和签名流程。

## 区间循环提交与原生版本

试听只改变当前播放状态，SQLite 保留正式设置。保存和清除在同一个队列内读取旧设置、
应用原生正式设置、写入 SQLite，最后刷新缓存。原生拒绝时不写数据库；原生抛错或写库失败时，
恢复旧正式设置，并在所属编辑会话仍有效时恢复之前的试听。恢复也失败时保留草稿，
显示“未保存，播放状态恢复失败”并记录提交与恢复两次错误。缓存刷新失败只失效重查。

提交通过曲目和会话检查后，关闭编辑器或进入后台不会取消它。切歌后只保存原曲目的设置，
下一次播放再应用；旧完成回调不能关闭新编辑器或清除新草稿。SQLite 与原生存储没有跨存储事务，
进程中断后的冷启动和切歌入口从 SQLite 恢复正式设置。

曲目元数据可能使用整数秒，数据库允许 B 点不超过 `metadata.duration + 1`；
原生仍严格使用实际播放时长校验，不截断 B 点，也不增加容差。

新增原生区间循环接口要求重建 **2.7.1** 安装包。Android 与 iOS 保留 `appVersion` runtime 策略，
发布工具自动选择 `2.7.1`，显式 runtime 必须与应用版本相同。
先验证 preview 渠道，再发布相同 runtime 的生产更新；旧 `2.7.0` 安装包不能接收该 runtime 的更新。
本地修改和检查不会发布更新。

Worklets 补丁只跳过 `lintAnalyze*` 和 `lintVitalAnalyze*`，保留聚合及报告任务。
这是 K2 UAST 崩溃的临时规避；报告任务成功不代表恢复了被跳过的 Worklets 分析覆盖。

在仓库根目录运行协调层、弹窗与真实内存 SQLite 回归：

```bash
node --test apps/mobile/tests/ab-loop.test.mjs
pnpm type-check
pnpm lint
git diff --check
```

异步回归用可控返回验证保存／清除的拒绝、异常、补偿失败、关闭、后台、切歌、
新会话、迟到恢复与缓存失败。原生时长、冷启动恢复和安装包 runtime 还需 Android 设备验证；
iOS 构建与设备验收需单独进行，不能用 Windows 静态检查替代。

## 更多文档

所有的开发指南、架构说明以及最佳实践都位于仓库 GitHub Wiki 中： https://github.com/bbplayer-app/BBPlayer/wiki

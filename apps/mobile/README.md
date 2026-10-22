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

## 更多文档

所有的开发指南、架构说明以及最佳实践都位于仓库 GitHub Wiki 中： https://github.com/bbplayer-app/BBPlayer/wiki

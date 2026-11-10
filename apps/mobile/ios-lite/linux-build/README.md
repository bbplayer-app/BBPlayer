# 在 Linux 上构建 iOS 版

这组脚本用来在没有 Mac 的情况下构建 BBPlayer 的 iOS 版，并安装到自己的 iPhone 上。有 Mac 的话用 Xcode 更直接，不需要它们。

脚本用 [xtool](https://github.com/xtool-org/xtool) 提供 iOS SDK 和签名，在 Docker 里运行 CocoaPods 生成工程，再代替 xcodebuild 完成编译和打包。

目前在 Ubuntu 26.04（WSL2）和全新的 Ubuntu 24.04 上验证过，手机是 iOS 27 的 iPhone。

## 和完整版的区别

构建时设置了 `BBPLAYER_IOS_LITE=1`。Sentry、Firebase Analytics、`expo-updates`、`expo-observe`、`expo-app-metrics`、`react-native-release-profiler` 和 dev client 都被替换成空实现（见 `../stubs`）或排除在外，所以这个版本没有崩溃上报和热更新。

## 准备

- x86_64 的 Ubuntu（WSL2 也可以），至少 30 GB 空闲磁盘，4 GB 以上内存。
- Docker（当前用户要能直接运行 `docker`）、Node.js（22.13 以上的 22.x、24.3 以上的 24.x，或 26 及更新版本；不支持 25，Ubuntu 软件源里的版本也太旧）、pnpm、Python 3、git、curl、gpg、zip、unzip。
- Swift 需要的系统库。Ubuntu 24.04 上运行下面的命令，其他版本见 [Swift 的安装说明](https://www.swift.org/install/linux/)：

  ```bash
  sudo apt install binutils libc6-dev libcurl4-openssl-dev libedit2 libgcc-13-dev libncurses-dev libpython3-dev libsqlite3-0 libstdc++-13-dev libxml2-dev libzstd-dev pkg-config tzdata zlib1g-dev
  ```

- 从 [Apple 开发者网站](https://developer.apple.com/download/all/) 下载的 `Xcode.xip`，用来提取 iOS SDK。
- Apple ID。免费账号也可以，但装上的 App 7 天后会过期，到时重新安装即可。
- iPhone 打开开发者模式：设置 → 隐私与安全性 → 开发者模式。

## 第一次构建

只需要一条命令，在仓库根目录运行：

```bash
apps/mobile/ios-lite/linux-build/ios-build.sh
```

脚本会自己安装工具链和依赖、生成 iOS 工程、编译并安装到手机。生成工程和编译大约要 20 分钟，N100 这样的低功耗小主机要一个多小时，另外还要加上下载的时间。

第一次运行时，缺下面这几样脚本会停下来，告诉你该运行什么命令。做完后再运行一次同样的命令就行：

- iOS SDK：把上面下载的 `Xcode.xip` 装进 xtool。
- Apple ID：登录一次，需要输入两步验证码。
- iPhone：连接手机并信任这台电脑。WSL 还要在 Windows 上设置一次端口转发，见下面的“连接 iPhone”。

## 之后的构建

平时不管改了什么，都运行同一条命令。脚本会检查依赖和原生文件有没有变化，需要时自动重新生成 iOS 工程。

| 想做什么             | 运行                        |
| -------------------- | --------------------------- |
| 构建并安装           | `ios-build.sh`              |
| 只改了 JS，想快一点  | `ios-build.sh --no-native`  |
| 只打包，不安装到手机 | `ios-build.sh --no-install` |

工具链和构建产物默认放在 `~/.local/share/bbplayer-ios`，可以用环境变量 `BBPLAYER_IOS_HOME` 改位置。

## 连接 iPhone

原生 Linux：安装并启动 `usbmuxd`，用数据线连接手机，并在手机上信任这台电脑。

WSL2：用 usbipd 把手机直通进 WSL 时安装会失败，要改用 Windows 上的 Apple Mobile Device Service（装了 iTunes 或 Apple Devices 就有）。先在 WSL 里查网关地址：

```bash
ip route show default | awk '{print $3}'
```

然后在管理员 PowerShell 里运行，把 `<网关地址>` 换成上面的结果：

```powershell
netsh interface portproxy set v4tov4 listenaddress=<网关地址> listenport=27015 connectaddress=127.0.0.1 connectport=27015
New-NetFirewallRule -DisplayName "WSL usbmuxd" -Direction Inbound -InterfaceAlias "vEthernet (WSL (Hyper-V firewall))" -Protocol TCP -LocalPort 27015 -Action Allow
```

网关地址在电脑重启后可能变化，变了就重新运行第一条。

## 常见问题

- `pod install` 下载失败：脚本会自动重试五次。还失败就再运行一次 `ios-build.sh`，已下载的内容会保留。
- `xtool install` 报错或卡住：通常是临时问题，脚本会自动重试三次。还失败就运行 `ios-build.sh --no-native`。
- 打开 App 时提示需要开发者模式：在手机上打开开发者模式并重启。

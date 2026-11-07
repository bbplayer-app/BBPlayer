# 移动端 E2E

使用 [tester-army/e2e](https://github.com/tester-army/e2e) 和
`@e2e-dev/mobile` 测试已安装的 BBPlayer 原生应用。所有命令在仓库根目录运行。

## 环境与运行

- Node.js `^22.22.3` 或 `>=24.8.0`，使用仓库指定的 pnpm。
- Android：Android SDK、platform-tools 与已启动的模拟器。
- iOS：macOS、Xcode 与已启动的 iOS 模拟器。
- 在设备上安装包含 JS bundle 的独立构建，例如 release/preview 包。
  默认应用 ID 是 `com.roitium.bbplayer`。配置不会自动构建、安装或启动 Metro。

```bash
pnpm install
pnpm test:e2e:doctor
pnpm test:e2e:list
pnpm test:e2e                    # 默认 Android
pnpm test:e2e:ios                # iOS 需单独安装可运行的构建
```

选择指定设备或应用变体：

```bash
E2E_ANDROID_DEVICE=emulator-5554 E2E_ANDROID_APP_ID=com.roitium.bbplayer.preview pnpm test:e2e
E2E_IOS_DEVICE='iPhone 17' pnpm test:e2e:ios
pnpm exec e2e doctor --target ios
```

Android 应用 ID 与 `apps/mobile/app.config.ts` 一致：production 为
`com.roitium.bbplayer`，preview 为 `com.roitium.bbplayer.preview`，development 为
`com.roitium.bbplayer.dev`。iOS 当前固定为 `com.roitium.bbplayer`，可通过
`E2E_IOS_APP_ID` 覆盖。环境变量需由 shell 提供，不会自动加载 `.env`。

未指定设备时，框架自动选择可用设备；建议指定专用模拟器，避免选中其他设备。

## 冒烟测试

`smoke.e2e.ts` 检查启动、首次引导的游客入口、搜索页，以及「我的」标签页的设置入口。
重复运行时会跳过已完成的引导，不调用 `app.clearState()`，不清除歌单或退出登录。
测试不依赖 Bilibili 返回结果，也不需要 AI 密钥。

结果与失败证据在 `.e2e/`，已加入 Git 忽略。查看测试选择或仅运行单个文件：

```bash
pnpm test:e2e:list
pnpm test:e2e tests/mobile/smoke.e2e.ts
```

## 常规流程回归

`regular-flow.e2e.ts` 包含三个独立用例：

- 本地歌单：随机命名创建、改名、重启后重新查找、删除，并检查列表中不再存在。
  失败后也会尝试只清理本次创建的歌单。
- 搜索与播放：输入关键词、点击搜索建议、打开结果、检查播放进度推进、暂停时进度
  保持、恢复后继续推进，最后暂停播放。标记为 `online`，需要 Bilibili API 和音频
  CDN 可达；会改变搜索历史与当前播放队列，不更改登录信息或现有歌单。
- 设置：从「我的」进入设置与播放设置，检查内容后返回搜索首页，不修改设置值。

```bash
pnpm test:e2e tests/mobile/regular-flow.e2e.ts
# 仅测试无需 Bilibili 网络服务的部分
pnpm test:e2e tests/mobile/regular-flow.e2e.ts --exclude-tag online
# 可覆盖在线用例的搜索词
E2E_SEARCH_QUERY=Bilibili pnpm test:e2e tests/mobile/regular-flow.e2e.ts --tag online
```

使用包含最新测试定位标识的应用构建。已连接 Metro 的 Android 开发包可用：

```bash
E2E_ANDROID_DEVICE=emulator-5554 E2E_ANDROID_APP_ID=com.roitium.bbplayer.dev pnpm test:e2e
```

在同一模拟器上运行 e2e 前，释放 Argent 等工具占用的 Android UI 自动化服务，
避免 agent-device 的 snapshot helper 报解析失败。无需关闭 Metro 或模拟器。

## 开发构建与 AI 测试

`expo-dev-client` 构建需要先启动 Metro 并连接到应用，直接 `app.open()` 可能停在
开发启动器。当前配置以独立构建为基准。如要专门测试开发构建，请按随包文档
`node_modules/e2e/docs/mobile.mdx` 的 **Expo development builds** 配置启动参数、
`app.command`，Android 还需要使用 `device.openLink()` 打开开发客户端链接。

新增确定性测试可直接使用 `screen`、`expect` 和现有 `testID`。如需
`agent.act()` / `agent.assert()`，先按 `node_modules/e2e/docs/models.mdx` 为
`e2e.config.ts` 添加 `agents.default`，选择模型与认证方式；当前未绑定模型服务。

## 定位约定

操作优先使用 `screen.getByTestId()`；新增可交互入口时同步提供稳定、描述用途的
`testID`。文案使用 `toHaveText()` 等断言验证，不作为常规按钮或输入框的定位依据。
播放按钮按状态暴露 `player-play` / `player-pause`，以等待实际状态切换。
通用 `Button` 的文字提供 `${testID}-label`；弹窗确认等操作定位该文字，避免
点击到触摸容器中不响应的区域。标签切换后也检查选中状态。

例外：`@expo/ui/community/menu` 的原生菜单项不支持逐项 `testID`，当前保留
「新建播放列表」「编辑播放列表信息」「删除播放列表」的精确文本定位。
随机创建的歌单通过行 `testID` 与本次随机名称筛选，避免误操作已有数据。

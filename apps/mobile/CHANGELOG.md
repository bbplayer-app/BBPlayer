# Changelog

项目的所有显著更改都将记录在这个文件中。

项目的 CHANGELOG 格式符合 [Keep a Changelog]，
且版本号遵循 [Semantic Versioning]。 ~~(然而，事实上遵循的是 [Pride Versioning])~~

## [2.5.2] - 2025-05-25

### Added

- 主页清爽模式

### Changed

- 将部分 ExpoUI TextField 回滚为 RNPaper TextField
- 优化播放列表与分享页面操作按钮样式，使其背景和图标颜色根据封面动态提取的主题色自动计算匹配，增强视觉一致性与美观度。
- 优化设置页面排序，添加许可证页面搜索及动画（支持 useTransition），重新设计手机号与二维码登录界面为美观的原生页面，并将分步组件重构迁移至 Bilibili 账号设置目录下的局部组件。
- 将 `bilibiliApi` 与 `bilibiliApiClient` 及其所有调用处的参数由位置参数重构为对象参数

### Fixed

- 修复因 `expo-media-library` 重构而不再导出 `MediaLibrary.PermissionStatus` 导致的 TypeScript 编译报错问题，替换为直接从 `expo` 导入并使用 `PermissionStatus`。
- orpheus: 修复 `selectDirectory` 在部分设备上因 Android 框架竞态条件导致的 NullPointerException 崩溃。
- 播放器页面标题点击后直接展开/收起完整标题。
- 优化设置首页底部滚动空间和透明渐变遮罩。
- Bilibili 扫码登录和手机号登录改为独立页面。
- 歌词编辑弹窗新增清除歌词按钮，可标记当前歌曲跳过歌词并隐藏歌词显示。
- 评论区支持把 Bilibili 表情占位符渲染为对应图片。
- 设置页移除底部关于信息。
- 将 Bilibili 账号管理从通用设置拆出为独立页面，首页头像现在会进入该页面。
- Bilibili 相关 React Query 请求现在会把 `AbortSignal` 传递到底层 API 请求。
- 播放器页面歌曲标题过长时改为单行截断，避免挤占下方控制区域。
- 音乐库播放列表搜索框恢复使用 React Native Paper 实现。
- 修复从云端恢复或拉取共享歌单时，同名本地歌单会导致播放列表重复报错的问题。

## [2.5.1] - 2026-05-22

### Changed

- 将 update-publisher 中的默认编辑器由 VS Code 修改为 Zed

### Fixed

- 修复在 ComposeView attach 之前就 measure 导致的崩溃问题

## [2.5.0] - 2026-05-22

### Changed

- 优化热力图组件 WeeklyHeatMap，使其左侧星期几固定显示，不再随水平滑动而移动
- 使用 react-native-boost 对部分 View、Text 组件加速
- 关闭 r8 混淆并从构建工作流中移除上传 mapping 的步骤
- 将大量组件替换为 ExpoUI 原生组件
- 废弃并关闭弹幕功能，移除设置入口
- 重构播放器进度条
- 升级 react-native-tab-view，样式更新

### Added

- 搜索页面集成 up 主搜索
- 修改歌曲封面
- 魅族状态栏歌词

### Fixed

- 优化歌单列表的背景颜色提取算法
- 优化外部歌单导入功能，支持保存进度
- 优化组件，提高 React Compiler 编译通过率
- 共享歌单无法使用
- 设置页面按钮闪烁

## [2.4.5] - 2026-05-09

### Changed

- Orpheus: 优化歌词系统架构

### Added

- 支持车载歌词（Android：通过把当前歌词写入 MediaMetadata.title，在蓝牙 AVRCP 车机上显示）
- 支持自动下载新版并安装

### Fixed

- 修复因为开发者脑子进水导致的又一次无法上传播放记录的问题

## [2.4.4] - 2026-04-18

### Fixed

- 修复随机播放功能开销过大导致卡死的问题
- 修复离线模式下播放器进入错误状态后无法改出的问题
- 移除预加载歌词功能
- 修复部分手机阉割了 SAF 框架导致无法选择导出目录的问题（默认导出到 Music/BBPlayer）
- 修复上报播放记录到 b 站功能不可用的问题
- 支持在下载页面播放歌曲
- 修复最近播放页面点击歌曲无法播放的问题
- 修复从外部播放列表同步时无法恢复的问题

### Changed

- 把 player 相关监听器注册统一封装到 PlayerSideEffects 中
- Orpheus: 不再在主线程上运行所有异步函数，只把 player 调用部分放在主线程

## [2.4.3]

### Added

- 主页面集成播放历史热力图（GitHub 风格），展示每日播放统计
- 完全重构主页
- 桌面歌词坐标记忆功能（Y 坐标持久化）
- 歌词预加载下一首功能，提升切歌体验
- 歌单合并功能，支持多选本地歌单并去重合并
- 桌面/状态栏歌词在歌词修改或偏移调整时自动同步更新
- 桌面歌词面板新增「清空歌词」快捷按钮，点击后跳过该曲目的歌词自动获取，并在应用内显示提示；用户可随时通过手动搜索或编辑歌词来重新启用
- 无歌词（包括已跳过/未找到）时，自动隐藏桌面歌词面板和状态栏歌词，而非显示空白
- orpheus：重构随机播放模式，开启时直接将播放队列替换为随机后的顺序（当前歌曲置顶），播完一轮后自动重新打乱

### Changed

- 播放器主页标题平滑渐变效果重构为独立 Hook，实现 UI 与动画逻辑解耦
- 重构手机登录模块，采用自定义 Hook (`usePhoneLogin`) 与分步组件化架构，大幅简化状态逻辑并提升可维护性
- 新增 `useGeetest` Hook：将极验验证与发送验证码逻辑独立，实现验证逻辑的解耦与复用
- 模块化 `PlaylistSyncWorker`，解耦复杂的同步逻辑与 API 请求处理
- 为 `lyricService`、`lottie` 及 `crypto` 中的 `JSON.parse` 调用增加安全处理，防止非法数据导致崩溃
- 清理项目内多处未使用的导入及变量，优化代码体积

## [2.4.2] - 2026-03-12

### Added

- 支持 Lyricon 作为状态栏歌词后端
- 支持桌面歌词显示罗马音/翻译、逐字歌词

## [2.4.1] - 2026-03-01

### Changed

- 歌单支持同名，不再进行同名判断

### Added

- 歌单共享、协同编辑功能
- 状态栏歌词
- 导出歌曲

## [2.3.2] - 2023-02-25

### Added

- 为设置页面的所有子页面增加 NowPlayingBar
- 支持显示本地歌单播放完成所需的总时长
- orpheus：支持歌曲封面与音频同步下载及清理，支持补齐缺失封面，提升无网播放体验
- orpheus：引入全局图片本地缓存机制（基于 Glide 默认 LRU 策略，上限默认 250MB）
- 优化无网状态下的本地播放列表显示逻辑，高亮已下载和自动缓存的歌曲
- 本地播放列表支持拖拽排序：在多选模式下长按右侧拖拽手柄即可拖动曲目，自动滚动，松手后持久化新顺序

### Changed

- 播放器主页的主控制按钮替换为 Lottie 动画，并支持乐观更新状态
- 本地播放列表排序从整数 `order` 迁移至 Fractional Indexing（字符串键），排序时只更新单行，无需全量位移；旧数据启动时自动迁移
- orpheus：优化媒体通知的构建逻辑，优先加载本地已下载的封面图片
- orpheus：优化播放器生命周期，在实例被销毁后重新点击播放时自动触发重建
- 重构弹幕加载逻辑，避免无网或弱网状态下无限加载
- 优化歌词加载策略：无网络且无本地缓存时直接返回未找到，不再发起无效网络请求
- 替换 Material 3 动态颜色获取方案，由 `@pchmn/expo-material3-theme` 迁移至 Expo Router 内置的 `Color` API
- 优化 Sentry 异常上报规则，屏蔽播放器非关键性错误（如 Bilibili API 异常或常规网络错误）
- 替换 `react-native-paper` 按钮组件的底层实现为 RNGH 组件，提升交互性能
- 调整 protobuf 编译流程，将生成脚本移至 `prepare` 阶段，实现依赖安装时自动生成 `dm.js` 与 `dm.d.ts`
- 恢复播放器页面的滑动交互样式
- 重构歌词页面，底层使用 ScrollView 以提升滚动表现
- 重构首页用户信息的展示逻辑
- 重构设置页面路由结构，将其作为独立 stack 页面

### Fixed

- 修复本地播放列表在分页未加载完成时，将歌曲拖拽到当前列表底部会导致其被移动到全列表底部的问题
- 修复播放器主控件 Lottie 图标 `colorFilters` 不生效（始终显示红色）的问题，根本原因是 JSON 文件中 Stroke 图层颜色硬编码为红色且 lottie-react-native 对 Stroke 图层的 colorFilters 支持有限，已将三个 Lottie JSON 的 Stroke 颜色改为白色以使主题色正确叠加
- 修复应用启动后断网导致本地播放列表和数据触发无限加载的问题
- orpheus：修复桌面歌词锁定后重启应用，导致歌词无法移动且阻挡底层点击操作的问题
- 修复 `b23.tv` 短链接解析失败的问题（调整为从 HTML 响应中提取目标链接）
- 修复在开启系统三键导航的设备上，播放器底部控件可能与系统导航栏重叠的问题
- 修复获取网易云音乐歌单时，因 `playlist` 或 `creator` 等字段缺失引起的闪退
- 修复连续点击导致的分享失败问题，并补充了分享按钮的加载状态反馈
- orpheus：修复播放器因数据 (`data`) 为空时引发的解析异常
- 修复播放器页面底部偶现的异常白块问题
- 修复无网状态下，频繁弹出网络报错提示的问题
- orpheus：修复桌面歌词拖拽边界判定失效的问题，防止歌词被拖入状态栏区域导致无法触达
- orpheus：修复 `onDestroy` 方法在非预期线程执行的问题

## [2.3.0] - 2026-02-07

### Added

- 基于 `react-native-gesture-handler` 封装了 `Button` 组件，样式与 `react-native-paper` 保持一致
- 支持酷狗音乐歌词搜索
- 集成 Firebase Analytics
- 支持从 QQ 音乐 / 网易云音乐导入歌单并匹配 B 站视频
- 为关键 UI 组件添加 `testID` 以支持 Maestro E2E 测试
- 懒加载模态框加载时显示 `ActivityIndicator`
- 支持双击播放列表顶部回到顶端
- 实现播放器页面标题平滑渐变效果
- 播放列表页面背景支持封面主题色
- 支持下滑关闭播放器页面
- 支持网易云罗马音及逐字歌词，并支持在翻译与罗马音间切换
- 增加歌词编辑格式校验及行号错误提示
- 支持在播放器页面显示弹幕

### Changed

- 优化数据库迁移检查，通过缓存 Schema 版本跳过冗余 SQL 查询
- 移除 trackService 中的标题重复检查
- 播放器网络库（orpheus）从 Cronet 切换至 OkHttp
- 启用 R8 混淆并移除 reanimated 的 Static Flags
- 重构 RootLayout 的 SplashScreen 显示逻辑
- 增强播放器后台留存能力
- 重构 `PlayerLyrics.tsx`，实现歌词偏移面板与解析逻辑解耦
- 优化 `KaraokeWord` 组件性能，仅在当前行监听播放时间以减少冗余渲染
- 优化频谱在暂停时的回落动画
- 将 `eslint-plugin-modal` 移出 `apps/mobile` 并作为一个单独的包 `@bbplayer/eslint-plugin` 放在 `packages` 目录下
- 将所有 `@roitium` 作用域的包迁移至 `@bbplayer` 作用域
- 更新文档和 README，补充逐字歌词和歌词罗马音的功能说明
- 重构设置页面，将歌词相关设置移动到独立的「歌词」分类中

### Fixed

- 修复单曲循环模式下播放完最后一首不循环的问题 (Thanks to @k88936 #199)
- 修复 `reportErrorToSentry` 上报非 Error 类型错误时显示为 `[object Object]` 的问题
- 修复 `DonationQRModal` 在部分 Android 设备上因导入方式错误导致的崩溃
- 修复歌词搜索失败时错误上报 `FileSystemError` 到 Sentry 的问题
- 修复 `ToastContext` 未初始化导致的应用崩溃
- 修复因 Cookie 键名包含无效字符（如换行符）导致的崩溃，并增加自动修复提示
- 修复播放列表结束后点击播放按钮无效的问题，现会从头开始播放
- 修复 `external-sync` 和 `useExternalPlaylistSyncStore` 中的 React Compiler 优化跳过问题
- 优化播放列表在屏幕较窄时的布局显示
- 修复播放队列模态框中使用 `RectButton` 无法点击的问题，并移除删除按钮的涟漪效果
- 修复播放器页面在部分小屏设备上无法滚动的问题
- 优化播放器页面在小屏设备上的显示，支持滚动查看完整内容

## [2.2.4] - 2026-01-30

### Added

- 显示频谱功能

### Changed

- 改为 monorepo
- 将 TypeScript 及相关依赖统一管理到 root package.json
- 使用 `@nandorojo/galeria` 替代 `react-native-awesome-gallery`
- 使用 `react-native-fast-squircle` 替换主要 UI 元素的圆角矩形为 squircle
- 统一列表项的设计风格（尺寸、圆角）
- 将 `apps/bbplayer` 重命名为 `apps/mobile`

### Fixed

- 修复搜索播放列表时，错误地过滤了远程播放列表的问题
- 修复播放器页面 ANR 问题

## [2.2.3] - 2026-01-28

### Added

- 集成 commitlint 和 lefthook 以规范 commit 信息
- 同步本地歌单到 b 站收藏夹（不稳定，容易被风控）
- 收藏夹同步现在会显示详细的进度模态框
- 对 IOS 进行基础的适配
- 使用 useDeferredValue 优化本地播放列表、本地歌单详情页和首页搜索的输入响应速度
- 使用 useTransition 优化音乐库 Tab 切换体验，减少卡顿感
- 重构播放器 Hooks，使用全局 Zustand Store 管理播放状态，减少 JS 与 Native 之间的通信开销

### Changed

- 重构 `RemoteTrackList` 和 `LocalTrackList` 组件的 Props，将选择相关状态合并为 `selection` 对象，并直接继承 `FlashList` 的 Props以获得更好的灵活性
- 使用 react-native-keyboard-controller 的 API 重构 AnimatedModalOverlay
- 重构 `src/lib/api/bilibili/api.ts` 为 Class
- 修复冷启动时 Deep Link 无法跳转的问题
- 创建/修改歌曲或播放列表时，禁止使用重复的名称
- 将 `app.bbplayer.roitium.com` 作为 Deep Link 的 host
- 关闭 dolby / hires 音源
- 启用 reanimated 的 Static Flags：`ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`、`IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS`、`USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS`

## [2.2.2] - 2026-01-25

### Changed

- 重构分享卡片组件，优化预览生成逻辑，并支持带有分 P 参数的分享链接
- 支持播放器页面显示缓冲进度
- 升级到 expo55-beta
- 优化 version code 逻辑，使用 commit 数量作为 version code
- 增加 nightly 构建
- 切换到 sonner-native
- 升级 expo-image-theme-colors 依赖到 0.2.1，支持传入图片 url 提取封面色
- 升级 expo-orpheus 到 0.9.4，支持断开蓝牙时暂停播放

### Added

- prevent progress bar regression & add debounce to PlayButton (Thanks to @longlin10086 #153)
- fix: update PlaySlide info after song's change (Thanks to @longlin10086 #159)
- feat: add PlayControls overlay to LyricPage (Thanks to @longlin10086 #164)

## [2.2.0] - 2026-01-23

### Changed

- 升级依赖

### Added

- 添加本地播放列表搜索功能
- 为播放列表模态框增加遮罩（Thanks to @longlin10086 #146）
- 支持跳转到分 p 视频播放列表时滚动并高亮指定分 p
- 支持分享歌曲、歌词卡片
- 使用 TrueSheet 替换 @gorhom/bottom-sheet
- 部分下拉菜单重构为 bottom sheet 样式，更清晰

## [2.1.9] - 2026-01-22

### Fixed

- BBPLAYER-5N

### Changed

- ci 增加构建 armabi-v7a、x86、x86_64 的工作流
- 使用 React.lazy() 动态导入模态组件并用 Suspense 边界包装渲染

### Added

- 为 Playlist 和 Library 页面增加 Skeleton
- 支持 qq 音乐作为歌词源
- 搜索时高亮搜索结果中的关键字
- 支持播放器页面播放速度调整
- 支持将播放队列保存为播放列表

## [2.1.8] - 2026-01-13

### Added

- 重新设计播放器进度条
- 增加~~讨口子~~捐赠页面
- 桌面歌词
- 通知栏增加切换循环模式按钮
- 尝试启用 dolby / hires 音源

### Changed

- 移除了未使用的依赖

### Fixed

- 修复登录二维码可能为空导致的报错
- 修复部分 bilibili api 返回 data 为 null 导致的报错

## [2.1.6] - 2026-01-06

### Fixed

- 再次尝试修复播放器页面卡顿问题（😭）
- 尝试修复 `cannot use a recycled source in createBitmap` 错误（expo-orpheus@0.7.2）(然而问题依然存在)

### Added

- 新增启动时自动播放功能
- 重构设置页面，增加二级目录，更简洁
- 评论区功能

### Changed

- 升级了 expo 相关依赖库版本

## [2.1.5] - 2025-12-31

### Fixed

- remove unexpected white space above bottom tabs (Thanks to @imoyy #107)
- 修复歌曲播放完成后点击播放，无法重新播放的问题

### Added

- 增加 NowPlayingBar 底部沉浸样式 (Thanks to @imoyy #110)
- 增加 NowPlayingBar 滑动手势操作 (Thanks to @imoyy #110)
- 支持边下边播缓存

## [2.1.4] - 2025-12-20

### Added

- 切换到 Orpheus 音频库，取代 RNTP

### Fixed

- 尝试修复播放器页面卡顿的问题

## [1.4.3] - 2025-12-01

### Added

- 支持实验性响度均衡（默认不启用）
- 支持在软件启动时恢复上次播放进度（默认不启用）

### Fixed

- **Refactored `PhoneLoginModal`** into a modular, hook-based architecture.
- **`usePhoneLogin` FSM Refactor**: Further refined the login hook by implementing a **Finite State Machine (FSM)** using `useReducer`. This consolidated scattered state variables (like `isSendingCode`, `isLoggingIn`, and various error strings) into a single, predictable state object, reducing potential bugs from invalid state combinations.
- **Refined with FSM**: Implemented a **Finite State Machine (FSM)** using `useReducer` within the hook to consolidate many `isXXX` and `xxError` variables into a single, predictable state object.
- **`useGeetest` Hook Extraction**: Extracted the Geetest captcha parsing and SMS sending logic into a dedicated `useGeetest` hook. This further modularizes the authentication flow and makes the captcha logic reusable for other potential entry points.
- Splitting the UI into modular step components: `InputPhoneStep`, `GeetestVerifyStep`, `InputCodeStep`, and `SuccessStep`.
- **Decoupled database and store initialization** in `db.ts` to prevent startup race conditions.
- 修复 `DatabaseLauncher has already started. Create a new instance in order to launch a new version.` 错误

## [1.4.2] - 2025-11-09

### Added

- 完善「稍后再看」页面功能
- 支持多种播放器背景风格——渐变、流光、默认 md3 固定背景
- 支持在「开发者页面」设置热更新渠道
- 增加了一些 Sentry Spans 埋点，试图提高项目可观测性

### Changed

- 优化歌词页面

### Fixed

- 修复合集 ps 过大，导致 api 返回数据错误的问题
- 修复 Cover Placeholder 乱码问题
- 不再尝试使用 dolby/hi-res 音源，避免 `android-failed-runtime-check` 错误

## [1.4.0] - 2025-11-02

### Added

- 清除所有歌词缓存（在「开发者页面」）
- 基于 B 站视频 bgm 识别结果精准搜索歌词
- 切换到 expo-router
- 改进了歌词页面与交互逻辑（灵感来自 Salt Player + Spotify，给前辈们磕头了咚咚咚）
- 可通过播放器页的下拉菜单跳转视频详情页
- 将 B 站「稍后再看」作为播放列表（置顶在「播放列表」页面）

### Fixed

- 一些减少 rerender 次数的优化
- 使用 [react-native-paper/4807](https://github.com/callstack/react-native-paper/issues/4807) 中提到的 Menu 组件修复方法，移除 patch

## [1.3.6] - 2025-10-26

### Added

- 给视频/播放列表封面加了个渐变 placeholder
- 本地播放列表使用基于游标的无限滚动
- 定时关闭功能
- 点击通知可跳转到下载页面

### Fixed

- 对 NowPlayingBar 的 ProgressBar 的颜色和位置进行一点修复，更符合直觉
- 直接在 Sentry.init 中忽略 ExpoHaptics 的错误
- 这次真的修复了模态框错位的问题（确信）

## [1.3.5] - 2025-10-26

### Fixed

- 因图片缓存在内存导致的 OOM
- 部分用户手机不支持振动反馈
- 合集/分 p 同步时与原始顺序不一致
- 修复在导航未初始化完成前尝试打开更新模态框

### Added

- 播放排行榜页面支持点击直接播放，且支持无限滚动查看所有播放记录

### Changed

- 增加了 issue 模板
- 支持构建 preview 版本，并分离了不同版本的包名
- 删除了 gemini-cli 的 workflow

## [1.3.4] - 2025-10-15

### Fixed

- 修复 App Linking 不生效的问题

## [1.3.3] - 2025-10-15

### Added

- 手动检查更新
- 增加 `CHANGELOG.md` 文件

### Changed

- 将所有源代码移入 `src` 目录
- `update.json` 中增加一个 `listed_notes` 字段，用于更清晰展示更新日志

### Fixed

- 修复了强制更新不生效的问题

## [1.3.2] - 2025-10-14

### Added

- 为一部分交互添加了触觉反馈

### Changed

- 修改一部分组件使其符合 React Compiler 规范
- 升级了一些依赖包
- 移除了页面加载时强制显示的 ActivityIndicator

### Fixed

- 修复了更新音频流时抛出的 BilibiliApiError 会被错误上报的问题

<!-- Links -->

[keep a changelog]: https://keepachangelog.com/en/1.0.0/
[semantic versioning]: https://semver.org/spec/v2.0.0.html
[pride versioning]: https://pridever.org/

<!-- Versions -->

[unreleased]: https://github.com/bbplayer-app/BBPlayer/compare/v2.5.2...HEAD
[1.3.2]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.1...v1.3.2
[1.3.3]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.2...v1.3.3
[1.3.4]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.3...v1.3.4
[1.3.5]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.4...v1.3.5
[1.3.6]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.5...v1.3.6
[1.4.0]: https://github.com/bbplayer-app/BBPlayer/compare/v1.3.6...v1.4.0
[1.4.2]: https://github.com/bbplayer-app/BBPlayer/compare/v1.4.0...v1.4.2
[1.4.3]: https://github.com/bbplayer-app/BBPlayer/compare/v1.4.2...v1.4.3
[2.1.4]: https://github.com/bbplayer-app/BBPlayer/compare/v1.4.3...v2.1.4
[2.1.5]: https://github.com/bbplayer-app/BBPlayer/compare/v2.1.4...v2.1.5
[2.1.6]: https://github.com/bbplayer-app/BBPlayer/compare/v2.1.5...v2.1.6
[2.1.8]: https://github.com/bbplayer-app/BBPlayer/compare/v2.1.6...v2.1.8
[2.1.9]: https://github.com/bbplayer-app/BBPlayer/compare/v2.1.8...v2.1.9
[2.2.0]: https://github.com/bbplayer-app/BBPlayer/compare/v2.1.9...v2.2.0
[2.2.2]: https://github.com/bbplayer-app/BBPlayer/compare/v2.2.0...v2.2.2
[2.2.3]: https://github.com/bbplayer-app/BBPlayer/compare/v2.2.2...v2.2.3
[2.2.4]: https://github.com/bbplayer-app/BBPlayer/compare/v2.2.3...v2.2.4
[2.3.0]: https://github.com/bbplayer-app/BBPlayer/compare/v2.2.4...v2.3.0
[2.3.2]: https://github.com/bbplayer-app/BBPlayer/compare/v2.3.0...v2.3.2
[2.4.1]: https://github.com/bbplayer-app/BBPlayer/compare/v2.3.2...v2.4.1
[2.4.2]: https://github.com/bbplayer-app/BBPlayer/compare/v2.4.1...v2.4.2
[2.4.4]: https://github.com/bbplayer-app/BBPlayer/compare/v2.4.1...v2.4.4
[2.5.0]: https://github.com/bbplayer-app/BBPlayer/compare/v2.4.6...v2.5.0
[2.5.2]: https://github.com/bbplayer-app/BBPlayer/compare/v2.5.1...v2.5.2

# iOS 播放逻辑测试

这里的测试在 Linux 上运行 `../ios` 里真实的 `OrpheusPlayerManager`、`OrpheusQueueManager` 和 `GeneralStorage`，检查队列、切歌、暂停、失败重试和听歌记录这些状态逻辑。不需要 Mac，也不需要设备。

```bash
packages/orpheus/ios-tests/run.sh
```

脚本需要一个 Linux 版的 Swift 编译器。可以用环境变量 `SWIFTC` 指定；不指定时使用 Linux iOS 构建（`apps/mobile/ios-lite/linux-build`）安装的工具链，再找不到就用 `PATH` 里的 `swiftc`。全部通过时退出码为 0。

要对比另一份源码（比如改动前的版本），把它所在的目录作为参数传给脚本。

## 文件

- `main.swift`：测试用例。
- `Mocks.swift`：AVFoundation、MediaPlayer、UIKit、MMKV 以及 `BilibiliApi` 等相邻类的替身。
- `Placeholder.swift`：源码按名字 `import` 苹果的框架，脚本用它给每个名字编译一个空模块。
- `run.sh`：编译并运行。

## 测试能说明什么

替身播放器只记录管理器对它的调用，状态由测试脚本推动。模拟的 B 站接口会把每次取链接的请求留住，直到测试给出回应，所以测试可以控制“链接还没回来”这段时间里发生什么。

它验证的是管理器的逻辑，不是 AVPlayer 的实际表现：缓冲、后台挂起、系统中断的时序这些仍然要在真机上测。

## 限制

- Linux 没有 Objective-C 运行时。`run.sh` 用 sed 去掉 `OrpheusPlayerManager.swift` 里的 `@objc`，并把 `#selector(...)` 换成字符串；通知由测试直接调用对应的处理方法来投递。
- 链接是否超过 10 分钟（过期后重新取链接的条件）读的是真实时钟，这里测不到。
- 下载管理器依赖后台 `URLSession`，不在测试范围内。

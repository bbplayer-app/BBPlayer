# BBPlayer-macOS

Gino（GitHub：`ginolyu3360-code`）的个人自用 macOS 音乐播放器项目。

- GitHub 仓库：[ginolyu3360-code/BBPlayer-macOS](https://github.com/ginolyu3360-code/BBPlayer-macOS)
- 本地开发目录：`/Users/lvjunhao/Documents/GitHub/BBPlayer-macOS`
- 原生应用代码、构建和使用说明：[apps/macos/README.md](apps/macos/README.md)
- 实现与后续需求记录：[apps/macos/IMPLEMENTATION.md](apps/macos/IMPLEMENTATION.md)
- 验证结果及已知限制：[apps/macos/VALIDATION.md](apps/macos/VALIDATION.md)

## 开发方式

在此仓库根目录执行：

```sh
swift test --package-path apps/macos
apps/macos/scripts/build-app.sh release
```

生成的应用位于 `apps/macos/build/BBPlayer.app`。此项目采用本机构建；GitHub Actions 自动化停用。

## 仓库边界

唯一 Git 远程连接为 `origin`，只指向 `https://github.com/ginolyu3360-code/BBPlayer-macOS.git`。开发和 push 只在这个账号和仓库进行。

`bbplayer-app/BBPlayer` 是 GitHub 显示的 fork 来源，仅用于说明文件与项目思路来源，不作为开发、同步或发布对象。不得向 `bbplayer-app/BBPlayer` push、发起或重开 PR、合并、评论或请求审查。保留已有许可证、来源说明和历史。

仓库中保留的手机端、后端等目录属于继承的源文件，不参与本项目的 macOS 构建或发布。

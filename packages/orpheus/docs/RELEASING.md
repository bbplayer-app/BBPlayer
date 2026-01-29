# 发版指南 (Releasing)

本项目使用 `release-it` 配合 Conventional Commits 进行自动化发版。

## 准备工作

1. 确保你的代码已提交并推送到远程分支。
2. 确保你有 `npm` 发布权限 (需 `npm login`)。
3. 建议配置 `GITHUB_TOKEN` 环境变量以支持自动创建 GitHub Release。

## 发版流程

在项目根目录运行：

```bash
npm run release
```

该命令会自动执行以下步骤：

1. **版本升级**: 根据 commit message (feat/fix/breaking) 自动计算下一个版本号 (SemVer)。
2. **Changelog**: 生成/更新 `CHANGELOG.md`。
3. **Git**: 创建 git tag 并提交。
4. **Publish**: 发布到 NPM。
5. **GitHub**: 创建 GitHub Release (包含 Changelog)。

## 提交规范

请务必遵守 Conventional Commits 规范，否则 `commitlint` 会拦截提交，且无法生成正确的 Changelog。

- `feat: ...` -> Minor 版本 (0.1.0 -> 0.2.0)
- `fix: ...` -> Patch 版本 (0.1.0 -> 0.1.1)
- `chore: ...` -> 不触发版本更新 (除非手动指定)
- `BREAKING CHANGE: ...` -> Major 版本 (0.1.0 -> 1.0.0)

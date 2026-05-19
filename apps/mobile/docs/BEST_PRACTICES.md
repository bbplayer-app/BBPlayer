# 开发规范与最佳实践

## 🎨 UI 开发规范

### LegendList 性能优化

项目中大量使用了 `LegendList` 进行列表渲染。为了保证滚动性能，请严格遵守以下规范：

1.  **keyExtractor 必填**: 数据会变化的列表必须提供稳定且唯一的 `keyExtractor`，不要用会随排序变化的 index 作为 key。
2.  **renderItem 静态化**: `renderItem` 函数必须定义在组件外部，依赖的外部状态统一通过 `extraData` 传入，避免在组件内用闭包创建 render 函数。
3.  **extraData memo 化**: 传给 LegendList 的 `extraData` 必须使用 `useMemo`，不要传 inline object。
4.  **尺寸估算**: 固定高度行使用 `getFixedItemSize`，高度大致一致的列表使用 `estimatedItemSize`。高度很动态且默认表现足够好时可以不设置。
5.  **谨慎回收**: 只有 item 没有本地状态，或已经用 Legend List recycling hooks 处理状态重置时，才启用 `recycleItems`。

## 📝 代码风格

- **Oxfmt**: 项目配置了 Oxfmt，请确保编辑器开启了保存自动格式化。
- **Oxlint/ESLint**: 提交前请修复所有的 lint 警告。
- **组件命名**: 使用帕斯卡命名法 (PascalCase)，如 `MyComponent.tsx`。
- **Hook 命名**: 使用 `use` 前缀，如 `usePlayerState.ts`。

## 🪵 日志规范

- **Service/Facade 层**: 关键业务路径应记录日志。
- **Error Handling**: 捕获到错误时，应记录错误堆栈。
- **Debug**: 开发环境下的调试日志请使用 `console.debug`，生产环境构建会自动移除。

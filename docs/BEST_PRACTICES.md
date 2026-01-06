# 开发规范与最佳实践

## 🎨 UI 开发规范

### FlashList 性能优化

项目中大量使用了 `FlashList` 进行列表渲染。为了保证滚动性能，请严格遵守以下规范：

1.  **renderItem 定义**: `renderItem` 函数**必须**在组件函数外部定义，或者是使用 `useCallback` 记忆化的稳定函数。
2.  **extraData 使用**: 所有 `renderItem` 依赖的外部变量（除了 `item` 本身），都必须放入 `extraData` 属性中。
3.  **Memoization**: `extraData` 对象必须使用 `useMemo` 包裹，避免因引用变化导致不必要的重渲染。

```tsx
// ✅ 推荐做法
const renderItem = useCallback(({ item }) => <MyComponent item={item} />, [])

const extraData = useMemo(
	() => ({
		theme: currentTheme,
		selection: currentSelection,
	}),
	[currentTheme, currentSelection],
)

return (
	<FlashList
		data={data}
		renderItem={renderItem}
		extraData={extraData}
	/>
)
```

## 📝 代码风格

- **Prettier**: 项目配置了 Prettier，请确保编辑器开启了保存自动格式化。
- **ESLint**: 提交前请修复所有的 ESLint 警告。
- **组件命名**: 使用帕斯卡命名法 (PascalCase)，如 `MyComponent.tsx`。
- **Hook 命名**: 使用 `use` 前缀，如 `usePlayerState.ts`。

## 🪵 日志规范

- **Service/Facade 层**: 关键业务路径应记录日志。
- **Error Handling**: 捕获到错误时，应记录错误堆栈。
- **Debug**: 开发环境下的调试日志请使用 `console.debug`，生产环境构建会自动移除。

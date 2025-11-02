## 开发规范（及一些 tips）

### UI 开发

- FlashList 使用到的所有 renderItem 应该在函数外定义，并把所有除了 item 之外的依赖放入 extraData 中，并使用 useMemo 包裹 extraData

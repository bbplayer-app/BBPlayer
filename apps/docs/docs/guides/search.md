---
title: 搜索
editLink: true
---

# 搜索

## 搜索框

打开软件，便可以看到 BBPlayer 的搜索框。它被设计为支持识别多种链接、规则的聚合搜索器，具体来说，他支持以下这几种类型：

1. `BV1GJ411x7h7` 或 `AV114514`：直接跳转到视频详情页

2. 短链接（b23.tv/xxxxxx）：会在解析后根据实际链接动态跳转（会自动删除链接前后的无关文字，所以你可以把从 BiliBili 复制的分享文本直接粘贴过来）

3. `https://space.bilibili.com/`：会根据后面跟随的参数不同动态决定
   - 如果链接包含`ctype=21`, 则跳转到**合集页**（e.g. `https://space.bilibili.com/114514/favlist?fid=1919810&ctype=21`）
   - 如果链接包含`ctype=11` 或不含`ctype`，则跳转到**收藏夹页**（e.g. `https://space.bilibili.com/114514/favlist?fid=1919810`）
   - 如果链接包含`/lists/<id>`，则跳转到**合集页**（e.g. `https://space.bilibili.com/114514/lists/1919810`）
   - 如果什么都不包含，则跳转到用户主页（e.g. `https://space.bilibili.com/114514`）

4. 如果什么都没解析到，就作为关键词搜索

看不懂没关系！只需要知道你所复制的大部分链接都可以直接扔到搜索框里，而 BBPlayer 会尽力猜你想访问什么！（其实是我在猜...😇）

## Bilibili 移动端分享

在 Bilibili 移动端上，你可以点击视频的分享按钮，在弹出菜单中右滑到底点击「更多」，选择「分享到 BBPlayer」，即可自动跳转到视频详情页：

![菜单](./attachments/bilibili_share.jpg)

---
title: 搜索
---

## 关键词与链接

在「搜索」页面的搜索框中输入关键词，可搜索 Bilibili 内容。搜索框也支持识别视频编号和以下链接：

| 输入内容                                             | 打开的页面                                        |
| ---------------------------------------------------- | ------------------------------------------------- |
| BV 号或 AV 号，例如 `BV1GJ411x7h7`                   | 视频详情与分 P 列表                               |
| Bilibili 视频链接                                    | 对应视频详情                                      |
| `b23.tv` 短链接                                      | 联网解析后打开对应的视频、收藏夹、合集或作者页面  |
| `space.bilibili.com/<mid>/favlist?fid=<id>&ctype=11` | 收藏夹；只有 `fid`、没有 `ctype` 时也按收藏夹处理 |
| 带 `fid=<id>&ctype=21` 的收藏列表链接                | 合集                                              |
| `space.bilibili.com/<mid>/lists/<id>`                | 合集                                              |
| `space.bilibili.com/<mid>/lists/<id>?type=series`    | 系列                                              |
| `space.bilibili.com/<mid>`                           | UP 主作品页                                       |

可直接粘贴含链接的 Bilibili 分享文本。短链接需要网络才能解析；未识别的输入会按关键词搜索。如果解析失败，请尝试复制完整链接或直接输入视频编号。

## 从 Bilibili 分享到 BBPlayer

在 Android 的 Bilibili 客户端中打开视频分享菜单，找到系统分享入口，再选择 BBPlayer，即可打开对应视频。菜单名称和位置可能随 Bilibili 或系统版本变化。

![Bilibili 分享菜单示例](/guides/attachments/bilibili_share.jpg)

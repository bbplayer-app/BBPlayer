# 品牌素材

这里是 Logo 与横幅的唯一来源。各应用里引用的是下表中的拷贝（路径被构建配置写死，不要移动），更换 Logo 时先更新这里，再按表同步到各处。

> 目前没有矢量源文件，PNG 即源头。如果之后有了 SVG / 设计稿，放在 `logo/` 下并以它为准。

## logo/

| 源文件                 | 说明                    | 应用内拷贝                                                                                                                                  |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `icon-1024-padded.png` | 1025×1025，带安全区留白 | `apps/mobile/assets/images/icon.png`、`apps/mobile/assets/images/adaptive-icon.png`、`apps/update-server/web/public/icon.png`               |
| `icon-512.png`         | 512×512，无留白         | `apps/mobile/assets/images/icon_large.png`、`apps/mobile/assets/images/media3_notification_small_icon.png`、`apps/docs/src/assets/icon.png` |
| `splash-1024.png`      | 1024×1024，启动屏图标   | `apps/mobile/assets/images/splash-icon.png`（`assets/bootsplash/logo*.png` 由 react-native-bootsplash 据此生成）                            |
| `wordmark-320x180.png` | 图标 + "BBPlayer" 横版  | `apps/mobile/assets/images/tv-banner.png`（Android TV banner）                                                                              |
| `favicon.ico`          | 网站图标                | `apps/docs/public/favicon.ico`                                                                                                              |

## banner/

| 文件                | 用途                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `readme-banner.jpg` | 2560×1280，根目录 README 顶部横幅，也可用作 GitHub social preview |

## 截图

截图源文件放在 `assets/screenshots/`（已 gitignore，不提交）：

- `raw/`：设备原始截图，1080×2400
- `framed/`：加框后的截图，1232×2530

命名规则：`{theme}_{scene}[_{variant}].png`，如 `dark_song_player_spectrum.png`。

由截图导出、并提交到仓库的版本：

- `assets/readme/`：README 截图，400×834 PNG
- `apps/docs/src/assets/landing/`：官网首页，900×1876 WebP
- `apps/docs/public/guides/attachments/`：文档正文配图

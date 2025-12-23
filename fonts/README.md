# 字体文件说明

请将以下字体文件放置在此目录中：

## 必需字体

1. **Arial 字体**（或类似的 sans-serif 字体）：
   - `arial.ttf` 或 `Arial.ttf`
   - 或者使用 Liberation Sans：`LiberationSans-Regular.ttf` 和 `LiberationSans-Bold.ttf`

2. **中文字体**（支持中文显示）：
   - `wqy-zenhei.ttf`（文泉驿正黑）
   - 或 `NotoSansCJK-Regular.ttf`（思源黑体）
   - 或 `Microsoft-YaHei.ttf`（微软雅黑）

## 字体来源

可以从以下位置获取字体文件：
- 系统字体目录（Windows: `C:\Windows\Fonts\`，macOS: `/Library/Fonts/`）
- 开源字体网站（如 Google Fonts, 文泉驿字体项目等）

## 注意事项

- 确保字体文件为 `.ttf` 格式
- 字体文件会被复制到 Docker 镜像的 `/usr/share/fonts/truetype/` 目录
- 构建镜像时会自动更新字体缓存


# Log Lens — 设计规范

## 美学方向

**Techno-Gothic**：深色运维控制台，冷青强调色 `#22d3ee`，钢铁灰表面。

**Signature Move**：Timeline Heat Ribbon — 底部时间密度热力带。

## 参考截图

| 文件 | 说明 |
|------|------|
| [03-analysis-main.png](./screenshots/03-analysis-main.png) | 主分析视图（AI 参考稿，待 Figma 高保真替换） |

## Figma 同步

完成 Figma 设计后，提供链接格式：`figma.com/design/<fileKey>/...`

使用 Figma AI Bridge：
1. `get_figma_data(fileKey, nodeId)` 拉取 token
2. `download_figma_images` 导出 2x PNG 覆盖 `screenshots/`

## Token 来源

当前 token 定义见 [`src/styles/tokens.css`](../../src/styles/tokens.css)。

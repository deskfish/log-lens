# Log Lens

多服务、多节点日志合并分析 Web 工具。支持分片上传、关键字检索、时间线热力导航。

## 功能

- 多文件上传（`.log` / `.txt` / `.gz`），标注服务名与节点名
- 多服务/多节点日志按时间戳合并展示
- FTS 关键字搜索 + 可选正则
- 服务/节点筛选、时间范围过滤
- Timeline Heat Ribbon 时间密度热力带
- 虚拟滚动，支撑大结果集浏览

## 快速开始

```bash
cd /Users/sunlacey/codespace/personal/log-lens
npm install
npm run dev
```

访问 http://localhost:3000

## 环境变量

```env
# 可选：保护 API 接口
API_KEY=your-secret-key
```

设置 `API_KEY` 后，所有 `/api/*` 请求需带请求头 `x-api-key`。

## Docker 部署

```bash
docker compose up -d --build
```

数据持久化在 `./data` 卷。

## 设计稿

参考截图见 [`docs/design/screenshots/`](docs/design/screenshots/)。

完成 Figma 高保真稿后，用 Figma AI Bridge 导出并覆盖截图目录。

## 从 100 环境拉取日志

```bash
# 需安装 sshpass: brew install sshpass
LOG_FETCH_PASS='你的SSH密码' npm run fetch-100
```

日志保存到 `data/fetched-100-env/<日期>/`，默认拉取 `192.168.6.100` 上 `/data/flybot/server/*/logs/` 的今日日志。

## 验证

```bash
npm run build    # 构建检查
npm run smoke    # 用 flybot 真实日志跑 API 冒烟测试（需先 npm run dev）
```

- Next.js 16 + TypeScript
- SQLite + FTS5
- better-sqlite3 流式索引
- @tanstack/react-virtual

## 目录

- `data/` — 上传文件与 SQLite 数据库（gitignore）
- `docs/design/` — UI 设计说明与截图
- `src/lib/parser/` — 日志格式解析
- `src/lib/indexer/` — 流式索引管线

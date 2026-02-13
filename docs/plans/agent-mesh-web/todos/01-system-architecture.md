# TODO: 01 — 系统架构

> 对应 Spec: `specs/01-system-architecture.md`

## 项目初始化

- [ ] 初始化 npm 项目，配置 `package.json`（name: jragentmesh, type: module）
- [ ] 配置 TypeScript（`tsconfig.json` 根配置 + `tsconfig.server.json` 服务端配置）
- [ ] 安装核心依赖：next, react, react-dom, express, ws, better-sqlite3, drizzle-orm, drizzle-kit
- [ ] 安装开发依赖：typescript, tsx, @types/express, @types/ws, @types/better-sqlite3
- [ ] 安装 pi-mono 相关包：@mariozechner/pi-agent-core, @mariozechner/pi-ai
- [ ] 安装 node-pty（后台 Agent PTY 管理）
- [ ] 配置 `.gitignore`（忽略 node_modules, data/, .env, dist/）

## 目录结构创建

- [ ] 创建 `server/` 目录及子目录（websocket/, services/, db/, utils/）
- [ ] 创建 `src/` 目录及子目录（app/, components/, hooks/, stores/, lib/）
- [ ] 创建 `shared/` 目录
- [ ] 创建 `data/` 目录（uploads/, downloads/, workspaces/）

## 服务端入口

- [ ] 实现 `server/index.ts` — 主入口，按顺序初始化各服务
- [ ] 实现 `server/express-app.ts` — Express 应用，挂载 API 路由
- [ ] 配置 Express 中间件（JSON 解析、CORS、静态文件）
- [ ] 集成 Next.js 请求处理器（custom server 模式）
- [ ] 实现 WebSocket 升级处理（HTTP Server 的 upgrade 事件）
- [ ] 配置环境变量加载（.env → process.env）

## 启动脚本

- [ ] 配置 `dev` 脚本（tsx watch 模式）
- [ ] 配置 `build` 脚本（Next.js 构建 + 服务端 TypeScript 编译）
- [ ] 配置 `start` 脚本（生产模式启动）

## 工具模块

- [ ] 实现 `server/utils/logger.ts` — 日志工具（控制台输出，带时间戳和级别）
- [ ] 实现 `server/utils/crypto.ts` — 加密工具（AES-256-GCM 加解密函数）

## 验证

- [ ] 服务器可正常启动并监听端口
- [ ] Next.js 页面可正常访问（浏览器打开 http://localhost:3000）
- [ ] WebSocket 连接可建立
- [ ] SQLite 数据库文件自动创建

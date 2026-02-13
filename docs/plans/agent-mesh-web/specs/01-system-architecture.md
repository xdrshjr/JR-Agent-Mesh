# 01 — 系统架构详细设计

## 1. 项目目录结构

```
JRAgentMesh/
├── package.json                  # 根 package，workspaces 配置
├── tsconfig.json                 # 根 TypeScript 配置
├── drizzle.config.ts             # Drizzle ORM 配置
├── server/                       # 服务端代码
│   ├── index.ts                  # 入口：Express + WebSocket + Next.js
│   ├── express-app.ts            # Express 应用配置（REST API 路由）
│   ├── websocket/
│   │   ├── server.ts             # WebSocket 服务器初始化
│   │   ├── handler.ts            # 消息路由与分发
│   │   └── protocol.ts           # 消息协议类型定义
│   ├── services/
│   │   ├── self-agent.ts         # 自身 Agent 服务（pi-mono 集成）
│   │   ├── agent-process-manager.ts  # 后台 Agent 进程管理
│   │   ├── agent-registry.ts     # Agent 类型注册表
│   │   ├── session-manager.ts    # 会话管理（前端连接 ↔ Agent 映射）
│   │   ├── file-transfer.ts      # 文件传输服务
│   │   └── credential-store.ts   # 凭证加密存储
│   ├── db/
│   │   ├── schema.ts             # Drizzle Schema 定义
│   │   ├── index.ts              # 数据库连接初始化
│   │   └── migrations/           # 数据库迁移文件
│   └── utils/
│       ├── logger.ts             # 日志工具
│       └── crypto.ts             # 加密工具（凭证加密）
├── src/                          # Next.js 前端代码（App Router）
│   ├── app/
│   │   ├── layout.tsx            # 根布局
│   │   ├── page.tsx              # 主页面（重定向到 /chat）
│   │   ├── chat/
│   │   │   └── page.tsx          # 自身 Agent 对话页
│   │   ├── agents/
│   │   │   └── page.tsx          # 后台 Agent 管理页
│   │   └── settings/
│   │       └── page.tsx          # 设置页
│   ├── components/
│   │   ├── layout/               # 布局组件（侧边栏、顶栏、标签栏）
│   │   ├── chat/                 # 对话组件（消息列表、输入框、Timeline）
│   │   ├── agents/               # Agent 管理组件（卡片、状态面板）
│   │   ├── settings/             # 设置组件（表单、凭证编辑器）
│   │   └── ui/                   # shadcn/ui 基础组件
│   ├── hooks/                    # 自定义 React Hooks
│   │   ├── use-websocket.ts      # WebSocket 连接管理
│   │   ├── use-self-agent.ts     # 自身 Agent 状态
│   │   └── use-agent-manager.ts  # 后台 Agent 管理状态
│   ├── stores/                   # Zustand 状态仓库
│   │   ├── chat-store.ts         # 对话状态
│   │   ├── agent-store.ts        # Agent 列表状态
│   │   └── settings-store.ts     # 设置状态
│   └── lib/
│       ├── websocket-client.ts   # WebSocket 客户端封装
│       └── types.ts              # 共享类型定义
├── shared/                       # 前后端共享代码
│   └── types.ts                  # 共享 TypeScript 类型（消息协议等）
└── data/                         # 运行时数据（gitignore）
    ├── jragentmesh.db            # SQLite 数据库文件
    ├── uploads/                  # 上传文件暂存
    └── workspaces/               # 后台 Agent 默认工作目录
```

## 2. 服务器启动流程

```
启动命令: npm run start (或 npm run dev)
         │
         ▼
   server/index.ts
         │
         ├─── 1. 初始化 SQLite 数据库连接
         │         └─ 运行 Drizzle 迁移（如有）
         │
         ├─── 2. 初始化核心服务
         │         ├─ CredentialStore（加载凭证）
         │         ├─ AgentRegistry（注册 Agent 类型）
         │         ├─ AgentProcessManager（恢复之前运行的 Agent 进程记录）
         │         ├─ SelfAgent（初始化 pi-mono Agent 实例）
         │         └─ SessionManager（准备接受前端连接）
         │
         ├─── 3. 创建 Express 应用
         │         ├─ 挂载 REST API 路由（/api/*）
         │         └─ 挂载文件上传/下载路由
         │
         ├─── 4. 创建 HTTP Server
         │         └─ 附加 Next.js 请求处理器
         │
         ├─── 5. 创建 WebSocket Server
         │         └─ 监听 upgrade 事件，绑定到 HTTP Server
         │
         └─── 6. 启动监听
                   └─ 默认端口 3000，输出访问地址
```

## 3. 进程模型

```
┌────────────────────────────────────────────────┐
│              Node.js 主进程                      │
│                                                  │
│  ┌──────────────┐  ┌────────────────────────┐   │
│  │  Express      │  │  WebSocket Server      │   │
│  │  (HTTP API)   │  │  (实时通信)            │   │
│  └──────────────┘  └────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  SelfAgent (pi-agent-core 实例)           │   │
│  │  - 运行在主进程内                          │   │
│  │  - 通过 WebSocket 与前端通信               │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  AgentProcessManager                      │   │
│  │  - 管理子进程引用                          │   │
│  │  - 捕获输出流                              │   │
│  │  - 转发到 WebSocket                        │   │
│  └──────┬──────────┬──────────┬─────────────┘   │
│         │          │          │                   │
└─────────┼──────────┼──────────┼──────────────────┘
          │ PTY      │ PTY      │ PTY
    ┌─────┴───┐ ┌────┴────┐ ┌──┴──────────┐
    │ claude   │ │opencode │ │   codex     │
    │ (CLI)    │ │ (CLI)   │ │   (CLI)     │
    └─────────┘ └─────────┘ └─────────────┘
    子进程 #1    子进程 #2    子进程 #3
```

**关键点**：
- 自身 Agent（pi-mono）运行在主进程内，非子进程，因为它需要直接访问服务端资源
- 后台 Agent 以 PTY 子进程方式运行，与主进程隔离
- 每个后台 Agent 进程有独立的 stdout/stderr 捕获管道

## 4. 请求处理模型

### 4.1 HTTP REST API（Express）

用于非实时操作：

| 路径 | 方法 | 用途 |
|------|------|------|
| `GET /api/agents` | GET | 获取所有后台 Agent 列表及状态 |
| `POST /api/agents` | POST | 创建新的后台 Agent 实例 |
| `DELETE /api/agents/:id` | DELETE | 停止并删除后台 Agent |
| `GET /api/settings` | GET | 获取系统设置 |
| `PUT /api/settings` | PUT | 更新系统设置 |
| `GET /api/credentials` | GET | 获取凭证列表（脱敏） |
| `PUT /api/credentials/:key` | PUT | 更新指定凭证 |
| `POST /api/upload` | POST | 上传文件 |
| `GET /api/download/:fileId` | GET | 下载文件 |
| `GET /api/conversations` | GET | 获取对话历史列表 |
| `GET /api/conversations/:id` | GET | 获取指定对话详情 |

### 4.2 WebSocket（实时通信）

用于所有实时交互：

- 自身 Agent 的对话流式输出
- 后台 Agent 的实时输出流
- Agent 状态变更通知
- 文件传输进度
- 系统通知

详细协议设计见 `05-realtime-communication.md`。

## 5. 环境配置

```
# .env（服务端环境变量）
PORT=3000                        # 服务器端口
DATA_DIR=./data                  # 数据目录
ENCRYPTION_KEY=<auto-generated>  # 凭证加密密钥（首次启动自动生成）
```

启动脚本：

```pseudo
// package.json scripts
{
  "dev":   "tsx watch server/index.ts",      // 开发模式（热重载）
  "build": "next build && tsc -p tsconfig.server.json",  // 构建
  "start": "node dist/server/index.js"       // 生产模式
}
```

## 6. 错误处理策略

| 场景 | 处理方式 |
|------|---------|
| WebSocket 断开 | 前端自动重连（指数退避），重连后恢复状态 |
| 后台 Agent 进程崩溃 | 捕获 exit 事件，标记状态为 crashed，通知前端 |
| 自身 Agent LLM 调用失败 | 返回错误消息到对话，用户可重试 |
| SQLite 写入失败 | 记录日志，返回 500 错误 |
| 文件上传失败 | 返回错误提示，前端可重试 |

## 7. 安全考量

- **凭证加密**：API Key 使用 AES-256-GCM 加密后存入 SQLite，加密密钥存储在 `.env`
- **无外部暴露**：默认仅监听 `localhost`，用户需自行配置反向代理暴露到外网
- **Shell 命令执行**：自身 Agent 的 bash 工具继承 pi-mono 的行为（无额外限制，信任用户）
- **文件访问**：无沙箱限制，Agent 可访问服务器上用户权限范围内的所有文件

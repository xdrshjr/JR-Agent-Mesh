# TODO: 04 — 后台 Agent 进程管理

> 对应 Spec: `specs/04-backend-agent-manager.md`

## Agent 类型注册表

- [ ] 实现 `server/services/agent-registry.ts` — AgentRegistry 类
- [ ] 定义 `AgentTypeConfig` 接口
- [ ] 注册预置 Agent 类型：Claude Code（claude CLI）
- [ ] 注册预置 Agent 类型：OpenCode（opencode CLI）
- [ ] 注册预置 Agent 类型：Codex（codex CLI）
- [ ] 实现 `getType()`, `listTypes()`, `registerType()` 方法

## AgentProcessManager 核心

- [ ] 实现 `server/services/agent-process-manager.ts` — AgentProcessManager 类
- [ ] 实现 `createProcess()` — 创建并启动后台 Agent 进程（node-pty）
- [ ] 实现环境变量注入（从 CredentialStore 获取对应 API Key）
- [ ] 实现工作目录处理（用户指定 / 默认目录自动创建）
- [ ] 实现 `sendInput()` — 通过 PTY 向进程发送用户输入
- [ ] 实现 `stopProcess()` — 优雅终止（SIGTERM → 等待 → SIGKILL）
- [ ] 实现 `restartProcess()` — 停止后重新启动
- [ ] 实现 `deleteProcess()` — 停止进程并删除记录

## 输出处理

- [ ] 实现 PTY onData 回调，捕获进程原始输出
- [ ] 实现 `RingBuffer`（环形缓冲区，保留最近 100K 字符）
- [ ] 实现输出解析器接口 `OutputParser`
- [ ] 实现 `ClaudeCodeParser` — 解析 Claude Code CLI 输出，识别工具调用模式
- [ ] 实现 `GenericCLIParser` — 通用 CLI 输出解析器（原样传递）
- [ ] 实现输出实时推送到 WebSocket（节流：50ms 合并）
- [ ] 实现输出批量持久化到 SQLite（定期刷新，非每条写入）

## 进程生命周期事件

- [ ] 实现 PTY onExit 回调，处理进程退出
- [ ] 区分正常退出（EXITED）、崩溃退出（CRASHED）、用户停止（STOPPED）
- [ ] 进程状态变更时通知所有 WebSocket 前端连接
- [ ] 进程状态变更时更新 SQLite 记录

## 服务器重启恢复

- [ ] 实现 `recoverAgents()` — 启动时检查数据库中 RUNNING 状态的记录
- [ ] 将不存在的进程标记为 STOPPED（reason: server_restart）
- [ ] 不自动重启，由用户手动决定

## 并发管理

- [ ] 实现最大进程数限制（从设置中读取，默认 10）
- [ ] 创建进程时检查当前运行数量，超出限制时拒绝并返回错误

## REST API

- [ ] 实现 `GET /api/agents` — 列出所有后台 Agent 及其状态
- [ ] 实现 `POST /api/agents` — 创建新后台 Agent
- [ ] 实现 `DELETE /api/agents/:id` — 停止并删除后台 Agent
- [ ] 实现 `POST /api/agents/:id/restart` — 重启 Agent

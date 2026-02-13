# TODO: 06 — 数据持久化

> 对应 Spec: `specs/06-data-persistence.md`

## 数据库初始化

- [ ] 实现 `server/db/index.ts` — 数据库连接初始化（better-sqlite3 + Drizzle）
- [ ] 配置 SQLite WAL 模式、foreign_keys=ON
- [ ] 实现数据库文件自动创建（data/jragentmesh.db）

## Schema 定义

- [ ] 实现 `server/db/schema.ts` — 全部 Drizzle Schema
- [ ] 定义 `conversations` 表
- [ ] 定义 `messages` 表（含 tool_calls, attachments JSON 字段）
- [ ] 定义 `agent_processes` 表
- [ ] 定义 `agent_outputs` 表
- [ ] 定义 `credentials` 表（含加密字段）
- [ ] 定义 `settings` 表
- [ ] 定义 `file_transfers` 表
- [ ] 生成初始迁移文件（drizzle-kit generate）
- [ ] 实现启动时自动迁移（drizzle-kit migrate）

## Repository 层

- [ ] 实现 `ConversationRepository` — list, getById, create, updateTitle, archive, delete
- [ ] 实现 `MessageRepository` — listByConversation, create, updateContent, updateToolCalls
- [ ] 实现 `AgentProcessRepository` — list, getById, create, updateStatus, delete
- [ ] 实现 `AgentOutputRepository` — listByAgent, batchInsert, countByAgent
- [ ] 实现 `SettingsRepository` — get, set, getAll, getByPrefix
- [ ] 实现 `CredentialRepository` — list（脱敏）, get（解密）, set（加密）, delete
- [ ] 实现 `FileTransferRepository` — create, getById, updateStatus, getExpired, delete

## 预置数据

- [ ] 首次启动时插入默认设置项（self_agent.provider, self_agent.model 等）
- [ ] 首次启动时插入预定义凭证类型（Anthropic, OpenAI, Google 等，value 为空）

## 数据清理

- [ ] 实现定时清理任务（setInterval，每小时运行）
- [ ] 清理过期文件传输记录和文件
- [ ] 清理超过保留天数的 Agent 输出日志
- [ ] 实现数据库 VACUUM（可选，当浪费空间超阈值时）

## 导入导出

- [ ] 实现数据导出 API（`GET /api/export`）— 导出对话和设置为 JSON
- [ ] 实现数据导入 API（`POST /api/import`）— 从 JSON 导入
- [ ] 导入时支持合并或覆盖模式选择

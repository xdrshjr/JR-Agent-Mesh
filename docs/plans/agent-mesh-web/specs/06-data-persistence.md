# 06 — 数据持久化设计

## 1. 概述

使用 SQLite 作为持久化存储，通过 Drizzle ORM 进行类型安全的数据库操作。数据库文件存储在 `data/jragentmesh.db`。

## 2. Drizzle 配置

```pseudo
// drizzle.config.ts
export default {
    schema: "./server/db/schema.ts",
    out: "./server/db/migrations",
    driver: "better-sqlite3",
    dbCredentials: {
        url: "./data/jragentmesh.db"
    }
}
```

SQLite 配置：
- WAL 模式启用（提高并发读性能）
- journal_mode = WAL
- synchronous = NORMAL
- foreign_keys = ON

## 3. Schema 设计

### 3.1 对话表 (conversations)

```pseudo
table conversations:
    id              TEXT PRIMARY KEY       // UUID
    title           TEXT                   // 对话标题（自动生成或用户修改）
    model_provider  TEXT                   // 使用的 LLM Provider
    model_id        TEXT                   // 使用的模型 ID
    created_at      INTEGER NOT NULL       // Unix 毫秒时间戳
    updated_at      INTEGER NOT NULL       // 最后更新时间
    is_archived     INTEGER DEFAULT 0      // 是否归档
```

### 3.2 消息表 (messages)

```pseudo
table messages:
    id              TEXT PRIMARY KEY       // UUID
    conversation_id TEXT NOT NULL           // 外键 → conversations.id
    role            TEXT NOT NULL           // "user" | "assistant" | "system"
    content         TEXT                    // 消息文本内容
    thinking        TEXT                    // 推理/思考内容（可选）
    tool_calls      TEXT                    // JSON: 工具调用记录数组
    attachments     TEXT                    // JSON: 文件附件信息数组
    token_usage     TEXT                    // JSON: { inputTokens, outputTokens, cost }
    created_at      INTEGER NOT NULL       // Unix 毫秒时间戳

    index idx_messages_conversation (conversation_id)
    foreign key (conversation_id) references conversations(id) ON DELETE CASCADE
```

### 3.3 工具调用记录（存储在 messages.tool_calls JSON 中）

```pseudo
// messages.tool_calls JSON 结构
[
    {
        id: string,              // 工具调用 ID
        tool: string,            // "read" | "write" | "edit" | "bash" | ...
        args: object,            // 工具参数
        result: string,          // 结果摘要
        success: boolean,
        duration: number,        // 毫秒
        startedAt: number,       // 时间戳
    }
]
```

### 3.4 后台 Agent 进程表 (agent_processes)

```pseudo
table agent_processes:
    id              TEXT PRIMARY KEY       // UUID
    type_id         TEXT NOT NULL           // "claude-code" | "opencode" | "codex"
    name            TEXT NOT NULL           // 显示名称
    status          TEXT NOT NULL           // "RUNNING" | "STOPPED" | "CRASHED" | "EXITED" | "FAILED"
    work_dir        TEXT                    // 工作目录路径
    pid             INTEGER                // 操作系统进程 ID
    exit_code       INTEGER                // 退出码
    created_at      INTEGER NOT NULL
    stopped_at      INTEGER                // 停止时间
    config          TEXT                    // JSON: 自定义启动配置

    index idx_agent_status (status)
```

### 3.5 Agent 输出日志表 (agent_outputs)

```pseudo
table agent_outputs:
    id              INTEGER PRIMARY KEY AUTOINCREMENT
    agent_id        TEXT NOT NULL           // 外键 → agent_processes.id
    type            TEXT NOT NULL           // "text" | "tool_start" | "tool_end" | "thinking" | "error" | "raw" | "user_input"
    content         TEXT                    // 输出内容
    tool            TEXT                    // 工具名称（如适用）
    args            TEXT                    // 工具参数（如适用）
    success         INTEGER                // 工具执行是否成功
    duration        INTEGER                // 工具执行耗时
    created_at      INTEGER NOT NULL

    index idx_agent_outputs_agent (agent_id)
    foreign key (agent_id) references agent_processes(id) ON DELETE CASCADE
```

### 3.6 凭证表 (credentials)

```pseudo
table credentials:
    key             TEXT PRIMARY KEY       // 凭证标识，如 "anthropic_key"
    display_name    TEXT NOT NULL           // 显示名称，如 "Anthropic API Key"
    encrypted_value TEXT NOT NULL           // AES-256-GCM 加密后的值
    iv              TEXT NOT NULL           // 初始化向量
    auth_tag        TEXT NOT NULL           // 认证标签
    provider        TEXT                    // 关联的 Provider 名称
    updated_at      INTEGER NOT NULL
```

### 3.7 设置表 (settings)

```pseudo
table settings:
    key             TEXT PRIMARY KEY       // 设置键
    value           TEXT NOT NULL           // 设置值（JSON 字符串）
    updated_at      INTEGER NOT NULL
```

预置设置项：
```pseudo
默认设置:
    "self_agent.provider"      → "anthropic"
    "self_agent.model"         → "claude-sonnet-4-5-20250929"
    "self_agent.system_prompt" → DEFAULT_SYSTEM_PROMPT
    "self_agent.custom_url"    → ""
    "self_agent.custom_model"  → ""
    "notification.sound"       → "true"
    "notification.browser"     → "false"
    "agent.max_processes"      → "10"
    "agent.default_work_dir"   → "./data/workspaces"
    "dispatch.enabled"         → "false"
```

### 3.8 文件传输记录表 (file_transfers)

```pseudo
table file_transfers:
    id              TEXT PRIMARY KEY       // UUID（也作为下载 token）
    conversation_id TEXT                   // 关联对话（可选）
    agent_id        TEXT                   // 关联 Agent（可选）
    filename        TEXT NOT NULL           // 原始文件名
    file_path       TEXT NOT NULL           // 服务器上的存储路径
    file_size       INTEGER NOT NULL        // 文件大小（字节）
    direction       TEXT NOT NULL           // "upload" | "download"
    status          TEXT NOT NULL           // "pending" | "completed" | "expired"
    created_at      INTEGER NOT NULL
    expires_at      INTEGER                // 过期时间（24小时后自动清理）

    index idx_file_conversation (conversation_id)
```

## 4. 数据访问层

### 4.1 对话 Repository

```pseudo
class ConversationRepository:
    list(options?: { archived?: boolean, limit?: number, offset?: number }):
        → Conversation[]

    getById(id):
        → Conversation with messages

    create(title?, modelProvider?, modelId?):
        → Conversation

    updateTitle(id, title):
        → void

    archive(id):
        → void

    delete(id):
        → void (级联删除消息)

class MessageRepository:
    listByConversation(conversationId, limit?, offset?):
        → Message[]

    create(conversationId, role, content, toolCalls?, attachments?):
        → Message

    updateContent(id, content):
        → void (用于流式消息完成后更新)

    updateToolCalls(id, toolCalls):
        → void
```

### 4.2 Agent Repository

```pseudo
class AgentProcessRepository:
    list(status?: string[]):
        → AgentProcess[]

    getById(id):
        → AgentProcess with recent outputs

    create(typeId, name, workDir, pid):
        → AgentProcess

    updateStatus(id, status, exitCode?):
        → void

    delete(id):
        → void (级联删除输出日志)

class AgentOutputRepository:
    listByAgent(agentId, fromIndex?, limit?):
        → AgentOutput[]

    batchInsert(agentId, outputs[]):
        → void

    countByAgent(agentId):
        → number
```

### 4.3 设置 Repository

```pseudo
class SettingsRepository:
    get(key):
        → string | null

    set(key, value):
        → void

    getAll():
        → Map<string, string>

    getByPrefix(prefix):
        → Map<string, string>     // 如 getByPrefix("self_agent.") 返回所有自身 Agent 设置

class CredentialRepository:
    list():
        → Credential[] (value 字段返回掩码版)

    get(key):
        → decrypted value

    set(key, displayName, value, provider?):
        → void (加密后存储)

    delete(key):
        → void
```

## 5. 数据清理策略

```pseudo
// 定时清理任务（每小时运行一次）
function cleanupJob():
    // 1. 清理过期文件传输记录和文件
    expiredFiles = db.getExpiredFileTransfers()
    for file in expiredFiles:
        deleteFile(file.filePath)
        db.deleteFileTransfer(file.id)

    // 2. 清理超过 30 天的已停止 Agent 的输出日志
    oldAgents = db.getAgentProcesses(status: ["STOPPED", "CRASHED", "EXITED"], olderThan: 30d)
    for agent in oldAgents:
        db.deleteAgentOutputs(agent.id)

    // 3. 压缩数据库（如果需要）
    if db.getWastedSpace() > 100MB:
        db.vacuum()
```

## 6. 备份与导出

```pseudo
// 数据导出（设置页面触发）
function exportData():
    conversations = db.getAllConversations()
    settings = db.getAllSettings()
    // 不导出凭证（安全考虑）

    return JSON.stringify({
        version: 1,
        exportedAt: now(),
        conversations,
        settings,
    })

// 数据导入
function importData(jsonData):
    data = JSON.parse(jsonData)
    // 验证版本兼容性
    // 合并或覆盖（用户选择）
    db.importConversations(data.conversations)
    db.importSettings(data.settings)
```

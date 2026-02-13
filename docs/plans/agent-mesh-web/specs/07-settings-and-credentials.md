# 07 — 设置与凭证管理

## 1. 概述

设置系统管理 JRAgentMesh 的所有可配置项，包括自身 Agent 配置、后台 Agent 配置、通知偏好和通用设置。凭证（API Key）在服务端加密存储，前端可查看（脱敏）和编辑。

## 2. 设置分类

### 2.1 自身 Agent 设置

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 默认 Provider | select | anthropic | LLM 提供商 |
| 默认 Model | select | claude-sonnet-4-5-20250929 | 模型 ID |
| 自定义 API URL | text | (空) | 自定义 OpenAI 兼容 API 地址 |
| 自定义 Model ID | text | (空) | 自定义模型名称 |
| System Prompt | textarea | 预设 | 系统提示词 |
| 调度模式 | toggle | OFF | 是否启用 Agent 调度 |

**Provider/Model 联动**：
```pseudo
Provider 列表:
  - Anthropic → Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus, ...
  - OpenAI   → GPT-4o, GPT-4o-mini, o1, o1-mini, ...
  - Google   → Gemini 1.5 Pro, Gemini 1.5 Flash, ...
  - xAI      → Grok-2, ...
  - Groq     → Llama 3.1 70B, Mixtral, ...
  - Custom   → (使用自定义 URL + Model ID)

选择 Provider 时自动筛选可用 Model 列表
选择 "Custom" 时显示 URL 和 Model ID 输入框
```

### 2.2 后台 Agent 设置

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 最大同时运行数 | number | 10 | 后台 Agent 最大并发数 |
| 默认工作目录 | text | ./data/workspaces | 未指定时的默认目录 |
| Claude Code 路径 | text | claude | CLI 可执行文件路径 |
| OpenCode 路径 | text | opencode | CLI 可执行文件路径 |
| Codex 路径 | text | codex | CLI 可执行文件路径 |

### 2.3 通知设置

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 声音通知 | toggle | ON | Agent 完成任务时播放声音 |
| 浏览器通知 | toggle | OFF | 使用浏览器 Notification API |
| 通知事件 | multi-select | 全部 | 哪些事件触发通知 |

通知事件类型：
- Agent 任务完成
- Agent 崩溃/错误
- 文件传输完成

### 2.4 通用设置

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 对话历史保留天数 | number | 90 | 超过天数的对话自动归档 |
| Agent 日志保留天数 | number | 30 | 超过天数的输出日志自动清理 |
| 数据导出 | button | - | 导出对话和设置为 JSON |
| 数据导入 | button | - | 从 JSON 导入数据 |

## 3. 凭证管理

### 3.1 预定义凭证类型

```pseudo
CREDENTIAL_TYPES = [
    {
        key: "anthropic_key",
        displayName: "Anthropic API Key",
        provider: "anthropic",
        placeholder: "sk-ant-...",
        description: "用于 Claude 系列模型和 Claude Code"
    },
    {
        key: "openai_key",
        displayName: "OpenAI API Key",
        provider: "openai",
        placeholder: "sk-...",
        description: "用于 GPT 系列模型、OpenCode 和 Codex"
    },
    {
        key: "google_key",
        displayName: "Google AI API Key",
        provider: "google",
        placeholder: "AIza...",
        description: "用于 Gemini 系列模型"
    },
    {
        key: "xai_key",
        displayName: "xAI API Key",
        provider: "xai",
        placeholder: "xai-...",
        description: "用于 Grok 系列模型"
    },
    {
        key: "groq_key",
        displayName: "Groq API Key",
        provider: "groq",
        placeholder: "gsk_...",
        description: "用于 Groq 推理加速"
    },
    {
        key: "custom_key",
        displayName: "自定义 API Key",
        provider: "custom",
        placeholder: "",
        description: "用于自定义 OpenAI 兼容 API"
    },
]
```

### 3.2 加密存储方案

```pseudo
// 加密
function encryptCredential(plainText, encryptionKey):
    iv = crypto.randomBytes(12)                   // 12 字节 IV
    cipher = crypto.createCipheriv(
        "aes-256-gcm",
        deriveKey(encryptionKey),                  // 从 ENCRYPTION_KEY 派生
        iv
    )
    encrypted = cipher.update(plainText, "utf8", "hex") + cipher.final("hex")
    authTag = cipher.getAuthTag().toString("hex")

    return { encrypted, iv: iv.toString("hex"), authTag }

// 解密
function decryptCredential(encrypted, iv, authTag, encryptionKey):
    decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        deriveKey(encryptionKey),
        Buffer.from(iv, "hex")
    )
    decipher.setAuthTag(Buffer.from(authTag, "hex"))
    plainText = decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8")

    return plainText

// 密钥派生
function deriveKey(encryptionKey):
    return crypto.pbkdf2Sync(encryptionKey, "jragentmesh-salt", 100000, 32, "sha256")
```

### 3.3 凭证 API

```pseudo
// GET /api/credentials — 列出所有凭证（脱敏）
响应:
[
    {
        key: "anthropic_key",
        displayName: "Anthropic API Key",
        provider: "anthropic",
        hasValue: true,                  // 是否已设置
        maskedValue: "sk-ant-•••••R7x",  // 显示前几位和后3位
        updatedAt: 1700000000000
    },
    ...
]

// PUT /api/credentials/:key — 设置/更新凭证
请求: { value: "sk-ant-api-xxx..." }
响应: { success: true }

// DELETE /api/credentials/:key — 删除凭证
响应: { success: true }
```

### 3.4 凭证脱敏规则

```pseudo
function maskCredential(value):
    if value.length <= 8:
        return "••••••••"
    prefix = value.substring(0, min(value.indexOf("-") + 5, 8))  // 保留前缀如 "sk-ant-"
    suffix = value.substring(value.length - 3)                    // 保留最后 3 位
    return prefix + "•••••" + suffix
```

## 4. 设置 API

```pseudo
// GET /api/settings — 获取所有设置
响应:
{
    "self_agent": {
        "provider": "anthropic",
        "model": "claude-sonnet-4-5-20250929",
        "custom_url": "",
        "system_prompt": "...",
    },
    "notification": {
        "sound": true,
        "browser": false,
    },
    "agent": {
        "max_processes": 10,
        "default_work_dir": "./data/workspaces",
    },
    "general": {
        "conversation_retention_days": 90,
        "agent_log_retention_days": 30,
    }
}

// PUT /api/settings — 批量更新设置
请求: { "self_agent.provider": "openai", "self_agent.model": "gpt-4o" }
响应: { success: true }
```

## 5. 设置变更响应

某些设置变更需要即时生效：

```pseudo
function onSettingChanged(key, value):
    switch key:
        case "self_agent.provider" or "self_agent.model":
            // 重新创建 streamFn，切换模型
            selfAgent.switchModel(createStreamFn(newSettings))

        case "self_agent.system_prompt":
            // 更新系统提示词（下次新对话生效）
            selfAgent.setSystemPrompt(value)

        case "notification.sound":
            // 通知前端更新声音开关状态
            broadcast("settings.updated", { key, value })

        case "agent.max_processes":
            // 更新进程管理器限制
            agentProcessManager.setMaxProcesses(parseInt(value))
```

## 6. ENCRYPTION_KEY 管理

```pseudo
// 首次启动时自动生成
function ensureEncryptionKey():
    envPath = path.join(DATA_DIR, ".env")

    if not fileExists(envPath) or not envContains(envPath, "ENCRYPTION_KEY"):
        key = crypto.randomBytes(32).toString("hex")
        appendToFile(envPath, "ENCRYPTION_KEY=" + key)
        log("已生成加密密钥，存储于: " + envPath)

    return process.env.ENCRYPTION_KEY
```

重要提示：
- `.env` 文件不应纳入版本控制
- 如果 `.env` 丢失，所有已存储的凭证将无法解密，需要重新输入
- 建议在设置页面提醒用户备份 `.env` 文件

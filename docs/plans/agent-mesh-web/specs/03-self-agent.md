# 03 — 自身 Agent 集成（pi-mono）

## 1. 概述

自身 Agent 是 JRAgentMesh 的核心智能层，基于 pi-mono 的 `@mariozechner/pi-agent-core` 和 `@mariozechner/pi-ai` 构建。它运行在服务端主进程中，通过 WebSocket 与前端对话界面通信。

## 2. 架构设计

```
┌─ 前端 ──────────────────┐      ┌─ 服务端 ─────────────────────────┐
│                          │      │                                   │
│  ChatPage                │      │  SelfAgentService                 │
│  ├─ MessageArea          │      │  ├─ Agent (pi-agent-core)         │
│  ├─ ToolTimeline         │ WS   │  │   ├─ state (AgentState)        │
│  └─ InputArea       ◄────┼──────┤  │   ├─ tools (read/write/edit/   │
│                          │      │  │   │         bash + 自定义)      │
│  用户输入 ───────────────┼──────►  │   └─ streamFn → pi-ai          │
│                          │      │  ├─ SessionStore (对话持久化)      │
│                          │      │  └─ DispatchService (调度模式)     │
│                          │      │                                   │
└──────────────────────────┘      └───────────────────────────────────┘
```

## 3. Agent 初始化

```pseudo
function initSelfAgent(credentials, settings):
    // 1. 构建 streamFn（LLM 调用函数）
    streamFn = createStreamFn({
        provider: settings.defaultProvider,    // "anthropic" | "openai" | "google" | "custom"
        model: settings.defaultModel,          // "claude-sonnet-4-5-20250929" 等
        apiKey: credentials.get(provider),
        customUrl: settings.customUrl,         // 自定义 API URL（可选）
    })

    // 2. 创建 Agent 实例
    agent = new Agent({
        streamFn: streamFn,
        systemPrompt: settings.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        tools: [
            readTool,       // 读取文件
            writeTool,      // 写入文件
            editTool,       // 编辑文件
            bashTool,       // 执行 Shell 命令
            fileTransferTool,   // 文件传输（自定义）
            agentDispatchTool,  // Agent 调度（自定义，仅调度模式开启时注册）
        ],
    })

    // 3. 注册事件监听
    agent.on("message_update", handleStreamEvent)
    agent.on("tool_call", handleToolCall)
    agent.on("tool_result", handleToolResult)
    agent.on("turn_end", handleTurnEnd)

    return agent
```

## 4. 默认系统提示词

```pseudo
DEFAULT_SYSTEM_PROMPT = """
你是 JRAgentMesh 的内置 AI 助手，具备完整的通用能力。

你可以：
- 与用户进行自然语言对话
- 读取、写入、编辑服务器上的文件
- 执行 Shell 命令
- 帮助用户完成编程、文档编写、文件管理等任务
- 向用户发送文件（通过 file_transfer 工具）

{如果调度模式开启}
你还可以将任务分发给后台 Agent：
- 使用 agent_dispatch 工具将任务发送给指定的后台 Agent
- 可用的后台 Agent: {动态列出当前运行中的 Agent}
- 根据任务性质选择合适的 Agent，或让用户指定
{/如果}
"""
```

## 5. 工具系统

### 5.1 内置工具（继承 pi-mono）

| 工具 | 描述 | 参数 |
|------|------|------|
| `read` | 读取文件内容 | `path: string` |
| `write` | 写入文件内容 | `path: string, content: string` |
| `edit` | 编辑文件（搜索替换） | `path: string, search: string, replace: string` |
| `bash` | 执行 Shell 命令 | `command: string, timeout?: number` |

### 5.2 自定义工具

#### file_transfer（文件传输）

```pseudo
tool file_transfer:
    description: "将服务器上的文件发送给用户下载"
    params:
        path: string       // 文件路径
        filename?: string  // 可选，自定义下载文件名

    execute(params):
        file = readFile(params.path)
        fileId = generateId()
        storeFileForDownload(fileId, file, params.filename || basename(params.path))

        // 返回给 LLM 的结果
        return { result: "文件已准备好供用户下载" }

        // 返回给 UI 的结果（通过事件）
        emit("file_ready", { fileId, filename, size })
```

#### agent_dispatch（Agent 调度）

```pseudo
tool agent_dispatch:
    description: "将任务分发给后台 Agent 执行"
    params:
        agentId?: string    // 指定 Agent ID（可选，不指定则自动选择）
        agentType?: string  // 指定 Agent 类型（可选）
        task: string        // 任务描述
        workDir?: string    // 工作目录（可选）

    execute(params):
        if params.agentId:
            agent = agentProcessManager.get(params.agentId)
        else if params.agentType:
            // 查找该类型的空闲 Agent，或创建新的
            agent = agentProcessManager.findOrCreate(params.agentType, params.workDir)
        else:
            // 根据任务描述自动选择最合适的 Agent 类型
            agent = agentProcessManager.autoSelect(params.task)

        agentProcessManager.sendInput(agent.id, params.task)

        return {
            result: "任务已分发给 {agent.name}",
            agentId: agent.id,
            agentName: agent.name
        }
```

## 6. 对话流程

### 6.1 普通对话

```
用户输入 "请帮我写一个 Python 排序脚本"
    │
    ▼
前端 ──[WS: user_message]──► 服务端 SelfAgentService
    │
    ▼
agent.prompt(message, images?)
    │
    ├── LLM 开始流式输出
    │   ├── text_delta 事件 ──► [WS: stream_delta] ──► 前端实时显示
    │   ├── thinking_delta ──► [WS: thinking_delta] ──► 前端推理区显示
    │   └── ...
    │
    ├── LLM 请求工具调用: write("sort.py", content)
    │   ├── [WS: tool_start] ──► 前端 Timeline 添加步骤（🔄）
    │   ├── 执行工具...
    │   └── [WS: tool_end] ──► 前端 Timeline 更新状态（✅）
    │
    ├── LLM 继续输出文本
    │   └── text_delta ──► 前端实时显示
    │
    └── turn_end
        └── [WS: turn_complete] ──► 前端标记消息完成
```

### 6.2 调度模式对话

```
用户开启调度模式 + 输入 "用 Claude Code 帮我重构 utils.ts"
    │
    ▼
agent.prompt(message)
    │
    ├── LLM 分析任务，决定调用 agent_dispatch
    │
    ├── tool_call: agent_dispatch({
    │       agentType: "claude-code",
    │       task: "重构 utils.ts，提取公共函数...",
    │   })
    │   ├── [WS: tool_start] ──► Timeline: "分发任务到 Claude Code"
    │   ├── AgentProcessManager 发送指令到 Claude Code 进程
    │   └── [WS: tool_end] ──► Timeline: ✅ "已分发"
    │
    └── LLM 输出: "已将重构任务分配给 Claude Code #1，
         你可以在 Agents 页面查看执行进度。"
```

## 7. 模型切换

```pseudo
function switchModel(provider, modelId, apiKey?, customUrl?):
    // 1. 创建新的 streamFn
    newStreamFn = createStreamFn({ provider, model: modelId, apiKey, customUrl })

    // 2. 切换 Agent 的 streamFn
    selfAgent.switchModel(newStreamFn)

    // 3. 持久化设置
    db.updateSetting("defaultProvider", provider)
    db.updateSetting("defaultModel", modelId)
```

支持的 Provider 列表（来自 pi-ai）：
- Anthropic (Claude 系列)
- OpenAI (GPT 系列)
- Google (Gemini 系列)
- xAI (Grok)
- Groq
- Cerebras
- 自定义 OpenAI 兼容 API

## 8. 会话管理

```pseudo
// 会话操作
createConversation():
    id = generateId()
    agent.resetState()    // 清空对话历史
    db.createConversation(id, timestamp)
    return id

loadConversation(id):
    messages = db.getMessages(id)
    agent.loadState(messages)  // 恢复对话历史到 Agent

deleteConversation(id):
    db.deleteConversation(id)
    if currentConversation == id:
        createConversation()   // 创建新对话
```

## 9. 中断与控制

- **用户中断**：用户点击"停止"按钮 → 调用 `agent.abort()` → 中止当前 LLM 流和工具执行
- **Steer 消息**：用户在 Agent 执行过程中发送新消息 → 调用 `agent.steer(message)` → 中断当前工具后传递
- **Follow-up**：Agent 完成当前轮后自动检查 followUp 队列

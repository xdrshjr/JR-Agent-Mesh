# 04 — 后台 Agent 进程管理

## 1. 概述

后台 Agent 是通过 CLI 进程方式运行的外部 Coding Agent（Claude Code、OpenCode、Codex 等）。AgentProcessManager 负责这些进程的完整生命周期管理。

## 2. Agent 类型注册表

### 2.1 注册表结构

```pseudo
interface AgentTypeConfig:
    id: string              // "claude-code" | "opencode" | "codex"
    displayName: string     // "Claude Code"
    command: string         // CLI 命令，如 "claude"
    args: string[]          // 默认参数，如 ["--print"] 或交互模式参数
    envMapping: Map<string, string>  // 环境变量映射，如 { "ANTHROPIC_API_KEY": "anthropic_key" }
    inputMode: "stdin" | "newline"   // 输入方式
    outputParser: OutputParser       // 输出解析器
    healthCheck?: string    // 健康检查命令，如 "claude --version"
    icon: string            // 显示图标
```

### 2.2 预置 Agent 类型

```pseudo
AGENT_REGISTRY = {
    "claude-code": {
        id: "claude-code",
        displayName: "Claude Code",
        command: "claude",
        args: [],                    // 交互模式
        envMapping: {
            "ANTHROPIC_API_KEY": "anthropic_key"
        },
        inputMode: "stdin",
        outputParser: ClaudeCodeParser,
        healthCheck: "claude --version",
        icon: "anthropic"
    },

    "opencode": {
        id: "opencode",
        displayName: "OpenCode",
        command: "opencode",
        args: [],
        envMapping: {
            "OPENAI_API_KEY": "openai_key"
        },
        inputMode: "stdin",
        outputParser: GenericCLIParser,
        healthCheck: "opencode --version",
        icon: "opencode"
    },

    "codex": {
        id: "codex",
        displayName: "Codex",
        command: "codex",
        args: [],
        envMapping: {
            "OPENAI_API_KEY": "openai_key"
        },
        inputMode: "stdin",
        outputParser: GenericCLIParser,
        healthCheck: "codex --version",
        icon: "codex"
    }
}
```

### 2.3 扩展新类型

添加新 Agent 类型只需在注册表中追加配置对象。未来可支持：
- 从 Settings UI 中添加自定义 Agent 类型
- 从配置文件加载

## 3. 进程生命周期

### 3.1 状态机

```
                 create
    ────────────────────►  STARTING
                              │
                     进程启动成功 │ 启动失败
                    ┌───────────┤────────────┐
                    ▼                        ▼
                RUNNING                   FAILED
                    │                        │
            ┌───────┼────────┐               │ 可重试
            │       │        │               ▼
        用户停止  进程崩溃  进程正常退出    STARTING
            │       │        │
            ▼       ▼        ▼
         STOPPED  CRASHED   EXITED
            │       │
            │       │ 可重启
            ▼       ▼
          STARTING (重新启动)
```

状态定义：
| 状态 | 描述 |
|------|------|
| `STARTING` | 进程正在启动，等待就绪信号 |
| `RUNNING` | 进程正常运行中，可接受输入 |
| `STOPPED` | 用户主动停止 |
| `CRASHED` | 进程异常退出 |
| `EXITED` | 进程正常退出（任务完成） |
| `FAILED` | 启动失败（命令不存在、权限问题等） |

### 3.2 创建进程

```pseudo
function createAgentProcess(typeId, name?, workDir?, initialPrompt?):
    config = AGENT_REGISTRY[typeId]
    if not config: throw "未知的 Agent 类型"

    // 1. 生成实例 ID 和名称
    instanceId = generateId()
    instanceName = name || "{config.displayName} #{nextIndex(typeId)}"

    // 2. 准备环境变量
    env = { ...process.env }
    for [envKey, credKey] in config.envMapping:
        credential = credentialStore.get(credKey)
        if credential:
            env[envKey] = credential

    // 3. 确定工作目录
    cwd = workDir || path.join(DATA_DIR, "workspaces", instanceId)
    ensureDirectory(cwd)

    // 4. 创建 PTY 进程
    pty = node_pty.spawn(config.command, config.args, {
        name: "xterm-256color",
        cols: 120,
        rows: 40,
        cwd: cwd,
        env: env,
    })

    // 5. 创建 AgentProcess 对象
    agentProcess = {
        id: instanceId,
        name: instanceName,
        typeId: typeId,
        status: "STARTING",
        pty: pty,
        workDir: cwd,
        createdAt: now(),
        outputBuffer: RingBuffer(maxSize: 100000),  // 保留最近 100K 字符
        outputLog: [],  // 结构化的输出日志（用于 Timeline）
    }

    // 6. 绑定事件
    pty.onData(data => handleOutput(agentProcess, data))
    pty.onExit(({exitCode}) => handleExit(agentProcess, exitCode))

    // 7. 标记运行中（简化：PTY 创建成功即视为运行中）
    agentProcess.status = "RUNNING"

    // 8. 持久化记录
    db.insertAgentProcess(agentProcess)

    // 9. 发送初始指令
    if initialPrompt:
        setTimeout(() => sendInput(instanceId, initialPrompt), 1000)  // 等待 CLI 就绪

    // 10. 通知所有前端
    broadcast("agent_created", agentProcess.toInfo())

    return agentProcess
```

### 3.3 输出处理

```pseudo
function handleOutput(agentProcess, rawData):
    // 1. 追加到原始输出缓冲区
    agentProcess.outputBuffer.append(rawData)

    // 2. 使用对应的 OutputParser 解析
    parsed = agentProcess.parser.parse(rawData)

    // parsed 可能是:
    //   { type: "text", content: "..." }
    //   { type: "tool_start", tool: "read", args: "src/index.ts" }
    //   { type: "tool_end", tool: "read", success: true, duration: 200 }
    //   { type: "thinking", content: "..." }
    //   { type: "raw", content: "..." }  // 无法解析的原始输出

    // 3. 追加到结构化日志
    agentProcess.outputLog.push({ timestamp: now(), ...parsed })

    // 4. 实时推送到前端
    broadcast("agent_output", {
        agentId: agentProcess.id,
        data: parsed
    })

    // 5. 持久化（定期批量写入，非每条）
    scheduleFlush(agentProcess)
```

### 3.4 发送输入

```pseudo
function sendInput(instanceId, text):
    agentProcess = getProcess(instanceId)
    if agentProcess.status != "RUNNING":
        throw "Agent 未在运行中"

    // 通过 PTY 写入
    agentProcess.pty.write(text + "\n")

    // 记录输入日志
    agentProcess.outputLog.push({
        timestamp: now(),
        type: "user_input",
        content: text
    })

    broadcast("agent_input", { agentId: instanceId, text })
```

### 3.5 停止进程

```pseudo
function stopProcess(instanceId):
    agentProcess = getProcess(instanceId)

    // 1. 优雅终止：先发 SIGTERM
    agentProcess.pty.kill("SIGTERM")

    // 2. 等待 5 秒
    waited = waitForExit(agentProcess, timeout: 5000)

    // 3. 如果没退出，强制终止
    if not waited:
        agentProcess.pty.kill("SIGKILL")

    agentProcess.status = "STOPPED"
    db.updateAgentStatus(instanceId, "STOPPED")
    broadcast("agent_status", { agentId: instanceId, status: "STOPPED" })
```

## 4. 输出解析器

### 4.1 接口定义

```pseudo
interface OutputParser:
    parse(rawData: string): ParsedOutput[]

interface ParsedOutput:
    type: "text" | "tool_start" | "tool_end" | "thinking" | "error" | "raw" | "user_input"
    content?: string
    tool?: string
    args?: string
    success?: boolean
    duration?: number
```

### 4.2 Claude Code 解析器

Claude Code CLI 的输出包含 ANSI 转义码和结构化的工具调用信息。解析器需要：
- 剥离 ANSI 转义码用于结构化解析
- 保留 ANSI 转义码用于终端风格显示
- 识别工具调用模式（如 "Reading file...", "Writing to...", "Running command..."）

```pseudo
class ClaudeCodeParser implements OutputParser:
    parse(rawData):
        stripped = stripAnsi(rawData)
        results = []

        // 匹配工具调用模式
        if match = stripped.match(/Reading (.+)\.\.\./):
            results.push({ type: "tool_start", tool: "read", args: match[1] })
        else if match = stripped.match(/Writing to (.+)/):
            results.push({ type: "tool_start", tool: "write", args: match[1] })
        else if match = stripped.match(/Running: (.+)/):
            results.push({ type: "tool_start", tool: "bash", args: match[1] })
        else:
            results.push({ type: "text", content: rawData })  // 保留 ANSI

        return results
```

### 4.3 通用 CLI 解析器

对于 OpenCode、Codex 等尚不确定输出格式的 Agent，使用通用解析器：

```pseudo
class GenericCLIParser implements OutputParser:
    parse(rawData):
        // 保留原始输出，类型标记为 raw
        return [{ type: "raw", content: rawData }]
```

随着对各 Agent CLI 输出格式的了解加深，可以替换为专用解析器。

## 5. 进程恢复

服务器重启时，之前运行的 Agent 进程已经丢失。恢复策略：

```pseudo
function recoverAgents():
    records = db.getAgentProcesses(status: ["RUNNING", "STARTING"])
    for record in records:
        // 标记为已停止（进程已不存在）
        db.updateAgentStatus(record.id, "STOPPED")

        // 通知前端
        broadcast("agent_status", {
            agentId: record.id,
            status: "STOPPED",
            reason: "server_restart"
        })

    // 注：不自动重启，由用户决定是否重新启动
```

## 6. 并发管理

- **最大进程数**：可配置，默认 10 个后台 Agent 同时运行
- **资源监控**：记录每个进程的 CPU 和内存使用（通过 pidusage），前端可查看
- **输出缓冲**：每个进程保留最近 100K 字符的输出，防止内存溢出

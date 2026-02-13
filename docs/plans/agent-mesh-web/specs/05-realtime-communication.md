# 05 — 实时通信协议设计

## 1. 概述

所有前后端实时交互通过 WebSocket 进行。采用统一的 JSON 消息协议，每条消息包含类型标识和负载数据。

## 2. 连接管理

### 2.1 连接建立

```pseudo
// 前端连接
WebSocket URL: ws://{host}:{port}/ws

// 连接建立后，服务端发送初始化消息
server → client: {
    type: "init",
    payload: {
        selfAgentStatus: "ready" | "initializing",
        activeAgents: [{ id, name, typeId, status }],
        currentConversationId: string | null,
    }
}
```

### 2.2 心跳机制

```pseudo
// 每 30 秒发送心跳
client → server: { type: "ping" }
server → client: { type: "pong" }

// 如果 60 秒未收到 pong，前端触发重连
```

### 2.3 断线重连

```pseudo
重连策略：指数退避
  第 1 次: 1 秒后重连
  第 2 次: 2 秒后重连
  第 3 次: 4 秒后重连
  第 4 次: 8 秒后重连
  最大间隔: 30 秒
  最大尝试: 无限（直到连接成功）

重连成功后：
  1. 服务端发送 init 消息（包含当前所有状态）
  2. 前端根据 init 消息恢复状态
  3. 如果之前有活跃对话，恢复对话流
```

## 3. 消息协议

### 3.1 通用消息格式

```pseudo
interface WebSocketMessage:
    type: string          // 消息类型
    payload: object       // 负载数据
    requestId?: string    // 请求-响应模式中的请求 ID
    timestamp: number     // Unix 毫秒时间戳
```

### 3.2 客户端 → 服务端消息

#### 自身 Agent 相关

```pseudo
// 发送用户消息
{
    type: "chat.send",
    payload: {
        conversationId: string,
        content: string,
        attachments?: [{ fileId: string, filename: string }]
    }
}

// 中断当前执行
{
    type: "chat.abort",
    payload: { conversationId: string }
}

// Steer 消息（执行中发送）
{
    type: "chat.steer",
    payload: {
        conversationId: string,
        content: string
    }
}

// 切换模型
{
    type: "chat.switch_model",
    payload: {
        provider: string,
        model: string
    }
}

// 创建新对话
{
    type: "chat.new_conversation",
    payload: {}
}

// 加载历史对话
{
    type: "chat.load_conversation",
    payload: { conversationId: string }
}

// 切换调度模式
{
    type: "chat.toggle_dispatch",
    payload: { enabled: boolean }
}
```

#### 后台 Agent 相关

```pseudo
// 创建后台 Agent
{
    type: "agent.create",
    requestId: "req-123",
    payload: {
        typeId: string,        // "claude-code" | "opencode" | "codex"
        name?: string,
        workDir?: string,
        initialPrompt?: string
    }
}

// 向后台 Agent 发送输入
{
    type: "agent.send_input",
    payload: {
        agentId: string,
        text: string
    }
}

// 停止后台 Agent
{
    type: "agent.stop",
    payload: { agentId: string }
}

// 重启后台 Agent
{
    type: "agent.restart",
    payload: { agentId: string }
}

// 删除后台 Agent（停止并删除记录）
{
    type: "agent.delete",
    payload: { agentId: string }
}

// 请求 Agent 历史输出（重连后或首次查看）
{
    type: "agent.get_output",
    requestId: "req-456",
    payload: {
        agentId: string,
        fromIndex?: number    // 从第几条输出开始
    }
}
```

#### 文件相关

```pseudo
// 上传文件（先通过 HTTP POST /api/upload 上传，获得 fileId）
// 此消息通知 Agent 有文件可用
{
    type: "file.uploaded",
    payload: {
        fileId: string,
        filename: string,
        size: number,
        conversationId: string
    }
}
```

#### 设置相关

```pseudo
// 更新设置（通过 REST API 完成，WebSocket 用于通知）
// 前端直接调用 REST API
```

### 3.3 服务端 → 客户端消息

#### 自身 Agent 对话流

```pseudo
// 流式文本输出
{
    type: "chat.stream_delta",
    payload: {
        conversationId: string,
        messageId: string,
        delta: string           // 增量文本
    }
}

// 推理/思考输出
{
    type: "chat.thinking_delta",
    payload: {
        conversationId: string,
        messageId: string,
        delta: string
    }
}

// 工具调用开始
{
    type: "chat.tool_start",
    payload: {
        conversationId: string,
        messageId: string,
        toolCallId: string,
        tool: string,           // "read" | "write" | "edit" | "bash" | ...
        args: object            // 工具参数
    }
}

// 工具调用结束
{
    type: "chat.tool_end",
    payload: {
        conversationId: string,
        messageId: string,
        toolCallId: string,
        tool: string,
        success: boolean,
        result?: string,        // 结果摘要（非完整输出）
        duration: number        // 毫秒
    }
}

// 消息完成
{
    type: "chat.message_complete",
    payload: {
        conversationId: string,
        messageId: string,
        usage?: {
            inputTokens: number,
            outputTokens: number,
            cost?: number
        }
    }
}

// 文件可下载
{
    type: "chat.file_ready",
    payload: {
        conversationId: string,
        messageId: string,
        fileId: string,
        filename: string,
        size: number,
        downloadUrl: string     // "/api/download/{fileId}"
    }
}

// 错误
{
    type: "chat.error",
    payload: {
        conversationId: string,
        error: string,
        code?: string           // "llm_error" | "tool_error" | "rate_limit"
    }
}
```

#### 后台 Agent 事件

```pseudo
// Agent 创建成功
{
    type: "agent.created",
    requestId: "req-123",      // 对应请求
    payload: {
        id: string,
        name: string,
        typeId: string,
        status: "RUNNING",
        workDir: string,
        createdAt: number
    }
}

// Agent 实时输出
{
    type: "agent.output",
    payload: {
        agentId: string,
        data: {
            type: "text" | "tool_start" | "tool_end" | "thinking" | "error" | "raw",
            content?: string,
            tool?: string,
            args?: string,
            success?: boolean,
            duration?: number
        },
        index: number           // 输出序号，用于排序和去重
    }
}

// Agent 状态变更
{
    type: "agent.status",
    payload: {
        agentId: string,
        status: "RUNNING" | "STOPPED" | "CRASHED" | "EXITED" | "FAILED",
        reason?: string,
        exitCode?: number
    }
}

// Agent 历史输出响应
{
    type: "agent.output_history",
    requestId: "req-456",
    payload: {
        agentId: string,
        outputs: ParsedOutput[],
        totalCount: number
    }
}
```

#### 系统消息

```pseudo
// 初始化
{ type: "init", payload: { ... } }

// 心跳
{ type: "pong" }

// 系统通知
{
    type: "system.notification",
    payload: {
        level: "info" | "warning" | "error",
        title: string,
        message: string,
        sound?: boolean         // 是否播放声音
    }
}
```

## 4. 前端 WebSocket 客户端

### 4.1 封装设计

```pseudo
class WebSocketClient:
    private ws: WebSocket
    private listeners: Map<string, Function[]>
    private reconnectTimer: Timer
    private requestCallbacks: Map<string, Function>  // requestId → callback

    connect(url):
        ws = new WebSocket(url)
        ws.onopen = () => {
            resetReconnect()
            emit("connected")
        }
        ws.onclose = () => {
            emit("disconnected")
            scheduleReconnect()
        }
        ws.onmessage = (event) => {
            msg = JSON.parse(event.data)
            // 处理请求-响应回调
            if msg.requestId and requestCallbacks.has(msg.requestId):
                requestCallbacks.get(msg.requestId)(msg.payload)
                requestCallbacks.delete(msg.requestId)
            // 触发类型监听器
            emit(msg.type, msg.payload)
        }

    send(type, payload, requestId?):
        ws.send(JSON.stringify({ type, payload, requestId, timestamp: Date.now() }))

    // 请求-响应模式
    request(type, payload): Promise<any>
        requestId = generateRequestId()
        return new Promise(resolve => {
            requestCallbacks.set(requestId, resolve)
            send(type, payload, requestId)
        })

    on(type, callback):
        listeners.get(type).push(callback)

    off(type, callback):
        listeners.get(type).remove(callback)
```

### 4.2 React 集成

```pseudo
// WebSocketProvider 上下文
WebSocketProvider:
    state:
        connected: boolean
        client: WebSocketClient

    useEffect:
        client = new WebSocketClient()
        client.connect(wsUrl)
        return () => client.disconnect()

    provide: { client, connected }

// 使用 Hook
function useWebSocket():
    return useContext(WebSocketContext)

// 特定消息订阅 Hook
function useWSEvent(type, callback):
    { client } = useWebSocket()
    useEffect:
        client.on(type, callback)
        return () => client.off(type, callback)
```

## 5. 流量控制

- **输出节流**：后台 Agent 高频输出时，服务端每 50ms 合并一次推送，避免消息风暴
- **大消息分片**：单条消息超过 64KB 时，分片发送，前端重组
- **背压处理**：WebSocket 发送缓冲区超过 1MB 时，暂停 Agent 输出捕获，待缓冲区清空后恢复

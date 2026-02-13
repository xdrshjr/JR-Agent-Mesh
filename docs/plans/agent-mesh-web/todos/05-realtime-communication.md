# TODO: 05 — 实时通信

> 对应 Spec: `specs/05-realtime-communication.md`

## WebSocket 服务端

- [ ] 实现 `server/websocket/server.ts` — WebSocket 服务器初始化（基于 ws 库）
- [ ] 绑定到 HTTP Server 的 upgrade 事件
- [ ] 实现连接管理（维护活跃连接列表）
- [ ] 实现 `broadcast()` — 向所有连接广播消息
- [ ] 实现连接关闭清理

## 消息协议

- [ ] 定义 `shared/types.ts` — 所有 WebSocket 消息类型的 TypeScript 类型
- [ ] 实现 `server/websocket/protocol.ts` — 消息序列化/反序列化
- [ ] 实现 `server/websocket/handler.ts` — 消息路由（根据 type 分发到对应处理函数）

## 客户端 → 服务端消息处理

- [ ] 处理 `chat.send` — 转发到 SelfAgentService
- [ ] 处理 `chat.abort` — 调用 SelfAgentService.abort()
- [ ] 处理 `chat.steer` — 调用 SelfAgentService.steer()
- [ ] 处理 `chat.switch_model` — 调用 SelfAgentService.switchModel()
- [ ] 处理 `chat.new_conversation` — 创建新对话
- [ ] 处理 `chat.load_conversation` — 加载历史对话
- [ ] 处理 `chat.toggle_dispatch` — 切换调度模式
- [ ] 处理 `agent.create` — 调用 AgentProcessManager.createProcess()
- [ ] 处理 `agent.send_input` — 调用 AgentProcessManager.sendInput()
- [ ] 处理 `agent.stop` — 调用 AgentProcessManager.stopProcess()
- [ ] 处理 `agent.restart` — 调用 AgentProcessManager.restartProcess()
- [ ] 处理 `agent.delete` — 调用 AgentProcessManager.deleteProcess()
- [ ] 处理 `agent.get_output` — 返回 Agent 历史输出
- [ ] 处理 `ping` — 返回 `pong`

## 服务端 → 客户端消息推送

- [ ] 实现 init 消息（连接建立时发送当前状态）
- [ ] 实现 chat 相关事件推送（stream_delta, thinking_delta, tool_start, tool_end, message_complete, file_ready, error）
- [ ] 实现 agent 相关事件推送（created, output, status, output_history）
- [ ] 实现 system.notification 推送

## 心跳机制

- [ ] 实现服务端心跳检测（30 秒周期）
- [ ] 60 秒未收到 pong 则关闭连接
- [ ] 前端发送 ping，接收 pong

## 前端 WebSocket 客户端

- [ ] 实现 `src/lib/websocket-client.ts` — WebSocketClient 类
- [ ] 实现连接建立和消息解析
- [ ] 实现事件监听器注册/注销（on/off）
- [ ] 实现请求-响应模式（requestId 回调匹配）
- [ ] 实现断线自动重连（指数退避：1s → 2s → 4s → 8s → 最大 30s）
- [ ] 实现 `WebSocketProvider` React 上下文组件
- [ ] 实现 `useWebSocket` Hook
- [ ] 实现 `useWSEvent` Hook（订阅特定消息类型）

## 流量控制

- [ ] 实现服务端输出节流（50ms 合并推送）
- [ ] 实现大消息分片（超过 64KB）
- [ ] 实现背压处理（发送缓冲区超 1MB 时暂停捕获）

# TODO: 03 — 自身 Agent

> 对应 Spec: `specs/03-self-agent.md`

## pi-mono 集成

- [ ] 安装并验证 `@mariozechner/pi-agent-core` 和 `@mariozechner/pi-ai` 包可正常导入
- [ ] 研究 pi-agent-core 的 Agent 类 API，确认 streamFn、tools、事件系统的使用方式
- [ ] 研究 pi-ai 的 streamSimple / createStreamFn API，确认多 Provider 调用方式

## SelfAgentService 实现

- [ ] 实现 `server/services/self-agent.ts` — SelfAgentService 类
- [ ] 实现 `initAgent()` — 根据当前设置和凭证创建 Agent 实例
- [ ] 实现 `createStreamFn()` — 根据 Provider/Model/API Key 创建 LLM 调用函数
- [ ] 实现多 Provider 支持（Anthropic, OpenAI, Google, xAI, Groq, Custom）
- [ ] 实现 `switchModel()` — 运行时切换 LLM 模型
- [ ] 实现默认 System Prompt（含调度模式条件注入）

## 内置工具

- [ ] 注册 pi-mono 内置工具：read, write, edit, bash
- [ ] 实现自定义工具 `file_transfer` — 将服务器文件发送给用户下载
- [ ] 实现自定义工具 `agent_dispatch` — 将任务分发给后台 Agent
- [ ] agent_dispatch 工具仅在调度模式开启时注册

## 事件转发（Agent → WebSocket → 前端）

- [ ] 监听 `message_update` 事件，转发流式文本 delta 到 WebSocket
- [ ] 监听 `tool_call` 事件，转发工具调用开始到 WebSocket
- [ ] 监听 `tool_result` 事件，转发工具调用结果到 WebSocket
- [ ] 监听 `turn_end` 事件，转发消息完成到 WebSocket
- [ ] 处理 thinking/推理内容的转发

## 对话管理

- [ ] 实现 `createConversation()` — 创建新对话，重置 Agent 状态
- [ ] 实现 `loadConversation()` — 从数据库加载历史对话到 Agent
- [ ] 实现 `deleteConversation()` — 删除对话
- [ ] 实现消息持久化 — 每轮对话完成后保存到 SQLite

## 用户交互

- [ ] 实现 `handleUserMessage()` — 接收用户消息，调用 agent.prompt()
- [ ] 实现 `handleAbort()` — 用户中断，调用 agent.abort()
- [ ] 实现 `handleSteer()` — 用户在执行中发送 steer 消息
- [ ] 实现附件处理 — 用户上传的文件路径注入到消息上下文

## 调度模式

- [ ] 实现调度模式开关逻辑（启用时注册 agent_dispatch 工具，关闭时移除）
- [ ] 实现 System Prompt 动态更新（调度模式开启时追加后台 Agent 信息）
- [ ] agent_dispatch 工具与 AgentProcessManager 的集成

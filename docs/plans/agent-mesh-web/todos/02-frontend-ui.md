# TODO: 02 — 前端界面

> 对应 Spec: `specs/02-frontend-ui.md`

## 基础设施

- [ ] 安装 shadcn/ui：初始化配置，设置 Tailwind CSS v4
- [ ] 安装 Zustand 状态管理
- [ ] 配置全局字体（Inter + JetBrains Mono）
- [ ] 配置色彩系统（CSS 变量：primary, surface, border, text 等）
- [ ] 配置全局样式（globals.css）

## 布局组件

- [ ] 实现 `MobileGuard` 组件 — 检测屏幕宽度 < 768px，显示不支持移动端提示
- [ ] 实现根 `layout.tsx` — 包含 MobileGuard + WebSocketProvider + 整体布局
- [ ] 实现 `TopBar` 组件 — Logo + 项目名 + 通知铃铛 + 声音开关 + 设置快捷入口
- [ ] 实现 `Sidebar` 组件 — 导航菜单 + 活跃 Agent 列表 + 连接状态
- [ ] 实现 `NavMenu` 组件 — Chat / Agents / Settings 三个导航项
- [ ] 实现 `ConnectionStatus` 组件 — WebSocket 连接状态指示灯

## Chat 页面

- [ ] 实现 `ChatPage` 页面组件
- [ ] 实现 `ModelSelector` 组件 — Provider 下拉 + Model 下拉 + 调度模式开关
- [ ] 实现 `ConversationList` 组件 — 左侧历史会话列表（可折叠面板）
- [ ] 实现 `MessageArea` 组件 — 消息列表容器，自动滚动
- [ ] 实现 `MessageBubble` 组件 — 单条消息（区分 user/assistant 样式）
- [ ] 实现 `MarkdownRenderer` 组件 — Markdown 渲染 + 代码高亮
- [ ] 实现 `ToolTimeline` 组件 — 工具调用时间线（折叠/展开）
- [ ] 实现 `ToolStep` 组件 — 单步工具调用（图标 + 名称 + 参数 + 耗时 + 状态）
- [ ] 实现 `FileAttachment` 组件 — 文件卡片（图标 + 文件名 + 大小 + 下载）
- [ ] 实现 `TypingIndicator` 组件 — Agent 正在输出时的加载动画
- [ ] 实现 `InputArea` 组件 — 多行输入框 + 附件按钮 + 发送按钮
- [ ] 实现 `AttachmentPreview` 组件 — 已选附件预览条

## Agents 管理页面

- [ ] 实现 `AgentsPage` 页面组件
- [ ] 实现 `AgentToolbar` 组件 — 新建按钮 + 状态筛选
- [ ] 实现 `AgentTabBar` 组件 — 标签栏（可拖拽排序）
- [ ] 实现 `AgentTab` 组件 — 单个标签（名称 + 状态灯 + 关闭按钮）
- [ ] 实现 `AgentDetailPanel` 组件 — Agent 详情面板容器
- [ ] 实现 `AgentInfoBar` 组件 — Agent 信息栏（状态、工作目录、PID、运行时长、操作按钮）
- [ ] 实现 `AgentOutputArea` 组件 — 终端风格输出显示区域
- [ ] 实现 `AnsiRenderer` 组件 — ANSI 转义码渲染为 HTML
- [ ] 实现 `AgentInputBox` 组件 — 向 Agent 发送指令的输入框
- [ ] 实现 `CreateAgentDialog` 组件 — 新建 Agent 弹窗（类型选择 + 名称 + 工作目录 + 初始指令）

## Settings 页面

- [ ] 实现 `SettingsPage` 页面组件
- [ ] 实现 `SettingsTabs` 组件 — 设置分类标签（自身Agent / 后台Agent / 通知 / 通用）
- [ ] 实现 `SelfAgentSettings` 组件 — Provider/Model 选择器 + 自定义 LLM + System Prompt
- [ ] 实现 `CredentialEditor` 组件 — 凭证列表 + 编辑/删除 + 添加
- [ ] 实现 `BackendAgentSettings` 组件 — Agent 类型配置（CLI 路径等）
- [ ] 实现 `NotificationSettings` 组件 — 声音/浏览器通知开关
- [ ] 实现 `GeneralSettings` 组件 — 数据保留天数 + 导入/导出

## 状态管理

- [ ] 实现 `chat-store.ts` — 对话状态（消息列表、当前对话、流式状态）
- [ ] 实现 `agent-store.ts` — Agent 列表状态（活跃 Agent、选中 Agent）
- [ ] 实现 `settings-store.ts` — 设置状态（本地缓存 + 服务端同步）

## Hooks

- [ ] 实现 `use-websocket.ts` — WebSocket 连接管理 Hook
- [ ] 实现 `use-self-agent.ts` — 自身 Agent 交互 Hook（发送消息、切换模型、中断等）
- [ ] 实现 `use-agent-manager.ts` — 后台 Agent 管理 Hook（创建、停止、发送输入等）

## 快捷键

- [ ] 实现全局快捷键监听（Ctrl+Enter, Ctrl+N, Ctrl+K, Ctrl+1/2/3, Escape）

## 通知

- [ ] 实现声音通知系统（预置提示音，可开关）
- [ ] 实现浏览器 Notification API 集成
- [ ] 实现 Toast 通知组件（右上角弹出通知）

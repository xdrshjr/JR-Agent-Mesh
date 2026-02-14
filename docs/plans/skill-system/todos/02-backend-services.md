# TODO 02: 后端服务

> 对应 spec: [specs/02-backend-services.md](../specs/02-backend-services.md)

## SkillManagementService

- [ ] 创建 `server/services/skill-management.ts`
  - [ ] 实现 `constructor(dataDir)` 和目录路径计算
  - [ ] 实现 `ensureDirectories()` 创建 installed/ 和 custom/ 目录
  - [ ] 实现 `getAll(userId)` 获取所有 skill
  - [ ] 实现 `getById(id)` 获取单个 skill
  - [ ] 实现 `create(params)` 创建 skill（写文件 + 写 DB）
  - [ ] 实现 `update(id, params)` 更新 skill 元数据
  - [ ] 实现 `delete(id)` 删除 skill（删文件 + 删 DB）
  - [ ] 实现 `setGlobalActivation(id, active)` 全局激活/取消
  - [ ] 实现 `activateForConversation(skillId, conversationId)` 会话级激活
  - [ ] 实现 `deactivateForConversation(skillId, conversationId)` 会话级取消
  - [ ] 实现 `getConversationActivations(conversationId)` 获取会话级激活列表
  - [ ] 实现 `getActiveSkillContents(userId, conversationId)` 获取有效 skill 内容
  - [ ] 实现 `getSkillContent(id)` 读取单个 skill 文件内容

## SelfAgentService 改造

- [ ] 扩展 `SelfAgentServiceOptions` 添加 `skillManagementService` 字段
- [ ] 修改 `constructor` 接收并保存 `skillManagementService`
- [ ] 修改 `buildSystemPrompt()` 注入激活的 skill 内容
- [ ] 添加 `refreshSystemPrompt()` 方法
- [ ] 添加 token 预算保护逻辑（50000 字符上限）
- [ ] 在 `loadConversation()` 时调用 `refreshSystemPrompt()`
- [ ] 在 `createConversation()` 时调用 `refreshSystemPrompt()`

## REST API 端点

- [ ] 在 `server/express-app.ts` 中添加以下端点：
  - [ ] `GET /api/skills` — 获取所有 skill
  - [ ] `GET /api/skills/:id` — 获取单个 skill 详情
  - [ ] `GET /api/skills/:id/content` — 获取 skill 文件内容
  - [ ] `POST /api/skills` — 创建 skill（从对话保存）
  - [ ] `PUT /api/skills/:id` — 更新 skill 元数据（含内容更新）
  - [ ] `DELETE /api/skills/:id` — 删除 skill
  - [ ] `POST /api/skills/install` — 从 Git 安装 skill
  - [ ] `POST /api/skills/:id/update` — 从 Git 更新 skill
  - [ ] `PUT /api/skills/:id/global` — 设置/取消全局激活
  - [ ] `POST /api/skills/:id/activate` — 会话级激活
  - [ ] `POST /api/skills/:id/deactivate` — 会话级取消激活
  - [ ] `GET /api/skills/active/:conversationId` — 获取会话有效 skill
  - [ ] `POST /api/skills/generate` — AI 从对话生成 skill 草稿
- [ ] 扩展 `ExpressAppOptions` 添加 `skillManagementService` 字段

## 服务初始化

- [ ] 在 `server/index.ts` 中初始化 `SkillManagementService`
- [ ] 将 `skillManagementService` 传递给 `SelfAgentService`
- [ ] 将 `skillManagementService` 传递给 `createExpressApp()`

## WebSocket Handler

- [ ] 在 `server/websocket/chat-handlers.ts` 中添加 `chat.set_session_skills` handler
- [ ] handler 调用 `selfAgentService.refreshSystemPrompt()` 刷新系统提示

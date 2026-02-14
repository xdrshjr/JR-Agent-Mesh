# TODO 04: 前端聊天集成

> 对应 spec: [specs/04-frontend-chat-integration.md](../specs/04-frontend-chat-integration.md)

## Model Selector 栏 — Skill 查看按钮

- [ ] 修改 `src/components/chat/model-selector.tsx`
  - [ ] 导入 Skill Store
  - [ ] 添加 Skill 按钮（Zap 图标 + "Skills" 文字）
  - [ ] 显示激活 skill 数量 badge
  - [ ] 点击打开 SkillViewDialog

## SkillViewDialog

- [ ] 创建 `src/components/chat/skill-view-dialog.tsx`
  - [ ] Global Skills 区域
    - [ ] 列出 isGlobal=true 的 skill
    - [ ] 点击展开内容摘要
  - [ ] Session Skills 区域
    - [ ] 列出当前会话级激活的 skill
    - [ ] 每个 skill 右侧 "取消" 按钮
    - [ ] "+ Add skill to this session" 按钮
  - [ ] Add Skill 交互
    - [ ] 展示未激活的 skill 列表
    - [ ] 点击激活
    - [ ] 调用 POST /api/skills/:id/activate
  - [ ] 底部 "Manage all skills →" 链接
  - [ ] 弹窗打开时加载数据

## Input Area — 保存为 Skill 按钮

- [ ] 修改 `src/components/chat/input-area.tsx`
  - [ ] 在工具栏 Clear 按钮左侧添加 "Save as Skill" 按钮
  - [ ] BookmarkPlus 图标 + 文字
  - [ ] 控制可用条件（有消息时才可用）
  - [ ] 点击调用 POST /api/skills/generate
  - [ ] Loading 状态管理
  - [ ] 成功后打开 SaveSkillDialog

## SaveSkillDialog

- [ ] 创建 `src/components/chat/save-skill-dialog.tsx`
  - [ ] Name 输入框（AI 生成的名称）
  - [ ] Description 输入框（AI 生成的描述）
  - [ ] Content textarea（monospace，min-height 300px）
  - [ ] "Activate globally" 复选框（默认勾选）
  - [ ] Cancel / Save Skill 按钮
  - [ ] 保存逻辑：POST /api/skills + 可选 PUT /api/skills/:id/global
  - [ ] 成功 toast + 关闭弹窗

## WebSocket 消息

- [ ] 在 `shared/types.ts` 中添加 `ChatSetSessionSkillsPayload` 接口
- [ ] 在 `shared/types.ts` 的 `ClientMessageType` 中添加 `'chat.set_session_skills'`
- [ ] 在前端 WebSocket 层添加发送 session skills 变更通知的逻辑

## Skill Store 扩展

- [ ] 在 `src/stores/skill-store.ts` 中添加会话级 skill 状态
  - [ ] `conversationSkills: Record<string, string[]>`
  - [ ] `fetchConversationSkills(conversationId)` 方法
  - [ ] `activateForConversation(skillId, conversationId)` 方法
  - [ ] `deactivateForConversation(skillId, conversationId)` 方法
  - [ ] `generateSkillDraft(conversationId)` 方法
  - [ ] `saveSkill(name, description, content, conversationId)` 方法

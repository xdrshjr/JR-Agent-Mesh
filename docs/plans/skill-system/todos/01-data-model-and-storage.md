# TODO 01: 数据模型与存储

> 对应 spec: [specs/01-data-model-and-storage.md](../specs/01-data-model-and-storage.md)

## 数据库 Schema

- [ ] 在 `server/db/schema.ts` 中添加 `skills` 表定义
- [ ] 在 `server/db/schema.ts` 中添加 `skillActivations` 表定义
- [ ] 运行 `npm run db:generate` 生成迁移文件
- [ ] 运行 `npm run db:migrate` 验证迁移成功

## Repository

- [ ] 创建 `server/db/repositories/skill-repository.ts`
  - [ ] 实现 `create(skill)` 方法
  - [ ] 实现 `getById(id)` 方法
  - [ ] 实现 `getAll(userId)` 方法
  - [ ] 实现 `getBySource(userId, source)` 方法
  - [ ] 实现 `update(id, fields)` 方法
  - [ ] 实现 `delete(id)` 方法
  - [ ] 实现 `setGlobal(id, isGlobal)` 方法
  - [ ] 实现 `getActiveForConversation(userId, conversationId)` 方法
  - [ ] 实现 `activateForConversation(skillId, conversationId, userId)` 方法
  - [ ] 实现 `deactivateForConversation(skillId, conversationId)` 方法
  - [ ] 实现 `getConversationActivations(conversationId)` 方法
- [ ] 在 `server/db/repositories/index.ts` 中导出 `SkillRepository`

## 目录初始化

- [ ] 在 `server/index.ts` 启动阶段创建 `data/skills/installed/` 目录
- [ ] 在 `server/index.ts` 启动阶段创建 `data/skills/custom/` 目录

## 共享类型

- [ ] 在 `shared/types.ts` 中添加 `SkillInfo` 接口定义

# TODO 05: Skill 分发机制

> 对应 spec: [specs/05-skill-dispatch.md](../specs/05-skill-dispatch.md)

## Agent Dispatch Tool 改造

- [ ] 修改 `createAgentDispatchTool()` 签名，添加 `skillManagementService` 参数
- [ ] 在 `execute()` 中获取当前会话的有效 skill 内容
- [ ] 实现 `buildEnhancedTask(originalTask, skills)` 函数
  - [ ] 将 skill 内容格式化为 markdown（# Reference Skills）
  - [ ] 将原始任务以 # Task 引入
  - [ ] 空 skill 时直接返回原始任务
- [ ] 添加内容大小限制（30000 字符上限）
- [ ] 超限时添加截断提示

## 依赖传递

- [ ] 修改 `SelfAgentService.buildTools()` 中的 `createAgentDispatchTool()` 调用
  - [ ] 传入 `skillManagementService` 实例
- [ ] 更新 `AgentDispatchContext` 类型（如需）

## 验证

- [ ] 验证无 skill 激活时 dispatch 行为不变
- [ ] 验证有 skill 激活时 dispatch 任务前置 skill 内容
- [ ] 验证 skill 内容超限时正确截断

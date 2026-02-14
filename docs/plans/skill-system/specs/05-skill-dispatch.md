# Spec 05: Skill 分发机制

## 1. 概述

定义 Dispatch Mode 下，如何将激活的 Skill 传递给后端 Agent（claude-code、opencode、codex），使其也能获得 skill 的指令增强。

## 2. 设计原则

- **不侵入 Agent 环境**：不修改被分发 agent 的工作目录、不覆盖其 `.claude/skills/` 等配置
- **内容追加**：将 skill 内容以文本形式追加在分发的 task 指令前面
- **选择性分发**：只分发当前会话的有效 skill（全局 + 会话级）
- **透明可见**：分发的 skill 内容在 agent dispatch 的工具调用参数中可见

## 3. 分发机制

### 3.1 修改 agent_dispatch 工具

修改 `server/services/tools/custom-tools.ts` 中的 `createAgentDispatchTool()`，在发送任务时自动注入 skill 内容。

### 3.2 注入流程（伪代码）

```
function execute(toolCallId, params):
    // ... 现有逻辑：找到或创建 agent ...

    // 新增：获取当前会话的有效 skill
    ctx = getContext()
    skills = skillManagementService.getActiveSkillContents(
        'default',
        ctx.conversationId
    )

    // 构建增强后的任务指令
    enhancedTask = buildEnhancedTask(params.task, skills)

    // 发送给 agent
    agentProcessManager.sendInput(agent.id, enhancedTask)

    return textResult(...)
```

### 3.3 增强任务指令的格式

```
function buildEnhancedTask(originalTask, skills):
    if skills.length == 0:
        return originalTask

    enhanced = "# Reference Skills\n\n"
    enhanced += "The following skills provide context and guidelines for this task:\n\n"

    for skill in skills:
        enhanced += "---\n"
        enhanced += `## ${skill.name}\n\n`
        enhanced += skill.content
        enhanced += "\n\n"

    enhanced += "---\n\n"
    enhanced += "# Task\n\n"
    enhanced += originalTask

    return enhanced
```

**格式说明：**
- Skill 内容放在任务指令**之前**，以 `# Reference Skills` 标题开始
- 每个 skill 以 `## skill名称` 分隔
- 任务本身以 `# Task` 标题引入
- 使用 markdown 格式而非 XML 标签，因为后端 agent 可能不支持 XML 标签解析

### 3.4 示例

用户通过 self-agent 分发任务 "Review the auth module for security issues"，且激活了 "Code Review" skill：

**发送给 claude-code agent 的实际内容：**

```markdown
# Reference Skills

The following skills provide context and guidelines for this task:

---
## Code Review

# Code Review

## Overview
Use this skill when reviewing code for quality, security, and maintainability.

## Guidelines
- Check for security vulnerabilities (OWASP top 10)
- Verify error handling completeness
- Assess code readability and naming conventions

---

# Task

Review the auth module for security issues
```

## 4. 依赖传递

### 4.1 createAgentDispatchTool 签名变更

```
// 修改前
createAgentDispatchTool(agentProcessManager, getContext)

// 修改后
createAgentDispatchTool(agentProcessManager, skillManagementService, getContext)
```

需要将 `SkillManagementService` 实例传入工具工厂函数。

### 4.2 AgentDispatchContext 扩展

```
interface AgentDispatchContext:
    conversationId?: string
    dataDir: string
    // 无需扩展 — skillManagementService 直接传入工厂函数
```

### 4.3 调用链

```
server/index.ts
  → SelfAgentService constructor
    → buildTools(includeDispatch=true)
      → createAgentDispatchTool(agentProcessManager, skillManagementService, getContext)
        → execute() 时调用 skillManagementService.getActiveSkillContents()
```

## 5. 性能与大小控制

### 5.1 内容大小限制

分发给后端 agent 的 skill 内容应控制总大小：

- 最大总字符数：30000 字符（约 7500 tokens）
- 超过时，按激活顺序截取，不包含超出的 skill
- 在增强任务中标注："(Some skills were omitted due to size limits)"

### 5.2 缓存

由于同一会话中多次 dispatch 的 skill 内容通常不变，可在 `SkillManagementService` 中缓存 `getActiveSkillContents()` 的结果：

- 缓存 key：`${userId}:${conversationId}`
- 缓存失效条件：skill 激活/取消操作、skill 内容更新

初期可不实现缓存，因为 skill 文件通常很小，读取开销可忽略。

## 6. 不做的事情

- **不自动同步 skill 文件到 agent 工作目录** — 避免影响 agent 自身的 skill 配置
- **不通过 agent 的 skill 系统加载** — 每个 agent（claude-code、codex）有自己的 skill 加载机制，我们不干预
- **不做 agent 特定适配** — 所有 agent 都以相同方式接收增强任务（文本前置）

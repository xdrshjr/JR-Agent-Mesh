# Spec 01: 数据模型与存储

## 1. 概述

定义 Skill 系统的数据模型、数据库 schema 和文件存储结构。设计需兼顾当前单用户场景和未来多用户扩展。

## 2. 文件存储结构

Skill 文件存储在项目的 `data/skills/` 目录下，分为两类：

```
data/skills/
├── installed/                    # 从 Git 仓库安装的 skill
│   ├── code-review/              # 目录名 = skill 名（kebab-case）
│   │   ├── .git/                 # 保留完整 Git 信息，用于后续更新
│   │   ├── skill.md              # 主 skill 文件（Claude Code 标准格式）
│   │   ├── README.md             # 仓库说明（可选）
│   │   └── ...                   # 仓库其他文件
│   ├── debugging-expert/
│   │   └── ...
│   └── ...
└── custom/                       # 用户从对话中保存的 skill
    ├── react-best-practices.md   # 文件名 = skill 名（kebab-case）
    ├── api-design-patterns.md
    └── ...
```

### 2.1 Skill 文件格式

遵循 Claude Code 标准 markdown 格式。文件内容直接作为 AI 的指令/上下文注入。

**示例 — installed skill（`data/skills/installed/code-review/skill.md`）：**

```markdown
# Code Review

## Overview
Use this skill when reviewing code for quality, security, and maintainability.

## When to Use
- When the user asks to review code
- When the user submits a PR for review

## Guidelines
- Check for security vulnerabilities (OWASP top 10)
- Verify error handling completeness
- Assess code readability and naming conventions
- ...
```

**示例 — custom skill（`data/skills/custom/react-best-practices.md`）：**

```markdown
# React Best Practices

## Overview
Apply React best practices when writing or reviewing React code.

## Key Principles
- Use functional components with hooks
- Keep components small and focused
- ...
```

### 2.2 Git 仓库结构约定

AI Agent 在安装时会自动处理以下几种常见仓库结构：

1. **单 skill 仓库**：根目录有 `skill.md` 或单个 `.md` 文件
2. **多 skill 仓库**：根目录有多个 `.md` 文件或子目录，每个包含一个 skill
3. **非标准仓库**：AI Agent 自行判断哪些文件是 skill 内容

对于多 skill 仓库，AI Agent 会为每个 skill 创建独立的数据库记录，但共享同一个 Git 目录。

## 3. 数据库 Schema

### 3.1 skills 表

```typescript
// server/db/schema.ts

export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),                    // UUID
  name: text('name').notNull(),                   // 显示名称
  description: text('description'),               // 简短描述
  source: text('source').notNull(),               // 'git' | 'conversation'
  gitUrl: text('git_url'),                        // Git 仓库 URL（source='git' 时）
  gitDir: text('git_dir'),                        // Git clone 目录名（相对于 data/skills/installed/）
  filePath: text('file_path').notNull(),          // skill 文件路径（相对于 data/skills/）
  conversationId: text('conversation_id'),        // 来源会话 ID（source='conversation' 时）
  userId: text('user_id').notNull().default('default'),  // 用户 ID（预留多用户）
  isGlobal: integer('is_global').notNull().default(0),   // 是否全局激活
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_skills_user').on(table.userId),
  index('idx_skills_source').on(table.source),
]);
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `id` | UUID，主键 |
| `name` | Skill 的显示名称，如 "Code Review"、"React Best Practices" |
| `description` | 一句话描述 skill 的用途 |
| `source` | 来源类型：`'git'`（从仓库安装）或 `'conversation'`（从对话保存） |
| `gitUrl` | 原始 Git 仓库 URL，用于更新时拉取 |
| `gitDir` | clone 目录名（如 `code-review`），多 skill 仓库中多条记录共享 |
| `filePath` | skill 文件相对路径，如 `installed/code-review/skill.md` 或 `custom/react-best-practices.md` |
| `conversationId` | 当 source='conversation' 时，记录来源会话 |
| `userId` | 所属用户，默认 `'default'`，预留多用户扩展 |
| `isGlobal` | 1 = 全局激活（对所有会话生效），0 = 未全局激活 |
| `createdAt` | 创建时间戳 |
| `updatedAt` | 最后更新时间戳 |

### 3.2 skill_activations 表

会话级 skill 激活记录。当用户在某个对话中临时激活一个 skill 时，在此表插入一条记录。

```typescript
export const skillActivations = sqliteTable('skill_activations', {
  id: text('id').primaryKey(),                    // UUID
  skillId: text('skill_id').notNull()
    .references(() => skills.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().default('default'),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('idx_skill_activations_conversation').on(table.conversationId),
  index('idx_skill_activations_skill').on(table.skillId),
]);
```

**作用域逻辑：**
- 全局激活：`skills.isGlobal = 1` → 对该用户所有会话生效
- 会话级激活：`skill_activations` 中有记录 → 仅对该会话生效
- 获取某会话的有效 skill = 全局激活的 skill ∪ 该会话激活的 skill

## 4. 数据访问层

### 4.1 Skill Repository

新建 `server/db/repositories/skill-repository.ts`，遵循现有 repository 模式：

```
SkillRepository
├── create(skill)              → 插入新 skill
├── getById(id)                → 按 ID 查询
├── getAll(userId)             → 获取用户所有 skill
├── getBySource(userId, source)→ 按来源筛选
├── update(id, fields)         → 更新字段
├── delete(id)                 → 删除（级联删除 activations）
├── setGlobal(id, isGlobal)    → 设置/取消全局激活
├── getActiveForConversation(userId, conversationId)
│                              → 获取某会话的所有有效 skill（全局 + 会话级）
├── activateForConversation(skillId, conversationId, userId)
│                              → 会话级激活
├── deactivateForConversation(skillId, conversationId)
│                              → 取消会话级激活
└── getConversationActivations(conversationId)
                               → 获取会话级激活列表
```

### 4.2 查询示例（伪代码）

**获取某会话的有效 skill：**

```
function getActiveForConversation(userId, conversationId):
    globalSkills = SELECT * FROM skills
                   WHERE userId = ? AND isGlobal = 1

    conversationSkills = SELECT s.* FROM skills s
                         JOIN skill_activations sa ON s.id = sa.skillId
                         WHERE sa.conversationId = ? AND sa.userId = ?

    return deduplicate(globalSkills + conversationSkills)
```

## 5. 数据迁移

新增一个 Drizzle 迁移文件，包含两张表的创建语句。遵循现有迁移模式（`server/db/migrations/`）。

迁移步骤：
1. 在 `schema.ts` 中添加表定义
2. 运行 `npm run db:generate` 生成迁移 SQL
3. 运行 `npm run db:migrate` 应用迁移

## 6. 目录初始化

应用启动时检查并创建所需目录：

```
data/skills/installed/
data/skills/custom/
```

此逻辑加入 `server/index.ts` 的启动初始化阶段，与现有的 `DATA_DIR` 初始化逻辑一致。

# TODO 03: 前端 Skill 管理

> 对应 spec: [specs/03-frontend-skill-management.md](../specs/03-frontend-skill-management.md)

## Skill Store

- [ ] 创建 `src/stores/skill-store.ts`
  - [ ] 定义 `SkillState` 接口和初始状态
  - [ ] 实现 `fetchSkills()` — GET /api/skills
  - [ ] 实现 `installSkill(gitUrl)` — POST /api/skills/install
  - [ ] 实现 `deleteSkill(id)` — DELETE /api/skills/:id
  - [ ] 实现 `updateSkillFromGit(id)` — POST /api/skills/:id/update
  - [ ] 实现 `setGlobalActivation(id, active)` — PUT /api/skills/:id/global
  - [ ] 实现 `getSkillContent(id)` — GET /api/skills/:id/content
  - [ ] 实现 `saveSkillContent(id, name, description, content)` — PUT /api/skills/:id
  - [ ] 实现会话级激活相关方法

## Settings 页面

- [ ] 修改 `src/app/settings/page.tsx` 添加 "Skills" tab
- [ ] 导入 SkillManagementPanel 组件

## SkillManagementPanel

- [ ] 创建 `src/components/settings/skill-management-panel.tsx`
  - [ ] SkillInstallSection 子组件
    - [ ] Git URL 输入框
    - [ ] Install 按钮 + loading 状态
    - [ ] 输入验证（URL 格式、重复检测）
    - [ ] 安装成功/失败 toast 提示
  - [ ] SkillList 子组件
    - [ ] 加载时调用 fetchSkills()
    - [ ] 空状态提示
  - [ ] SkillCard 子组件
    - [ ] 名称 + 来源 badge（git 蓝色 / conversation 绿色）
    - [ ] 描述（2 行截断）
    - [ ] 全局激活 Switch
    - [ ] View 按钮
    - [ ] Update 按钮（仅 git 来源）
    - [ ] Delete 按钮 + 确认弹窗

## SkillContentDialog

- [ ] 创建 Skill 内容查看/编辑弹窗（可内联在 skill-management-panel.tsx 中）
  - [ ] 内容 textarea（monospace 字体）
  - [ ] 名称编辑框
  - [ ] 描述编辑框
  - [ ] Cancel / Save 按钮
  - [ ] 加载内容 GET /api/skills/:id/content
  - [ ] 保存内容 PUT /api/skills/:id

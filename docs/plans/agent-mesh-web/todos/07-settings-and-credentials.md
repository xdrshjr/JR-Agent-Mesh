# TODO: 07 — 设置与凭证管理

> 对应 Spec: `specs/07-settings-and-credentials.md`

## 凭证加密

- [ ] 实现 `server/services/credential-store.ts` — CredentialStore 类
- [ ] 实现 ENCRYPTION_KEY 自动生成和加载（首次启动生成 → 写入 data/.env）
- [ ] 实现 `encrypt()` — AES-256-GCM 加密（plaintext → encrypted + iv + authTag）
- [ ] 实现 `decrypt()` — 解密
- [ ] 实现 `maskValue()` — 凭证脱敏显示（保留前缀 + 后 3 位）

## 凭证 REST API

- [ ] 实现 `GET /api/credentials` — 列出所有凭证（脱敏值 + hasValue 标记）
- [ ] 实现 `PUT /api/credentials/:key` — 设置/更新凭证（加密后存入 SQLite）
- [ ] 实现 `DELETE /api/credentials/:key` — 删除凭证
- [ ] 凭证更新后触发相关服务刷新（如更新 Anthropic Key 后刷新 SelfAgent 的 streamFn）

## 设置 REST API

- [ ] 实现 `GET /api/settings` — 获取所有设置（按分类分组）
- [ ] 实现 `PUT /api/settings` — 批量更新设置
- [ ] 实现设置变更响应逻辑（onSettingChanged）
  - [ ] self_agent.provider/model 变更 → 重建 streamFn
  - [ ] self_agent.system_prompt 变更 → 更新 Agent 系统提示
  - [ ] notification.sound 变更 → 通知前端
  - [ ] agent.max_processes 变更 → 更新 ProcessManager 限制

## 前端设置页面集成

- [ ] 前端 settings-store 调用 REST API 获取和保存设置
- [ ] Provider/Model 联动选择器（选 Provider 后过滤 Model 列表）
- [ ] 自定义 LLM 配置表单（URL + API Key + Model ID）
- [ ] System Prompt 编辑器（多行文本框，支持重置为默认值）
- [ ] 凭证编辑器（列表展示，点击编辑弹窗输入新值，输入框 type=password）
- [ ] 后台 Agent CLI 路径配置
- [ ] 通知开关
- [ ] 数据导入导出按钮

## 安全

- [ ] 凭证 API 不在响应中返回明文值（仅返回脱敏值）
- [ ] .env 文件加入 .gitignore
- [ ] 设置页面添加提醒："凭证存储在服务器本地，请在可信网络环境下使用"

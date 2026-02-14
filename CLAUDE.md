# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

JRAgentMesh is a full-stack web application for orchestrating multiple AI coding agents (Claude Code, OpenCode, Codex) through a unified interface. It includes a built-in chat assistant (self-agent) with tool use, real-time WebSocket streaming, and an integrated terminal for monitoring agent output.

## Commands

```bash
npm run dev              # Development server (tsx watch, auto-restarts on changes)
npm run build            # Build frontend (next build) + backend (tsc -p tsconfig.server.json)
npm start                # Production server (node dist/server/index.js)
npm run db:generate      # Generate Drizzle ORM migration files
npm run db:migrate       # Apply database migrations
npm run db:studio        # Open Drizzle visual DB editor
```

No test framework is configured. No linter is configured.

## Architecture

### Three-Layer Structure

- **`server/`** — Express + WebSocket backend (TypeScript, compiled to `dist/`)
- **`src/`** — Next.js 15 frontend with app router (React 19, Zustand, Tailwind CSS 4)
- **`shared/`** — Types shared between server and client (`shared/types.ts` is the protocol contract)

The custom Express server (`server/index.ts`) hosts both the REST API and Next.js, with a WebSocket server on `/ws`.

### Backend Services

- **`server/services/self-agent.ts`** — Built-in AI assistant using `pi-agent-core`. Has tools: read, write, edit, bash, file_transfer, agent_dispatch.
- **`server/services/agent-process-manager.ts`** — Spawns and manages CLI agent subprocesses via `node-pty`. Handles lifecycle (create/stop/restart/delete) and output parsing.
- **`server/services/agent-registry.ts`** — Pluggable registry for agent types (claude-code, opencode, codex). Each type defines its command, env vars, and health check.
- **`server/services/file-transfer.ts`** — File upload/download with temporary download tokens.
- **`server/utils/crypto.ts`** — AES-256-GCM encryption for credential storage.

### Adding New Agent Types

Register in `server/services/agent-registry.ts` by calling `registerAgentType()` with an `AgentTypeConfig`:

```typescript
registerAgentType({
  id: 'new-agent',
  displayName: 'New Agent',
  command: 'new-agent-cli',        // CLI executable
  args: ['--flag'],                // Default arguments
  envMapping: { API_KEY: 'key' },  // { ENV_VAR: credential_key }
  inputMode: 'stdin',              // 'stdin' or 'newline'
  healthCheck: 'new-agent-cli --version',
  icon: 'icon-name',
  description: 'Description',
});
```

TUI agents (opencode, codex) use xterm.js terminal; others use a parsed output area. This is controlled by `TUI_AGENT_TYPES` in `src/components/agents/agent-detail-panel.tsx`. Agent output is parsed by `ClaudeCodeParser` or `GenericCLIParser` in `server/services/parsers/`.

### Skill System

Reusable AI knowledge documents injected into the self-agent's system prompt. Two sources:

- **`git`** — Cloned from GitHub repos, stored in `data/skills/installed/`
- **`conversation`** — Generated from chat conversations via LLM extraction, stored in `data/skills/custom/`

Two activation levels: **global** (active for all conversations) and **session** (active for a specific conversation only, via `skillActivations` table).

Key files: `server/services/skill-management.ts` (core service), `server/db/repositories/skill-repository.ts` (DB layer), `src/stores/skill-store.ts` (frontend store), `src/components/settings/skill-management-panel.tsx` (management UI), `src/components/chat/save-skill-dialog.tsx` (generation UI).

Active skills are injected into the system prompt wrapped in `<skill name="...">content</skill>` tags (max 50,000 chars total). For agent dispatch, skills are prepended as markdown (max 30,000 chars).

### Workspace Isolation

Every conversation gets its own workspace directory at `{dataDir}/workspaces/{conversationId}/`. Auto-created on first file operation. Relative paths in self-agent tools resolve to this directory. Dispatched agents for the same conversation share the workspace.

### Adding Self-Agent Tools

Built-in tools are in `server/services/tools/builtin-tools.ts`, custom tools in `server/services/tools/custom-tools.ts`. Tool structure:

```typescript
export const myTool: AgentTool<typeof ParamsSchema> = {
  name: 'tool_name',
  label: 'Display Label',
  description: 'Description for LLM',
  parameters: Type.Object({ /* TypeBox schema */ }),
  async execute(_toolCallId, params) {
    return textResult('success') | errorResult('error');
  }
};
```

Tools are registered in `SelfAgentService` constructor. Built-in tools have limits: bash 120s timeout / 100KB output, file upload 50MB per file / 200MB total / 10 files max.

### WebSocket Protocol

All real-time communication uses a typed WebSocket protocol defined in `shared/types.ts`. Message types are prefixed by domain (`chat.*`, `agent.*`, `system.*`).

- **`server/websocket/handler.ts`** — Central message dispatch registry (`registerHandler(type, callback)`)
- **`server/websocket/protocol.ts`** — Messages >64KB are split into fragments with `__fragment` wrapper; client reassembles via `fragmentId`
- **`server/websocket/server.ts`** — Heartbeat (30s ping/pong), backpressure management (>1MB buffer skips sends)

Handler registration is split across:
- `server/websocket/chat-handlers.ts` — All `chat.*` message handlers
- `server/websocket/agent-handlers.ts` — All `agent.*` message handlers

**Adding a new WebSocket handler:**
1. Define payload type and add message type to `ClientMessageType` union in `shared/types.ts`
2. Call `registerHandler('domain.action', async (ws, payload, requestId?) => { ... })` in the appropriate handler file
3. Handlers are registered in `server/index.ts` via `registerChatHandlers(selfAgent)` / `registerAgentHandlers(agentProcessManager)`

### REST API

Routes are defined in `server/express-app.ts`. Key endpoints:

- `GET /api/agent-types`, `GET/POST /api/agents`, `POST /api/agents/:id/stop|restart`, `DELETE /api/agents/:id`
- `GET /api/conversations`, `GET /api/conversations/:id/messages`
- `POST/GET /api/settings`, `POST/GET /api/credentials`, `DELETE /api/credentials/:key`
- `GET /api/providers/:provider/models`
- `POST /api/upload`, `GET /api/download/:fileId`, `POST /api/export`, `POST /api/import`

### Frontend State

Three Zustand stores in `src/stores/`:
- **`chat-store.ts`** — Conversations, messages, streaming state
- **`agent-store.ts`** — Agent processes, outputs
- **`settings-store.ts`** — Credentials, model config

WebSocket connection is managed by `src/hooks/use-websocket.tsx`, which dispatches incoming messages to the appropriate store. The WebSocket client (`src/lib/websocket-client.ts`) handles fragment reassembly on the client side.

Frontend components are organized by domain: `src/components/layout/`, `chat/`, `agents/`, `settings/`, `ui/`. Pages live in `src/app/chat/`, `src/app/agents/`, `src/app/settings/`.

### Database

SQLite via `better-sqlite3` + Drizzle ORM. Schema in `server/db/schema.ts`, migrations in `server/db/migrations/`, config in `drizzle.config.ts`. Data access through repository pattern in `server/db/repositories/`.

Tables: `conversations`, `messages`, `agentProcesses`, `agentOutputs`, `credentials`, `settings`, `fileTransfers`.

DB file location: `./data/jragentmesh.db`. A cleanup job runs hourly (expired file transfers, agent outputs >30 days, SQLite VACUUM).

**Conventions:** All IDs are `text` (UUIDs). Timestamps are `integer` (Unix milliseconds, not seconds). JSON fields are stored as `text` with manual parse/stringify. Foreign keys use `onDelete: 'cascade'`.

### Self-Agent Error Recovery

- **Watchdog**: `agent.prompt()` is wrapped with a 60-second idle timeout. If no events are received within 60s, the call is aborted to prevent permanent hangs.
- **Pre-flight validation**: `validateModelConfig()` checks API key and baseUrl before calling the LLM, providing clear error messages for missing credentials.
- **pi-agent-core patch**: The postinstall patch wraps the agent loop with `.catch()` to push `agent_end` events on error, preventing silent promise hangs.

### Styling Convention

Components use CSS custom properties from `src/app/globals.css`, not raw Tailwind colors:

```tsx
className="bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]"
```

Key variables: `--primary`, `--surface`, `--background`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted`, `--error`, `--warning`, `--success`, `--radius` (8px).

### Content Block Rendering

Chat messages support interleaved content blocks (text, thinking, tool_use) via the `contentBlocks` array. Blocks are grouped for display by `groupContentBlocks()` in `src/lib/content-blocks.ts`. Falls back to legacy format (separate `content`, `thinking`, `toolCalls` fields) for older messages. Thinking blocks are collapsible by default.

### Path Aliases

```
@/*       → ./src/*
@server/* → ./server/*
@shared/* → ./shared/*
```

### Build Output

- Frontend: `.next/` (Next.js build)
- Backend: `dist/` (TypeScript compilation from `tsconfig.server.json`)
- Backend imports use `.js` extensions (ESM resolution)

### Patches

`patches/@mariozechner+pi-agent-core+0.52.10.patch` adds error recovery to the agent loop — wraps streaming promises with `.catch()` to prevent hangs when LLM calls fail. Applied automatically via `patch-package` on `npm install` (postinstall script).

## Environment Variables

- `ANTHROPIC_API_KEY` — Required for the built-in self-agent
- `PORT` — Server port (default: 3000)
- `DATA_DIR` — Data directory (default: `./data`)
- `ENCRYPTION_KEY` — Auto-generated and persisted to `.env` if missing

## Project Index

This project has a pre-generated index for quick codebase understanding.

- **Location:** `.claude-index/index.md`
- **Last Updated:** 2026-02-15
- **Contents:** Project overview, feature map, file index, exported symbols, module dependencies

**Usage:** Read `.claude-index/index.md` to quickly understand the project structure before making changes. The index provides a navigation map of the codebase without needing to explore every file.

**Regenerate:** Say "regenerate index" or "更新索引" to update the index after major changes.

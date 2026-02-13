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

### WebSocket Protocol

All real-time communication uses a typed WebSocket protocol defined in `shared/types.ts`. Message types are prefixed by domain (`chat.*`, `agent.*`, `system.*`).

- **`server/websocket/handler.ts`** — Central message dispatch registry (`registerHandler(type, callback)`)
- **`server/websocket/protocol.ts`** — Messages >64KB are split into fragments with `__fragment` wrapper; client reassembles via `fragmentId`
- **`server/websocket/server.ts`** — Heartbeat (30s ping/pong), backpressure management (>1MB buffer skips sends)

Handler registration is split across:
- `server/websocket/chat-handlers.ts` — All `chat.*` message handlers
- `server/websocket/agent-handlers.ts` — All `agent.*` message handlers

### Frontend State

Three Zustand stores in `src/stores/`:
- **`chat-store.ts`** — Conversations, messages, streaming state
- **`agent-store.ts`** — Agent processes, outputs
- **`settings-store.ts`** — Credentials, model config

WebSocket connection is managed by `src/hooks/use-websocket.tsx`, which dispatches incoming messages to the appropriate store. The WebSocket client (`src/lib/websocket-client.ts`) handles fragment reassembly on the client side.

### Database

SQLite via `better-sqlite3` + Drizzle ORM. Schema in `server/db/schema.ts`, migrations in `server/db/migrations/`. Data access through repository pattern in `server/db/repositories/`.

DB file location: `./data/jragentmesh.db`

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

## Environment Variables

- `ANTHROPIC_API_KEY` — Required for the built-in self-agent
- `PORT` — Server port (default: 3000)
- `DATA_DIR` — Data directory (default: `./data`)
- `ENCRYPTION_KEY` — Auto-generated and persisted to `.env` if missing

## Project Index

This project has a pre-generated index for quick codebase understanding.

- **Location:** `.claude-index/index.md`
- **Last Updated:** 2026-02-13
- **Contents:** Project overview, feature map, file index, exported symbols, module dependencies

**Usage:** Read `.claude-index/index.md` to quickly understand the project structure before making changes. The index provides a navigation map of the codebase without needing to explore every file.

**Regenerate:** Say "regenerate index" or "更新索引" to update the index after major changes.

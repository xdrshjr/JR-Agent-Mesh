# JR-Agent-Mesh

A web-based multi-agent management platform that lets you orchestrate and interact with multiple AI coding agents (Claude Code, OpenCode, Codex) through a unified interface.

## Features

- **Multi-Agent Management** — Spawn, monitor, and interact with multiple AI coding agents simultaneously
- **Built-in Chat** — Conversational interface powered by a self-agent (Claude Sonnet) with tool use (file read/write/edit, bash, agent dispatch)
- **Real-time Streaming** — WebSocket-based communication with live output streaming, thinking deltas, and tool call tracking
- **Agent Registry** — Pluggable agent types: Claude Code, OpenCode, and Codex, with per-agent credential and environment configuration
- **File Transfer** — Transfer files between agents and the server
- **Conversation History** — Persistent conversations and agent output history stored in SQLite
- **Settings & Credentials** — Manage API keys and agent configuration from the UI
- **Keyboard Shortcuts** — Productivity shortcuts for navigation and agent control

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, Zustand, Radix UI |
| Backend | Express, WebSocket (ws), node-pty |
| Database | SQLite (better-sqlite3) via Drizzle ORM |
| AI | pi-agent-core / pi-ai for self-agent, external CLI agents |
| Language | TypeScript throughout |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- At least one supported CLI agent installed (e.g. `claude`, `opencode`, or `codex`)

### Installation

```bash
git clone https://github.com/xdrshjr/JR-Agent-Mesh.git
cd JR-Agent-Mesh
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
# Required for the built-in self-agent
ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional
PORT=3000
DATA_DIR=./data
```

API keys for external agents (Claude Code, OpenCode, Codex) can also be configured through the Settings page in the UI.

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Production

```bash
npm run build
npm start
```

## Project Structure

```
├── server/                # Backend
│   ├── index.ts           # Server entrypoint
│   ├── express-app.ts     # REST API routes
│   ├── websocket/         # WebSocket server, protocol, handlers
│   ├── services/          # Agent process manager, self-agent, file transfer
│   ├── db/                # SQLite schema, repositories, cleanup
│   └── utils/             # Logger, crypto
├── src/                   # Frontend (Next.js)
│   ├── app/               # Pages: home, chat, agents, settings
│   ├── components/        # UI components (chat, agents, settings, layout)
│   ├── hooks/             # WebSocket, agent manager, keyboard shortcuts
│   ├── stores/            # Zustand stores (chat, agent, settings)
│   └── lib/               # Types, WebSocket client, utilities
└── shared/                # Shared types between server and client
```

## License

MIT

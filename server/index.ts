import 'dotenv/config';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import next from 'next';
import { createExpressApp } from './express-app.js';
import { initWebSocketServer, setActiveAgentsProvider, stopHeartbeat } from './websocket/server.js';
import { initDatabase, closeDatabase, getDb } from './db/index.js';
import * as schema from './db/schema.js';
import { eq } from 'drizzle-orm';
import { generateEncryptionKey } from './utils/crypto.js';
import { logger } from './utils/logger.js';
import { SelfAgentService } from './services/self-agent.js';
import { AgentProcessManager } from './services/agent-process-manager.js';
import { initAgentRegistry } from './services/agent-registry.js';
import { registerChatHandlers } from './websocket/chat-handlers.js';
import { registerAgentHandlers } from './websocket/agent-handlers.js';
import { startCleanupJob, stopCleanupJob } from './db/cleanup.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = resolve(process.env.DATA_DIR || './data');
const DB_PATH = resolve(DATA_DIR, 'jragentmesh.db');
const ENV_PATH = resolve('.env');
const isDev = process.env.NODE_ENV !== 'production';

async function main() {
  logger.info('Server', '=== JRAgentMesh Starting ===');

  // Step 1: Ensure encryption key exists
  ensureEncryptionKey();

  // Step 2: Initialize SQLite database
  logger.info('Server', 'Step 1: Initializing database...');
  try {
    initDatabase(DB_PATH);
  } catch (err) {
    logger.error('Server', 'Failed to initialize database', err);
    process.exit(1);
  }

  // Step 3: Initialize agent registry
  logger.info('Server', 'Step 2: Initializing agent registry...');
  initAgentRegistry();

  // Start data cleanup job (hourly)
  startCleanupJob();

  // Step 4: Initialize core services
  logger.info('Server', 'Step 3: Initializing core services...');

  // Read max processes from settings
  let maxProcesses = 10;
  try {
    const db = getDb();
    const row = db.select().from(schema.settings).where(eq(schema.settings.key, 'agent.max_processes')).get();
    if (row) {
      maxProcesses = parseInt(row.value, 10) || 10;
    }
  } catch { /* use default */ }

  const agentProcessManager = new AgentProcessManager({
    dataDir: DATA_DIR,
    maxProcesses,
  });

  // Recover agents from previous session
  agentProcessManager.recoverAgents();

  let selfAgent: SelfAgentService;
  try {
    selfAgent = new SelfAgentService({
      dataDir: DATA_DIR,
      agentProcessManager,
    });
  } catch (err) {
    logger.error('Server', 'Failed to initialize SelfAgentService', err);
    process.exit(1);
  }

  // Register WebSocket handlers
  registerChatHandlers(selfAgent);
  registerAgentHandlers(agentProcessManager);

  // Provide active agents to WebSocket init payload
  setActiveAgentsProvider(() => agentProcessManager.listAll());

  // Step 5: Create Express application
  logger.info('Server', 'Step 4: Creating Express application...');
  const expressApp = createExpressApp({
    dataDir: DATA_DIR,
    agentProcessManager,
    selfAgentService: selfAgent,
  });

  // Step 6: Initialize Next.js
  logger.info('Server', 'Step 5: Initializing Next.js...');
  const nextApp = next({ dev: isDev });
  const nextHandler = nextApp.getRequestHandler();
  try {
    await nextApp.prepare();
  } catch (err) {
    logger.error('Server', 'Failed to initialize Next.js', err);
    process.exit(1);
  }

  // Attach Next.js handler as fallback
  expressApp.all('*', (req, res) => {
    return nextHandler(req, res);
  });

  // Step 7: Create HTTP server
  logger.info('Server', 'Step 6: Creating HTTP server...');
  const httpServer = createServer(expressApp);

  // Step 8: Initialize WebSocket server
  logger.info('Server', 'Step 7: Initializing WebSocket server...');
  initWebSocketServer(httpServer);

  // Step 9: Start listening
  httpServer.listen(PORT, () => {
    logger.info('Server', `=== JRAgentMesh Ready ===`);
    logger.info('Server', `  Local:  http://localhost:${PORT}`);
    logger.info('Server', `  WS:     ws://localhost:${PORT}/ws`);
    logger.info('Server', `  Mode:   ${isDev ? 'development' : 'production'}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Server', 'Shutting down...');
    stopCleanupJob();
    stopHeartbeat();
    selfAgent.destroy();
    await agentProcessManager.destroy();
    httpServer.close();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function ensureEncryptionKey() {
  if (process.env.ENCRYPTION_KEY) return;

  // Check if .env file already has an encryption key with a value
  if (existsSync(ENV_PATH)) {
    const envContent = readFileSync(ENV_PATH, 'utf8');
    const match = envContent.match(/^ENCRYPTION_KEY=(.+)$/m);
    if (match && match[1].trim().length > 0) {
      // Key exists in file but wasn't loaded into process.env (shouldn't happen with dotenv)
      process.env.ENCRYPTION_KEY = match[1].trim();
      return;
    }
  }

  // Generate and persist a new encryption key
  const key = generateEncryptionKey();

  try {
    if (existsSync(ENV_PATH)) {
      const content = readFileSync(ENV_PATH, 'utf8');
      // Remove any existing empty ENCRYPTION_KEY= lines
      const cleaned = content.replace(/^ENCRYPTION_KEY=.*$/m, '').replace(/\n{3,}/g, '\n\n');
      writeFileSync(ENV_PATH, cleaned.trimEnd() + `\nENCRYPTION_KEY=${key}\n`);
    } else {
      writeFileSync(ENV_PATH, `PORT=3000\nDATA_DIR=./data\nENCRYPTION_KEY=${key}\n`);
    }
  } catch (err) {
    logger.error('Server', 'Failed to write encryption key to .env', err);
    // Continue with in-memory key — the server can still run this session
  }

  process.env.ENCRYPTION_KEY = key;
  logger.info('Server', 'Generated new encryption key and saved to .env');
}

main().catch((err) => {
  logger.error('Server', 'Fatal error during startup', err);
  process.exit(1);
});

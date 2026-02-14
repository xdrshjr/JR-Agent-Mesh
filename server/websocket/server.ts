import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { handleMessage } from './handler.js';
import { createMessage, createMessageWithFragmentation } from './protocol.js';
import type { InitPayload, AgentInfo, Conversation, ServerMessageType } from '../../shared/types.js';
import { ConversationRepository } from '../db/repositories/index.js';
import { logger } from '../utils/logger.js';

let wss: WebSocketServer;
const connectedClients = new Set<WebSocket>();

// Track last pong time per client for heartbeat timeout detection
const lastPongTime = new WeakMap<WebSocket, number>();

// Heartbeat constants
const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
const HEARTBEAT_TIMEOUT_MS = 60_000;  // 60 seconds without pong → disconnect

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// Callback to get active agents for init payload
let getActiveAgentsFn: (() => AgentInfo[]) | null = null;

// Callback to get current model info for init payload
let getCurrentModelFn: (() => { provider: string; model: string }) | null = null;

// Callback to get current thinking level for init payload
let getThinkingLevelFn: (() => string) | null = null;

export function setActiveAgentsProvider(fn: () => AgentInfo[]) {
  getActiveAgentsFn = fn;
}

export function setCurrentModelProvider(fn: () => { provider: string; model: string }) {
  getCurrentModelFn = fn;
}

export function setThinkingLevelProvider(fn: () => string) {
  getThinkingLevelFn = fn;
}

export function initWebSocketServer(httpServer: HTTPServer) {
  wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests for /ws path
  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    connectedClients.add(ws);
    lastPongTime.set(ws, Date.now());
    logger.info('WS', `Client connected (total: ${connectedClients.size})`);

    // Send init message
    const activeAgents = getActiveAgentsFn ? getActiveAgentsFn() : [];

    // Query non-archived conversations for the sidebar
    let conversations: Conversation[] = [];
    try {
      const convRepo = new ConversationRepository();
      const rows = convRepo.list({ archived: false });
      conversations = rows.map((r) => ({
        id: r.id,
        title: r.title,
        modelProvider: r.modelProvider,
        modelId: r.modelId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        isArchived: !!r.isArchived,
      }));
    } catch (err) {
      logger.error('WS', 'Failed to load conversations for init', err);
    }

    const currentModel = getCurrentModelFn ? getCurrentModelFn() : { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' };

    const initPayload: InitPayload = {
      selfAgentStatus: 'ready',
      activeAgents,
      currentConversationId: null,
      conversations,
      currentProvider: currentModel.provider,
      currentModel: currentModel.model,
      currentThinkingLevel: getThinkingLevelFn ? getThinkingLevelFn() : 'medium',
    };
    ws.send(createMessage('init', initPayload));

    ws.on('message', (data) => {
      const message = typeof data === 'string' ? data : data.toString();
      // Update pong time on any incoming message (including ping responses)
      lastPongTime.set(ws, Date.now());
      handleMessage(ws, message);
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      logger.info('WS', `Client disconnected (total: ${connectedClients.size})`);
    });

    ws.on('error', (err) => {
      logger.error('WS', 'WebSocket client error', err);
      connectedClients.delete(ws);
    });

    // Handle WebSocket-level pong frames (ws library built-in)
    ws.on('pong', () => {
      lastPongTime.set(ws, Date.now());
    });
  });

  // Start server-side heartbeat cycle
  startHeartbeat();

  logger.info('WS', 'WebSocket server initialized on /ws');

  return wss;
}

function startHeartbeat() {
  if (heartbeatTimer) return;

  heartbeatTimer = setInterval(() => {
    const now = Date.now();

    for (const ws of connectedClients) {
      const lastSeen = lastPongTime.get(ws) ?? 0;

      if (now - lastSeen > HEARTBEAT_TIMEOUT_MS) {
        // Client hasn't responded in 60s — terminate
        logger.warn('WS', 'Client heartbeat timeout, terminating connection');
        connectedClients.delete(ws);
        ws.terminate();
        continue;
      }

      // Send WebSocket-level ping frame
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// --- Backpressure ---

// Max send buffer size before we consider a client backpressured (1MB)
const BACKPRESSURE_THRESHOLD = 1024 * 1024;

/**
 * Check if a client's send buffer is under pressure.
 * Uses the ws library's bufferedAmount property.
 */
export function isBackpressured(ws: WebSocket): boolean {
  return ws.bufferedAmount > BACKPRESSURE_THRESHOLD;
}

/**
 * Send a message to a single client with fragmentation and backpressure support.
 * Returns false if the message was dropped due to backpressure.
 */
export function sendToClient<T>(
  ws: WebSocket,
  type: ServerMessageType,
  payload: T,
  requestId?: string,
): boolean {
  if (ws.readyState !== WebSocket.OPEN) return false;

  // Backpressure check — skip sending if buffer is too full
  if (isBackpressured(ws)) {
    return false;
  }

  const fragments = createMessageWithFragmentation(type, payload, requestId);
  for (const fragment of fragments) {
    ws.send(fragment);
  }
  return true;
}

/**
 * Broadcast a message to all connected clients with fragmentation and backpressure.
 * Returns the number of clients that received the message.
 */
export function broadcastToAllClients<T>(
  type: ServerMessageType,
  payload: T,
  requestId?: string,
): number {
  const fragments = createMessageWithFragmentation(type, payload, requestId);
  let sent = 0;

  for (const client of connectedClients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    if (isBackpressured(client)) continue;

    for (const fragment of fragments) {
      client.send(fragment);
    }
    sent++;
  }

  return sent;
}

export function getConnectedClients(): Set<WebSocket> {
  return connectedClients;
}

export function getWebSocketServer(): WebSocketServer {
  return wss;
}

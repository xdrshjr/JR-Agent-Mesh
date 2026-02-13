import type { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';

interface Session {
  ws: WebSocket;
  connectedAt: number;
}

const sessions = new Map<string, Session>();
let sessionCounter = 0;

export function addSession(ws: WebSocket): string {
  const sessionId = `session-${++sessionCounter}`;
  sessions.set(sessionId, { ws, connectedAt: Date.now() });
  logger.debug('SessionManager', `Session created: ${sessionId}`);
  return sessionId;
}

export function removeSession(sessionId: string) {
  sessions.delete(sessionId);
  logger.debug('SessionManager', `Session removed: ${sessionId}`);
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function getActiveSessions(): Map<string, Session> {
  return sessions;
}

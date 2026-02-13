import { WebSocket } from 'ws';
import type { ClientMessageType } from '../../shared/types.js';
import { createMessage, parseMessage } from './protocol.js';
import { logger } from '../utils/logger.js';

type MessageHandler = (ws: WebSocket, payload: unknown, requestId?: string) => void | Promise<void>;

const handlers = new Map<string, MessageHandler>();

export function registerHandler(type: ClientMessageType, handler: MessageHandler) {
  handlers.set(type, handler);
}

export function handleMessage(ws: WebSocket, raw: string) {
  const msg = parseMessage(raw);
  if (!msg) {
    logger.warn('WS', 'Received invalid WebSocket message');
    return;
  }

  // Handle ping/pong
  if (msg.type === 'ping') {
    ws.send(createMessage('pong', {}));
    return;
  }

  const handler = handlers.get(msg.type);
  if (!handler) {
    logger.warn('WS', `No handler registered for message type: ${msg.type}`);
    return;
  }

  try {
    const result = handler(ws, msg.payload, msg.requestId);
    if (result instanceof Promise) {
      result.catch((err) => {
        logger.error('WS', `Handler error for ${msg.type}`, err);
      });
    }
  } catch (err) {
    logger.error('WS', `Handler error for ${msg.type}`, err);
  }
}

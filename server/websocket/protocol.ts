import type { WebSocketMessage, ServerMessageType } from '../../shared/types.js';

export function createMessage<T>(type: ServerMessageType, payload: T, requestId?: string): string {
  const msg: WebSocketMessage<T> = {
    type,
    payload,
    timestamp: Date.now(),
  };
  if (requestId) {
    msg.requestId = requestId;
  }
  return JSON.stringify(msg);
}

export function parseMessage(data: string): WebSocketMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.type !== 'string') {
      return null;
    }
    return {
      type: parsed.type,
      payload: parsed.payload ?? {},
      requestId: typeof parsed.requestId === 'string' ? parsed.requestId : undefined,
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
    };
  } catch {
    return null;
  }
}

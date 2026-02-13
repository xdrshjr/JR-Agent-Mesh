import type { WebSocketMessage, ServerMessageType } from '../../shared/types.js';

// Fragment size threshold (64KB)
const FRAGMENT_THRESHOLD = 64 * 1024;
// Max chunk size per fragment
const FRAGMENT_CHUNK_SIZE = 60 * 1024;

let fragmentCounter = 0;

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

/**
 * Create message string and return fragments if the message exceeds 64KB.
 * Returns an array — single element for normal messages, multiple for fragmented.
 */
export function createMessageWithFragmentation<T>(
  type: ServerMessageType,
  payload: T,
  requestId?: string,
): string[] {
  const message = createMessage(type, payload, requestId);

  if (message.length <= FRAGMENT_THRESHOLD) {
    return [message];
  }

  // Split into chunks
  const fragmentId = `frag-${Date.now()}-${++fragmentCounter}`;
  const chunks: string[] = [];
  for (let i = 0; i < message.length; i += FRAGMENT_CHUNK_SIZE) {
    chunks.push(message.slice(i, i + FRAGMENT_CHUNK_SIZE));
  }

  // Wrap each chunk as a __fragment message
  return chunks.map((data, index) =>
    JSON.stringify({
      type: '__fragment',
      payload: {
        fragmentId,
        index,
        total: chunks.length,
        data,
      },
      timestamp: Date.now(),
    }),
  );
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

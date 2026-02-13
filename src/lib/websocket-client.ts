import type { WebSocketMessage } from '../../shared/types.js';

type MessageCallback = (payload: unknown) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners = new Map<string, Set<MessageCallback>>();
  private requestCallbacks = new Map<string, (payload: unknown) => void>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  constructor(url: string) {
    this.url = url;
  }

  get connected() {
    return this._connected;
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this._connected = true;
        this.reconnectAttempt = 0;
        this.emit('connected', {});
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.emit('disconnected', {});
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire after onerror
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WebSocketMessage;

          // Handle request-response callbacks
          if (msg.requestId && this.requestCallbacks.has(msg.requestId)) {
            this.requestCallbacks.get(msg.requestId)!(msg.payload);
            this.requestCallbacks.delete(msg.requestId);
          }

          // Emit to type listeners
          this.emit(msg.type, msg.payload);
        } catch {
          // Ignore malformed messages
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  send(type: string, payload: unknown, requestId?: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg: WebSocketMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };
    if (requestId) msg.requestId = requestId;

    this.ws.send(JSON.stringify(msg));
  }

  request(type: string, payload: unknown): Promise<unknown> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
      this.requestCallbacks.set(requestId, resolve);
      this.send(type, payload, requestId);
    });
  }

  on(type: string, callback: MessageCallback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  off(type: string, callback: MessageCallback) {
    this.listeners.get(type)?.delete(callback);
  }

  private emit(type: string, payload: unknown) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(payload);
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000);
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

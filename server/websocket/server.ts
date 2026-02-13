import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { handleMessage } from './handler.js';
import { createMessage } from './protocol.js';
import type { InitPayload } from '../../shared/types.js';
import { logger } from '../utils/logger.js';

let wss: WebSocketServer;
const connectedClients = new Set<WebSocket>();

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
    logger.info('WS', `Client connected (total: ${connectedClients.size})`);

    // Send init message
    const initPayload: InitPayload = {
      selfAgentStatus: 'ready',
      activeAgents: [],
      currentConversationId: null,
    };
    ws.send(createMessage('init', initPayload));

    ws.on('message', (data) => {
      const message = typeof data === 'string' ? data : data.toString();
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
  });

  logger.info('WS', 'WebSocket server initialized on /ws');

  return wss;
}

export function getConnectedClients(): Set<WebSocket> {
  return connectedClients;
}

export function getWebSocketServer(): WebSocketServer {
  return wss;
}

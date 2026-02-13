'use client';

import { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { WebSocketClient } from '@/lib/websocket-client';
import { useAgentStore } from '@/stores/agent-store';
import { useChatStore } from '@/stores/chat-store';
import { showToast } from '@/components/layout/toast';
import type {
  InitPayload,
  ChatStreamDeltaPayload,
  ChatThinkingDeltaPayload,
  ChatToolStartPayload,
  ChatToolEndPayload,
  ChatMessageCompletePayload,
  ChatErrorPayload,
  AgentCreatedPayload,
  AgentOutputPayload,
  AgentStatusPayload,
  AgentOutputHistoryPayload,
  SystemNotificationPayload,
} from '@/lib/types';

interface WebSocketContextValue {
  client: WebSocketClient | null;
  connected: boolean;
}

export const WebSocketContext = createContext<WebSocketContextValue>({
  client: null,
  connected: false,
});

export function useWebSocketClient() {
  return useContext(WebSocketContext);
}

export function useWebSocket() {
  const clientRef = useRef<WebSocketClient | null>(null);
  const [connected, setConnected] = useState(false);

  const setupListeners = useCallback((client: WebSocketClient) => {
    // Connection events
    client.on('connected', () => setConnected(true));
    client.on('disconnected', () => setConnected(false));

    // Init
    client.on('init', (payload) => {
      const data = payload as InitPayload;
      useAgentStore.getState().setAgents(data.activeAgents);
      if (data.currentConversationId) {
        useChatStore.getState().setCurrentConversation(data.currentConversationId);
      }
    });

    // Chat streaming
    client.on('chat.stream_delta', (payload) => {
      const data = payload as ChatStreamDeltaPayload;
      const store = useChatStore.getState();
      if (!store.streamingMessage) {
        store.startStreaming(data.messageId, data.conversationId);
      }
      store.appendStreamDelta(data.delta);
    });

    client.on('chat.thinking_delta', (payload) => {
      const data = payload as ChatThinkingDeltaPayload;
      const store = useChatStore.getState();
      if (!store.streamingMessage) {
        store.startStreaming(data.messageId, data.conversationId);
      }
      store.appendThinkingDelta(data.delta);
    });

    client.on('chat.tool_start', (payload) => {
      const data = payload as ChatToolStartPayload;
      useChatStore.getState().addToolCallStart({
        id: data.toolCallId,
        tool: data.tool,
        args: data.args,
        startedAt: Date.now(),
        success: false,
        duration: 0,
      });
    });

    client.on('chat.tool_end', (payload) => {
      const data = payload as ChatToolEndPayload;
      useChatStore.getState().updateToolCallEnd(
        data.toolCallId,
        data.result,
        data.success,
        data.duration,
      );
    });

    client.on('chat.message_complete', (payload) => {
      const data = payload as ChatMessageCompletePayload;
      useChatStore.getState().completeStreaming(data.usage);
      useChatStore.getState().setIsLoading(false);
    });

    client.on('chat.error', (payload) => {
      const data = payload as ChatErrorPayload;
      useChatStore.getState().setIsLoading(false);
      showToast({ level: 'error', title: 'Chat Error', message: data.error });
    });

    // Agent events
    client.on('agent.created', (payload) => {
      const data = payload as AgentCreatedPayload;
      useAgentStore.getState().addAgent({
        id: data.id,
        name: data.name,
        typeId: data.typeId,
        status: data.status,
        workDir: data.workDir,
        createdAt: data.createdAt,
      });
    });

    client.on('agent.output', (payload) => {
      const data = payload as AgentOutputPayload;
      useAgentStore.getState().appendOutput(data.agentId, data.data);
    });

    client.on('agent.status', (payload) => {
      const data = payload as AgentStatusPayload;
      useAgentStore.getState().updateAgentStatus(data.agentId, data.status);
    });

    client.on('agent.output_history', (payload) => {
      const data = payload as AgentOutputHistoryPayload;
      useAgentStore.getState().setOutputHistory(data.agentId, data.outputs);
    });

    client.on('system.notification', (payload) => {
      const data = payload as SystemNotificationPayload;
      const level = data.level === 'warning' ? 'warning' : data.level === 'error' ? 'error' : 'info';
      showToast({ level, title: data.title, message: data.message });
    });
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || `${window.location.hostname}:3000`;
    const wsUrl = `${protocol}//${host}/ws`;
    const client = new WebSocketClient(wsUrl);
    clientRef.current = client;

    setupListeners(client);
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [setupListeners]);

  return { client: clientRef.current, connected };
}

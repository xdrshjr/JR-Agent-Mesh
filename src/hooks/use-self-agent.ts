'use client';

import { useCallback } from 'react';
import { useWebSocketClient } from './use-websocket';
import { useChatStore } from '@/stores/chat-store';
import type { Attachment } from '@/lib/types';

export function useSelfAgent() {
  const { client } = useWebSocketClient();
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const provider = useChatStore((s) => s.provider);
  const model = useChatStore((s) => s.model);
  const dispatchMode = useChatStore((s) => s.dispatchMode);
  const isLoading = useChatStore((s) => s.isLoading);

  const sendMessage = useCallback(
    (content: string, attachments?: Attachment[]) => {
      if (!client || !content.trim()) return;

      const store = useChatStore.getState();
      const conversationId = store.currentConversationId || `conv-${Date.now()}`;

      store.addMessage({
        id: `msg-${Date.now()}`,
        conversationId,
        role: 'user',
        content,
        thinking: null,
        toolCalls: null,
        attachments: attachments || null,
        tokenUsage: null,
        createdAt: Date.now(),
      });

      store.setIsLoading(true);

      client.send('chat.send', {
        conversationId,
        content,
        attachments,
      });
    },
    [client],
  );

  const switchModel = useCallback(
    (newProvider: string, newModel: string) => {
      if (!client) return;
      useChatStore.getState().setProvider(newProvider);
      useChatStore.getState().setModel(newModel);
      client.send('chat.switch_model', { provider: newProvider, model: newModel });
    },
    [client],
  );

  const toggleDispatch = useCallback(
    (enabled: boolean) => {
      if (!client) return;
      useChatStore.getState().setDispatchMode(enabled);
      client.send('chat.toggle_dispatch', { enabled });
    },
    [client],
  );

  const abort = useCallback(() => {
    if (!client) return;
    const convId = useChatStore.getState().currentConversationId;
    if (!convId) return;
    client.send('chat.abort', { conversationId: convId });
    useChatStore.getState().setIsLoading(false);
  }, [client]);

  const newConversation = useCallback(() => {
    if (!client) return;
    client.send('chat.new_conversation', {});
    useChatStore.getState().clearMessages();
    useChatStore.getState().setCurrentConversation(null);
  }, [client]);

  const loadConversation = useCallback(
    (conversationId: string) => {
      if (!client) return;
      client.send('chat.load_conversation', { conversationId });
      useChatStore.getState().setCurrentConversation(conversationId);
    },
    [client],
  );

  return {
    sendMessage,
    switchModel,
    toggleDispatch,
    abort,
    newConversation,
    loadConversation,
    provider,
    model,
    dispatchMode,
    isLoading,
  };
}

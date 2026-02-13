import { create } from 'zustand';
import type { Message, Conversation, ToolCallRecord, TokenUsage, Attachment } from '@/lib/types';

interface StreamingMessage {
  id: string;
  conversationId: string;
  content: string;
  thinking: string;
  toolCalls: ToolCallRecord[];
  attachments: Attachment[];
  isStreaming: boolean;
}

export interface FileReadyInfo {
  fileId: string;
  filename: string;
  size: number;
  downloadUrl: string;
}

interface ChatState {
  // Conversations
  conversations: Conversation[];
  currentConversationId: string | null;

  // Messages
  messages: Message[];
  streamingMessage: StreamingMessage | null;

  // Model selection
  provider: string;
  model: string;
  dispatchMode: boolean;

  // File ready info (download URLs and sizes for file_transfer tool results)
  fileReadyMap: Record<string, FileReadyInfo>;

  // UI state
  isLoading: boolean;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (id: string | null) => void;
  addConversation: (conv: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Pick<Conversation, 'title' | 'updatedAt'>>) => void;
  removeConversation: (id: string) => void;
  clearAllConversations: () => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;

  // Streaming
  startStreaming: (messageId: string, conversationId: string) => void;
  appendStreamDelta: (delta: string) => void;
  appendThinkingDelta: (delta: string) => void;
  addToolCallStart: (toolCall: ToolCallRecord) => void;
  updateToolCallEnd: (toolCallId: string, result: string | undefined, success: boolean, duration: number) => void;
  completeStreaming: (usage?: TokenUsage) => void;

  // File attachments from agent
  addFileAttachment: (messageId: string, attachment: Attachment, size: number, downloadUrl: string) => void;
  getFileReadyInfo: (fileId: string) => FileReadyInfo | undefined;

  // Model
  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
  setDispatchMode: (enabled: boolean) => void;

  setIsLoading: (loading: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  streamingMessage: null,
  fileReadyMap: {},
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250929',
  dispatchMode: false,
  isLoading: false,

  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (id) => set({ currentConversationId: id }),
  addConversation: (conv) => set((s) => ({ conversations: [conv, ...s.conversations] })),
  updateConversation: (id, updates) => set((s) => ({
    conversations: s.conversations.map((c) =>
      c.id === id ? { ...c, ...updates } : c,
    ),
  })),
  removeConversation: (id) => set((s) => ({
    conversations: s.conversations.filter((c) => c.id !== id),
    ...(s.currentConversationId === id
      ? { currentConversationId: null, messages: [], streamingMessage: null, fileReadyMap: {} }
      : {}),
  })),
  clearAllConversations: () => set({
    conversations: [],
    currentConversationId: null,
    messages: [],
    streamingMessage: null,
    fileReadyMap: {},
  }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),

  startStreaming: (messageId, conversationId) =>
    set({
      streamingMessage: {
        id: messageId,
        conversationId,
        content: '',
        thinking: '',
        toolCalls: [],
        attachments: [],
        isStreaming: true,
      },
    }),

  appendStreamDelta: (delta) =>
    set((s) => {
      if (!s.streamingMessage) return s;
      return {
        streamingMessage: {
          ...s.streamingMessage,
          content: s.streamingMessage.content + delta,
        },
      };
    }),

  appendThinkingDelta: (delta) =>
    set((s) => {
      if (!s.streamingMessage) return s;
      return {
        streamingMessage: {
          ...s.streamingMessage,
          thinking: s.streamingMessage.thinking + delta,
        },
      };
    }),

  addToolCallStart: (toolCall) =>
    set((s) => {
      if (!s.streamingMessage) return s;
      return {
        streamingMessage: {
          ...s.streamingMessage,
          toolCalls: [...s.streamingMessage.toolCalls, toolCall],
        },
      };
    }),

  updateToolCallEnd: (toolCallId, result, success, duration) =>
    set((s) => {
      if (!s.streamingMessage) return s;
      return {
        streamingMessage: {
          ...s.streamingMessage,
          toolCalls: s.streamingMessage.toolCalls.map((tc) =>
            tc.id === toolCallId ? { ...tc, result, success, duration } : tc,
          ),
        },
      };
    }),

  completeStreaming: (usage?: TokenUsage) => {
    const { streamingMessage } = get();
    if (!streamingMessage) return;

    const completedMessage: Message = {
      id: streamingMessage.id,
      conversationId: streamingMessage.conversationId,
      role: 'assistant',
      content: streamingMessage.content || null,
      thinking: streamingMessage.thinking || null,
      toolCalls: streamingMessage.toolCalls.length > 0 ? streamingMessage.toolCalls : null,
      attachments: streamingMessage.attachments.length > 0 ? streamingMessage.attachments : null,
      tokenUsage: usage ?? null,
      createdAt: Date.now(),
    };

    set((s) => ({
      messages: [...s.messages, completedMessage],
      streamingMessage: null,
    }));
  },

  addFileAttachment: (messageId, attachment, size, downloadUrl) => {
    set((s) => {
      // Store file ready info
      const newMap = { ...s.fileReadyMap, [attachment.fileId]: { fileId: attachment.fileId, filename: attachment.filename, size, downloadUrl } };

      // Add to streaming message if it matches
      if (s.streamingMessage && s.streamingMessage.id === messageId) {
        return {
          fileReadyMap: newMap,
          streamingMessage: {
            ...s.streamingMessage,
            attachments: [...s.streamingMessage.attachments, attachment],
          },
        };
      }

      // Otherwise add to existing completed message
      const messages = s.messages.map((msg) => {
        if (msg.id === messageId) {
          return {
            ...msg,
            attachments: [...(msg.attachments || []), attachment],
          };
        }
        return msg;
      });

      return { fileReadyMap: newMap, messages };
    });
  },

  getFileReadyInfo: (fileId) => {
    return get().fileReadyMap[fileId];
  },

  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
  setDispatchMode: (enabled) => set({ dispatchMode: enabled }),

  setIsLoading: (loading) => set({ isLoading: loading }),
  clearMessages: () => set({ messages: [], streamingMessage: null, fileReadyMap: {} }),
}));

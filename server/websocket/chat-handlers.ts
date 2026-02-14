import { registerHandler } from './handler.js';
import { sendToClient } from './server.js';
import { logger } from '../utils/logger.js';
import type { SelfAgentService } from '../services/self-agent.js';
import type {
  ChatSendPayload,
  ChatAbortPayload,
  ChatSteerPayload,
  ChatSwitchModelPayload,
  ChatLoadConversationPayload,
  ChatRenameConversationPayload,
  ChatDeleteConversationPayload,
  ChatToggleDispatchPayload,
  ChatClearConversationPayload,
  ChatSetThinkingLevelPayload,
} from '../../shared/types.js';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, asc } from 'drizzle-orm';

export function registerChatHandlers(selfAgent: SelfAgentService) {
  // chat.send — User sends a message
  registerHandler('chat.send', async (ws, payload) => {
    const data = payload as ChatSendPayload;

    if (!data.conversationId || !data.content) {
      logger.warn('ChatHandler', 'Invalid chat.send payload');
      return;
    }

    logger.info('ChatHandler', `Message received for ${data.conversationId}: ${data.content.slice(0, 80)}...`);
    await selfAgent.handleUserMessage(data.conversationId, data.content, data.attachments);
  });

  // chat.abort — User aborts current generation
  registerHandler('chat.abort', (_ws, payload) => {
    const data = payload as ChatAbortPayload;
    if (!data.conversationId) return;

    logger.info('ChatHandler', `Abort requested for ${data.conversationId}`);
    selfAgent.handleAbort(data.conversationId);
  });

  // chat.steer — User sends steering message mid-generation
  registerHandler('chat.steer', (_ws, payload) => {
    const data = payload as ChatSteerPayload;
    if (!data.conversationId || !data.content) return;

    logger.info('ChatHandler', `Steer message for ${data.conversationId}`);
    selfAgent.handleSteer(data.conversationId, data.content);
  });

  // chat.switch_model — User switches LLM model
  registerHandler('chat.switch_model', (_ws, payload) => {
    const data = payload as ChatSwitchModelPayload;
    if (!data.provider || !data.model) return;

    logger.info('ChatHandler', `Switch model to ${data.provider}/${data.model}`);
    selfAgent.switchModel(data.provider, data.model);
  });

  // chat.new_conversation — User creates a new conversation
  registerHandler('chat.new_conversation', async (ws) => {
    const conv = await selfAgent.createConversation();
    logger.info('ChatHandler', `New conversation created: ${conv.id}`);

    sendToClient(ws, 'chat.new_conversation_created', {
      conversationId: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      modelProvider: conv.modelProvider,
      modelId: conv.modelId,
      isArchived: conv.isArchived,
    });
  });

  // chat.load_conversation — User loads an existing conversation
  registerHandler('chat.load_conversation', async (ws, payload) => {
    const data = payload as ChatLoadConversationPayload;
    if (!data.conversationId) return;

    try {
      await selfAgent.loadConversation(data.conversationId);

      // Send loaded messages back to client
      const db = getDb();
      const dbMessages = db.select().from(schema.messages)
        .where(eq(schema.messages.conversationId, data.conversationId))
        .orderBy(asc(schema.messages.createdAt))
        .all();

      // Convert to app message format
      const messages = dbMessages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.role,
        content: msg.content,
        thinking: msg.thinking,
        toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls) : null,
        attachments: msg.attachments ? JSON.parse(msg.attachments) : null,
        tokenUsage: msg.tokenUsage ? JSON.parse(msg.tokenUsage) : null,
        createdAt: msg.createdAt,
      }));

      sendToClient(ws, 'chat.conversation_loaded', {
        conversationId: data.conversationId,
        messages,
      });

      logger.info('ChatHandler', `Loaded conversation ${data.conversationId} with ${messages.length} messages`);
    } catch (err: any) {
      logger.error('ChatHandler', `Failed to load conversation ${data.conversationId}`, err);
      sendToClient(ws, 'chat.error', {
        conversationId: data.conversationId,
        error: err.message,
      });
    }
  });

  // chat.rename_conversation — User renames a conversation
  registerHandler('chat.rename_conversation', (ws, payload) => {
    const data = payload as ChatRenameConversationPayload;
    if (!data.conversationId || !data.title) return;

    const updatedAt = selfAgent.renameConversation(data.conversationId, data.title);
    logger.info('ChatHandler', `Renamed conversation ${data.conversationId}`);

    sendToClient(ws, 'chat.conversation_updated', {
      conversationId: data.conversationId,
      title: data.title,
      updatedAt,
    });
  });

  // chat.delete_conversation — User deletes a single conversation
  registerHandler('chat.delete_conversation', async (ws, payload) => {
    const data = payload as ChatDeleteConversationPayload;
    if (!data.conversationId) return;

    await selfAgent.deleteConversation(data.conversationId);
    logger.info('ChatHandler', `Deleted conversation ${data.conversationId}`);

    sendToClient(ws, 'chat.conversation_deleted', {
      conversationId: data.conversationId,
    });
  });

  // chat.delete_all_conversations — User clears all conversations
  registerHandler('chat.delete_all_conversations', (ws) => {
    selfAgent.deleteAllConversations();
    logger.info('ChatHandler', 'All conversations deleted');

    sendToClient(ws, 'chat.all_conversations_deleted', {});
  });

  // chat.toggle_dispatch — User toggles dispatch mode
  registerHandler('chat.toggle_dispatch', (_ws, payload) => {
    const data = payload as ChatToggleDispatchPayload;
    selfAgent.toggleDispatch(data.enabled);
    logger.info('ChatHandler', `Dispatch mode: ${data.enabled}`);
  });

  // chat.clear_conversation — User clears current conversation (messages + AI memory)
  registerHandler('chat.clear_conversation', (_ws, payload) => {
    const data = payload as ChatClearConversationPayload;
    if (!data.conversationId) return;

    selfAgent.clearConversation(data.conversationId);
    logger.info('ChatHandler', `Cleared conversation ${data.conversationId}`);
  });

  // chat.set_thinking_level — User changes thinking level
  registerHandler('chat.set_thinking_level', (_ws, payload) => {
    const data = payload as ChatSetThinkingLevelPayload;
    if (!data.level) return;

    selfAgent.setThinkingLevel(data.level);
    logger.info('ChatHandler', `Thinking level set to: ${data.level}`);
  });

  logger.info('ChatHandler', 'Chat WebSocket handlers registered');
}

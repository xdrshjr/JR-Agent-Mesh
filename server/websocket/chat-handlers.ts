import { registerHandler } from './handler.js';
import { createMessage } from './protocol.js';
import { logger } from '../utils/logger.js';
import type { SelfAgentService } from '../services/self-agent.js';
import type {
  ChatSendPayload,
  ChatAbortPayload,
  ChatSteerPayload,
  ChatSwitchModelPayload,
  ChatLoadConversationPayload,
  ChatToggleDispatchPayload,
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
    const conversationId = await selfAgent.createConversation();
    logger.info('ChatHandler', `New conversation created: ${conversationId}`);

    // Send the new conversation info back
    ws.send(createMessage('chat.new_conversation_created', {
      conversationId,
    }));
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

      ws.send(createMessage('chat.conversation_loaded', {
        conversationId: data.conversationId,
        messages,
      }));

      logger.info('ChatHandler', `Loaded conversation ${data.conversationId} with ${messages.length} messages`);
    } catch (err: any) {
      logger.error('ChatHandler', `Failed to load conversation ${data.conversationId}`, err);
      ws.send(createMessage('chat.error', {
        conversationId: data.conversationId,
        error: err.message,
      }));
    }
  });

  // chat.toggle_dispatch — User toggles dispatch mode
  registerHandler('chat.toggle_dispatch', (_ws, payload) => {
    const data = payload as ChatToggleDispatchPayload;
    selfAgent.toggleDispatch(data.enabled);
    logger.info('ChatHandler', `Dispatch mode: ${data.enabled}`);
  });

  logger.info('ChatHandler', 'Chat WebSocket handlers registered');
}

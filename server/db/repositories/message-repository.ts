import { eq, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index.js';
import * as schema from '../schema.js';

export class MessageRepository {
  listByConversation(conversationId: string, limit?: number, offset?: number) {
    const db = getDb();
    const rows = db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(asc(schema.messages.createdAt))
      .limit(limit ?? 1000)
      .offset(offset ?? 0)
      .all();

    return rows.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      role: msg.role,
      content: msg.content,
      thinking: msg.thinking,
      toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls) : null,
      contentBlocks: msg.contentBlocks ? JSON.parse(msg.contentBlocks) : null,
      attachments: msg.attachments ? JSON.parse(msg.attachments) : null,
      tokenUsage: msg.tokenUsage ? JSON.parse(msg.tokenUsage) : null,
      createdAt: msg.createdAt,
    }));
  }

  create(
    conversationId: string,
    role: string,
    content: string | null,
    options?: {
      thinking?: string | null;
      toolCalls?: unknown[] | null;
      attachments?: unknown[] | null;
      tokenUsage?: unknown | null;
    },
  ) {
    const db = getDb();
    const id = `msg-${uuidv4()}`;
    const now = Date.now();

    db.insert(schema.messages)
      .values({
        id,
        conversationId,
        role,
        content,
        thinking: options?.thinking ?? null,
        toolCalls: options?.toolCalls ? JSON.stringify(options.toolCalls) : null,
        attachments: options?.attachments ? JSON.stringify(options.attachments) : null,
        tokenUsage: options?.tokenUsage ? JSON.stringify(options.tokenUsage) : null,
        createdAt: now,
      })
      .run();

    // Update conversation's updatedAt
    db.update(schema.conversations)
      .set({ updatedAt: now })
      .where(eq(schema.conversations.id, conversationId))
      .run();

    return { id, conversationId, role, content, createdAt: now };
  }

  updateContent(id: string, content: string) {
    const db = getDb();
    db.update(schema.messages)
      .set({ content })
      .where(eq(schema.messages.id, id))
      .run();
  }

  updateToolCalls(id: string, toolCalls: unknown[]) {
    const db = getDb();
    db.update(schema.messages)
      .set({ toolCalls: JSON.stringify(toolCalls) })
      .where(eq(schema.messages.id, id))
      .run();
  }
}

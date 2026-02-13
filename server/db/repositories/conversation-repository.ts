import { eq, desc, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index.js';
import * as schema from '../schema.js';

export interface ConversationListOptions {
  archived?: boolean;
  limit?: number;
  offset?: number;
}

export interface ConversationWithMessages {
  id: string;
  title: string | null;
  modelProvider: string | null;
  modelId: string | null;
  createdAt: number;
  updatedAt: number;
  isArchived: number | null;
  messages: Array<{
    id: string;
    conversationId: string;
    role: string;
    content: string | null;
    thinking: string | null;
    toolCalls: unknown[] | null;
    attachments: unknown[] | null;
    tokenUsage: unknown | null;
    createdAt: number;
  }>;
}

export class ConversationRepository {
  list(options?: ConversationListOptions) {
    const db = getDb();
    const conditions = [];

    if (options?.archived !== undefined) {
      conditions.push(eq(schema.conversations.isArchived, options.archived ? 1 : 0));
    }

    const query = conditions.length > 0
      ? db.select().from(schema.conversations).where(conditions[0])
      : db.select().from(schema.conversations);

    return query
      .orderBy(desc(schema.conversations.updatedAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0)
      .all();
  }

  getById(id: string): ConversationWithMessages | null {
    const db = getDb();
    const conv = db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, id))
      .get();

    if (!conv) return null;

    const dbMessages = db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, id))
      .orderBy(asc(schema.messages.createdAt))
      .all();

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

    return { ...conv, messages };
  }

  create(title?: string, modelProvider?: string, modelId?: string) {
    const db = getDb();
    const id = `conv-${uuidv4()}`;
    const now = Date.now();

    db.insert(schema.conversations)
      .values({
        id,
        title: title ?? null,
        modelProvider: modelProvider ?? null,
        modelId: modelId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return { id, title: title ?? null, modelProvider: modelProvider ?? null, modelId: modelId ?? null, createdAt: now, updatedAt: now, isArchived: 0 };
  }

  updateTitle(id: string, title: string) {
    const db = getDb();
    db.update(schema.conversations)
      .set({ title, updatedAt: Date.now() })
      .where(eq(schema.conversations.id, id))
      .run();
  }

  archive(id: string) {
    const db = getDb();
    db.update(schema.conversations)
      .set({ isArchived: 1, updatedAt: Date.now() })
      .where(eq(schema.conversations.id, id))
      .run();
  }

  delete(id: string) {
    const db = getDb();
    // Messages will cascade-delete due to FK constraint
    db.delete(schema.conversations)
      .where(eq(schema.conversations.id, id))
      .run();
  }
}

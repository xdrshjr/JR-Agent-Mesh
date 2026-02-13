import { eq, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index.js';
import * as schema from '../schema.js';

export class FileTransferRepository {
  create(options: {
    id?: string;
    conversationId?: string;
    agentId?: string;
    filename: string;
    filePath: string;
    fileSize: number;
    direction: 'upload' | 'download';
    status?: 'pending' | 'completed' | 'expired';
    expiresInMs?: number;
  }) {
    const db = getDb();
    const id = options.id || uuidv4();
    const now = Date.now();
    const expiresAt = options.expiresInMs
      ? now + options.expiresInMs
      : now + 24 * 60 * 60 * 1000; // Default 24h

    db.insert(schema.fileTransfers)
      .values({
        id,
        conversationId: options.conversationId ?? null,
        agentId: options.agentId ?? null,
        filename: options.filename,
        filePath: options.filePath,
        fileSize: options.fileSize,
        direction: options.direction,
        status: options.status || 'pending',
        createdAt: now,
        expiresAt,
      })
      .run();

    return { id, filename: options.filename, filePath: options.filePath, fileSize: options.fileSize, createdAt: now, expiresAt };
  }

  getById(id: string) {
    const db = getDb();
    return db
      .select()
      .from(schema.fileTransfers)
      .where(eq(schema.fileTransfers.id, id))
      .get() ?? null;
  }

  updateStatus(id: string, status: 'pending' | 'completed' | 'expired', expiresAt?: number) {
    const db = getDb();
    const updates: Record<string, unknown> = { status };
    if (expiresAt !== undefined) {
      updates.expiresAt = expiresAt;
    }
    db.update(schema.fileTransfers)
      .set(updates)
      .where(eq(schema.fileTransfers.id, id))
      .run();
  }

  getExpired(): Array<typeof schema.fileTransfers.$inferSelect> {
    const db = getDb();
    const now = Date.now();
    return db
      .select()
      .from(schema.fileTransfers)
      .where(lt(schema.fileTransfers.expiresAt, now))
      .all();
  }

  delete(id: string) {
    const db = getDb();
    db.delete(schema.fileTransfers)
      .where(eq(schema.fileTransfers.id, id))
      .run();
  }
}

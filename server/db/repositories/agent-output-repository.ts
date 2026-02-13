import { eq, sql } from 'drizzle-orm';
import { getDb } from '../index.js';
import * as schema from '../schema.js';
import type { ParsedOutput } from '../../../shared/types.js';

export class AgentOutputRepository {
  listByAgent(agentId: string, fromIndex?: number, limit?: number) {
    const db = getDb();

    const rows = db
      .select()
      .from(schema.agentOutputs)
      .where(eq(schema.agentOutputs.agentId, agentId))
      .offset(fromIndex ?? 0)
      .limit(limit ?? 10000)
      .all();

    return rows.map((r) => ({
      type: r.type as ParsedOutput['type'],
      content: r.content ?? undefined,
      tool: r.tool ?? undefined,
      args: r.args ?? undefined,
      success: r.success !== null ? r.success === 1 : undefined,
      duration: r.duration ?? undefined,
    }));
  }

  batchInsert(agentId: string, outputs: Array<{ timestamp: number } & ParsedOutput>) {
    const db = getDb();
    if (outputs.length === 0) return;

    const rows = outputs.map((item) => ({
      agentId,
      type: item.type,
      content: item.content ?? null,
      tool: item.tool ?? null,
      args: item.args ?? null,
      success: item.success !== undefined ? (item.success ? 1 : 0) : null,
      duration: item.duration ?? null,
      createdAt: item.timestamp,
    }));

    db.insert(schema.agentOutputs).values(rows).run();
  }

  countByAgent(agentId: string): number {
    const db = getDb();
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.agentOutputs)
      .where(eq(schema.agentOutputs.agentId, agentId))
      .get();

    return result?.count ?? 0;
  }

  deleteByAgent(agentId: string) {
    const db = getDb();
    db.delete(schema.agentOutputs)
      .where(eq(schema.agentOutputs.agentId, agentId))
      .run();
  }
}

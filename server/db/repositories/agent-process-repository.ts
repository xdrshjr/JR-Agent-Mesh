import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../index.js';
import * as schema from '../schema.js';
import type { AgentStatus, AgentTypeId } from '../../../shared/types.js';

export class AgentProcessRepository {
  list(statusFilter?: string[]) {
    const db = getDb();
    if (statusFilter && statusFilter.length > 0) {
      return db
        .select()
        .from(schema.agentProcesses)
        .where(inArray(schema.agentProcesses.status, statusFilter))
        .all();
    }
    return db.select().from(schema.agentProcesses).all();
  }

  getById(id: string) {
    const db = getDb();
    const process = db
      .select()
      .from(schema.agentProcesses)
      .where(eq(schema.agentProcesses.id, id))
      .get();

    if (!process) return null;

    // Get recent outputs (last 200)
    const outputs = db
      .select()
      .from(schema.agentOutputs)
      .where(eq(schema.agentOutputs.agentId, id))
      .limit(200)
      .all();

    return { ...process, outputs };
  }

  create(
    id: string,
    typeId: AgentTypeId,
    name: string,
    workDir: string | null,
    pid: number | null,
    config?: Record<string, unknown>,
  ) {
    const db = getDb();
    const now = Date.now();

    db.insert(schema.agentProcesses)
      .values({
        id,
        typeId,
        name,
        status: 'RUNNING' as AgentStatus,
        workDir,
        pid,
        exitCode: null,
        createdAt: now,
        stoppedAt: null,
        config: config ? JSON.stringify(config) : null,
      })
      .run();

    return { id, typeId, name, status: 'RUNNING' as AgentStatus, workDir, pid, createdAt: now };
  }

  updateStatus(id: string, status: AgentStatus, exitCode?: number) {
    const db = getDb();
    const updates: Record<string, unknown> = {
      status,
      stoppedAt: Date.now(),
    };
    if (exitCode !== undefined) {
      updates.exitCode = exitCode;
    }
    db.update(schema.agentProcesses)
      .set(updates)
      .where(eq(schema.agentProcesses.id, id))
      .run();
  }

  delete(id: string) {
    const db = getDb();
    // Cascade will delete agent_outputs
    db.delete(schema.agentProcesses)
      .where(eq(schema.agentProcesses.id, id))
      .run();
  }

  /**
   * Get agents that are stopped/crashed/exited and older than a given age in days.
   */
  getOldStopped(olderThanDays: number) {
    const db = getDb();
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const stoppedStatuses = ['STOPPED', 'CRASHED', 'EXITED', 'FAILED'];

    return db
      .select()
      .from(schema.agentProcesses)
      .where(inArray(schema.agentProcesses.status, stoppedStatuses))
      .all()
      .filter((a) => (a.stoppedAt ?? a.createdAt) < cutoff);
  }
}

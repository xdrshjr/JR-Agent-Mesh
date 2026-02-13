import { existsSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from '../utils/logger.js';
import { FileTransferRepository } from './repositories/file-transfer-repository.js';
import { AgentProcessRepository } from './repositories/agent-process-repository.js';
import { AgentOutputRepository } from './repositories/agent-output-repository.js';
import { getSqlite } from './index.js';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const OUTPUT_RETENTION_DAYS = 30;
const VACUUM_THRESHOLD_PAGES = 1000; // ~4MB of wasted space

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let startupTimer: ReturnType<typeof setTimeout> | null = null;

export function startCleanupJob() {
  // Run once at startup (with a delay to avoid blocking init)
  startupTimer = setTimeout(() => {
    startupTimer = null;
    runCleanup();
  }, 10_000);

  // Then run hourly
  cleanupTimer = setInterval(() => runCleanup(), CLEANUP_INTERVAL_MS);

  logger.info('Cleanup', 'Cleanup job scheduled (hourly)');
}

export function stopCleanupJob() {
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  logger.info('Cleanup', 'Cleanup job stopped');
}

function runCleanup() {
  try {
    logger.info('Cleanup', 'Running cleanup...');

    cleanExpiredFileTransfers();
    cleanOldAgentOutputs();
    maybeVacuum();

    logger.info('Cleanup', 'Cleanup completed');
  } catch (err) {
    logger.error('Cleanup', 'Cleanup job failed', err);
  }
}

/**
 * Delete expired file transfer records and their associated files.
 */
function cleanExpiredFileTransfers() {
  const repo = new FileTransferRepository();
  const expired = repo.getExpired();

  if (expired.length === 0) return;

  let deletedFiles = 0;
  let deletedRecords = 0;

  for (const record of expired) {
    // Delete physical file directory (e.g., data/uploads/{fileId}/ or data/downloads/{fileId}/)
    try {
      if (record.filePath) {
        const fileDir = dirname(record.filePath);
        if (existsSync(fileDir)) {
          rmSync(fileDir, { recursive: true, force: true });
          deletedFiles++;
        }
      }
    } catch (err) {
      logger.warn('Cleanup', `Failed to delete file directory for ${record.filePath}`, err);
    }

    // Pending files → mark as expired; completed files → delete record
    try {
      if (record.status === 'pending') {
        repo.updateStatus(record.id, 'expired');
      } else {
        repo.delete(record.id);
      }
      deletedRecords++;
    } catch (err) {
      logger.warn('Cleanup', `Failed to update/delete file transfer record ${record.id}`, err);
    }
  }

  if (deletedRecords > 0) {
    logger.info('Cleanup', `Cleaned ${deletedRecords} expired file transfers (${deletedFiles} files)`);
  }
}

/**
 * Delete output logs for agents that have been stopped for more than OUTPUT_RETENTION_DAYS.
 */
function cleanOldAgentOutputs() {
  const processRepo = new AgentProcessRepository();
  const outputRepo = new AgentOutputRepository();

  const oldAgents = processRepo.getOldStopped(OUTPUT_RETENTION_DAYS);

  if (oldAgents.length === 0) return;

  let cleanedCount = 0;

  for (const agent of oldAgents) {
    try {
      const count = outputRepo.countByAgent(agent.id);
      if (count > 0) {
        outputRepo.deleteByAgent(agent.id);
        cleanedCount++;
        logger.info('Cleanup', `Cleaned ${count} outputs for old agent ${agent.id}`);
      }
    } catch (err) {
      logger.warn('Cleanup', `Failed to clean outputs for agent ${agent.id}`, err);
    }
  }

  if (cleanedCount > 0) {
    logger.info('Cleanup', `Cleaned output logs for ${cleanedCount} old agents`);
  }
}

/**
 * Run VACUUM if wasted space exceeds threshold.
 */
function maybeVacuum() {
  try {
    const sqlite = getSqlite();
    const row = sqlite.pragma('freelist_count') as Array<{ freelist_count: number }>;
    const freelistCount = row[0]?.freelist_count ?? 0;

    if (freelistCount > VACUUM_THRESHOLD_PAGES) {
      logger.info('Cleanup', `Running VACUUM (freelist_count: ${freelistCount})`);
      sqlite.exec('VACUUM');
      logger.info('Cleanup', 'VACUUM completed');
    }
  } catch (err) {
    // VACUUM check is optional — silently skip if query fails
    logger.debug('Cleanup', 'VACUUM check skipped', err);
  }
}

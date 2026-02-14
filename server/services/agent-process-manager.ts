import { spawn as ptySpawn, type IPty } from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import { resolve, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { eq } from 'drizzle-orm';

import type { AgentTypeId, AgentStatus, AgentInfo, ParsedOutput } from '../../shared/types.js';
import { getAgentType } from './agent-registry.js';
import { RingBuffer, ClaudeCodeParser, GenericCLIParser, type OutputParser } from './output-parsers.js';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { broadcastToAllClients, isBackpressured, getConnectedClients } from '../websocket/server.js';
import { logger } from '../utils/logger.js';
import type { ServerMessageType } from '../../shared/types.js';

// --- Types ---

interface AgentProcess {
  id: string;
  name: string;
  typeId: AgentTypeId;
  status: AgentStatus;
  workDir: string;
  createdAt: number;
  ptyProcess: IPty | null;
  outputBuffer: RingBuffer;
  outputLog: Array<{ timestamp: number } & ParsedOutput>;
  parser: OutputParser;
  exitCode?: number;
}

export interface AgentProcessManagerOptions {
  dataDir: string;
  maxProcesses?: number;
}

// --- Output flush scheduling ---

const FLUSH_INTERVAL_MS = 3000;
const WS_THROTTLE_MS = 50;

// --- Counter for auto-naming ---

const typeCounters = new Map<string, number>();

function nextIndex(typeId: string): number {
  const current = typeCounters.get(typeId) || 0;
  const next = current + 1;
  typeCounters.set(typeId, next);
  return next;
}

// --- Parser factory ---

function createParser(typeId: AgentTypeId): OutputParser {
  switch (typeId) {
    case 'claude-code':
      return new ClaudeCodeParser();
    default:
      return new GenericCLIParser();
  }
}

// --- Build clean env record (filter out undefined values) ---

function buildCleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

// --- AgentProcessManager ---

export class AgentProcessManager {
  private processes = new Map<string, AgentProcess>();
  private dataDir: string;
  private maxProcesses: number;
  private flushTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingFlush = new Map<string, Array<{ timestamp: number } & ParsedOutput>>();

  // WebSocket throttle state
  private wsThrottleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private wsThrottleBuffers = new Map<string, Array<{ data: ParsedOutput; index: number }>>();

  constructor(options: AgentProcessManagerOptions) {
    this.dataDir = options.dataDir;
    this.maxProcesses = options.maxProcesses ?? 10;
    logger.info('AgentProcessManager', `Initialized (maxProcesses: ${this.maxProcesses})`);
  }

  setMaxProcesses(max: number): void {
    this.maxProcesses = max;
    logger.info('AgentProcessManager', `Max processes updated to ${max}`);
  }

  // --- Create ---

  async createProcess(
    typeId: AgentTypeId,
    name?: string,
    workDir?: string,
    initialPrompt?: string,
  ): Promise<AgentInfo> {
    // Validate agent type
    const config = getAgentType(typeId);
    if (!config) {
      throw new Error(`Unknown agent type: ${typeId}`);
    }

    // Check concurrency limit
    const runningCount = this.getRunningCount();
    if (runningCount >= this.maxProcesses) {
      throw new Error(
        `Maximum concurrent agent limit reached (${this.maxProcesses}). Stop an existing agent first.`,
      );
    }

    // Generate instance ID and name
    const instanceId = `agent-${uuidv4()}`;
    const instanceName = name || `${config.displayName} #${nextIndex(typeId)}`;

    // Prepare environment variables (start from clean copy without undefined)
    const env = buildCleanEnv();
    for (const [envKey, credKey] of Object.entries(config.envMapping)) {
      const value = this.getCredential(credKey);
      if (value) {
        env[envKey] = value;
      }
    }

    // Determine working directory
    const cwd = workDir || resolve(join(this.dataDir, 'workspaces', instanceId));
    try {
      mkdirSync(cwd, { recursive: true });
    } catch (err) {
      throw new Error(`Failed to create working directory ${cwd}: ${err}`);
    }

    // Create PTY process
    // On Windows, node-pty cannot resolve .cmd/.bat scripts from PATH directly,
    // so we spawn through cmd.exe /c to get proper PATH resolution.
    let ptyProcess: IPty;
    const spawnCommand = process.platform === 'win32' ? 'cmd.exe' : config.command;
    const spawnArgs = process.platform === 'win32'
      ? ['/c', config.command, ...config.args]
      : config.args;
    try {
      ptyProcess = ptySpawn(spawnCommand, spawnArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env,
      });
    } catch (err: any) {
      // Record the failed process in DB
      const now = Date.now();
      try {
        const db = getDb();
        db.insert(schema.agentProcesses).values({
          id: instanceId,
          typeId,
          name: instanceName,
          status: 'FAILED',
          workDir: cwd,
          pid: null,
          exitCode: null,
          createdAt: now,
          stoppedAt: now,
          config: JSON.stringify({ command: config.command, args: config.args }),
        }).run();
      } catch { /* best-effort DB write */ }

      throw new Error(`Failed to start agent process: ${err.message}`);
    }

    // Create agent process record
    const agentProcess: AgentProcess = {
      id: instanceId,
      name: instanceName,
      typeId,
      status: 'RUNNING',
      workDir: cwd,
      createdAt: Date.now(),
      ptyProcess,
      outputBuffer: new RingBuffer(100_000),
      outputLog: [],
      parser: createParser(typeId),
    };

    this.processes.set(instanceId, agentProcess);

    // Bind events
    ptyProcess.onData((data: string) => this.handleOutput(agentProcess, data));
    ptyProcess.onExit(({ exitCode }: { exitCode: number; signal?: number }) =>
      this.handleExit(agentProcess, exitCode),
    );

    // Persist to DB
    try {
      const db = getDb();
      db.insert(schema.agentProcesses).values({
        id: instanceId,
        typeId,
        name: instanceName,
        status: 'RUNNING',
        workDir: cwd,
        pid: ptyProcess.pid,
        exitCode: null,
        createdAt: agentProcess.createdAt,
        stoppedAt: null,
        config: JSON.stringify({ command: config.command, args: config.args }),
      }).run();
    } catch (err) {
      logger.error('AgentProcessManager', `Failed to persist agent record ${instanceId}`, err);
    }

    // Send initial prompt (with delay so CLI can start)
    if (initialPrompt) {
      setTimeout(() => {
        try {
          this.sendInput(instanceId, initialPrompt);
        } catch (err) {
          logger.error('AgentProcessManager', `Failed to send initial prompt to ${instanceId}`, err);
        }
      }, 1500);
    }

    const info = this.toAgentInfo(agentProcess);

    // Notify all frontend clients
    this.broadcast('agent.created', info);

    logger.info('AgentProcessManager', `Created agent ${instanceName} (${instanceId}) [pid: ${ptyProcess.pid}]`);

    return info;
  }

  // --- Send Input ---

  sendInput(agentId: string, text: string): void {
    const agentProcess = this.processes.get(agentId);
    if (!agentProcess) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    if (agentProcess.status !== 'RUNNING') {
      throw new Error(`Agent is not running (status: ${agentProcess.status})`);
    }
    if (!agentProcess.ptyProcess) {
      throw new Error(`Agent PTY is not available`);
    }

    agentProcess.ptyProcess.write(text + '\r');

    // Record input in log
    const entry = { timestamp: Date.now(), type: 'user_input' as const, content: text };
    agentProcess.outputLog.push(entry);

    this.broadcast('agent.output', {
      agentId,
      data: { type: 'user_input', content: text } as ParsedOutput,
      index: agentProcess.outputLog.length - 1,
    });
  }

  // --- Send Raw Input (no trailing \r — for xterm.js keyboard forwarding) ---

  sendRawInput(agentId: string, data: string): void {
    const agentProcess = this.processes.get(agentId);
    if (!agentProcess) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    if (agentProcess.status !== 'RUNNING') {
      throw new Error(`Agent is not running (status: ${agentProcess.status})`);
    }
    if (!agentProcess.ptyProcess) {
      throw new Error(`Agent PTY is not available`);
    }

    agentProcess.ptyProcess.write(data);
  }

  // --- Resize PTY (sync xterm.js dimensions to backend) ---

  resizePty(agentId: string, cols: number, rows: number): void {
    const agentProcess = this.processes.get(agentId);
    if (!agentProcess || !agentProcess.ptyProcess) return;
    if (agentProcess.status !== 'RUNNING') return;
    if (cols < 1 || rows < 1 || cols > 500 || rows > 200) return;

    try {
      agentProcess.ptyProcess.resize(cols, rows);
    } catch {
      // Process may have exited between check and resize
    }
  }

  // --- Stop ---

  async stopProcess(agentId: string): Promise<void> {
    const agentProcess = this.processes.get(agentId);
    if (!agentProcess) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    if (!agentProcess.ptyProcess) {
      // Already stopped
      return;
    }

    // Mark as STOPPED *before* killing so handleExit sees it and returns early
    agentProcess.status = 'STOPPED';

    const ptyProc = agentProcess.ptyProcess;

    // Try graceful kill
    try {
      ptyProc.kill();
    } catch {
      // Process may already be dead
    }

    // Wait up to 5 seconds for exit
    const exited = await this.waitForExit(agentProcess, 5000);

    if (!exited && agentProcess.ptyProcess) {
      // Force kill
      try {
        if (process.platform === 'win32') {
          const { execSync } = await import('node:child_process');
          try {
            execSync(`taskkill /pid ${ptyProc.pid} /T /F`, { stdio: 'ignore' });
          } catch { /* process may already be gone */ }
        } else {
          process.kill(ptyProc.pid, 'SIGKILL');
        }
      } catch { /* process may already be gone */ }
    }

    agentProcess.ptyProcess = null;

    this.updateDbStatus(agentId, 'STOPPED');
    this.broadcast('agent.status', { agentId, status: 'STOPPED' });

    logger.info('AgentProcessManager', `Stopped agent ${agentId}`);
  }

  // --- Restart ---

  async restartProcess(agentId: string): Promise<AgentInfo> {
    let agentProcess = this.processes.get(agentId);

    // If not in memory, try loading from DB (e.g. after server restart)
    let typeId: AgentTypeId;
    let agentName: string;
    let agentWorkDir: string;

    if (agentProcess) {
      typeId = agentProcess.typeId;
      agentName = agentProcess.name;
      agentWorkDir = agentProcess.workDir;

      // Stop if running
      if (agentProcess.status === 'RUNNING' && agentProcess.ptyProcess) {
        await this.stopProcess(agentId);
      }

      // Remove old process record from memory
      this.processes.delete(agentId);
      this.clearTimers(agentId);
    } else {
      // Try loading from DB
      const db = getDb();
      const record = db.select().from(schema.agentProcesses)
        .where(eq(schema.agentProcesses.id, agentId))
        .get();
      if (!record) {
        throw new Error(`Agent not found: ${agentId}`);
      }
      typeId = record.typeId as AgentTypeId;
      agentName = record.name;
      agentWorkDir = record.workDir || '';
    }

    const config = getAgentType(typeId);
    if (!config) {
      throw new Error(`Agent type not found: ${typeId}`);
    }

    // Create new process with same name and workDir
    return this.createProcess(typeId, agentName, agentWorkDir || undefined);
  }

  // --- Delete ---

  async deleteProcess(agentId: string): Promise<void> {
    const agentProcess = this.processes.get(agentId);

    // Stop if running
    if (agentProcess && agentProcess.status === 'RUNNING' && agentProcess.ptyProcess) {
      await this.stopProcess(agentId);
    }

    // Remove from memory
    this.processes.delete(agentId);
    this.clearTimers(agentId);

    // Remove from DB
    try {
      const db = getDb();
      db.delete(schema.agentOutputs).where(eq(schema.agentOutputs.agentId, agentId)).run();
      db.delete(schema.agentProcesses).where(eq(schema.agentProcesses.id, agentId)).run();
    } catch (err) {
      logger.error('AgentProcessManager', `Failed to delete DB records for ${agentId}`, err);
    }

    this.broadcast('agent.status', { agentId, status: 'STOPPED', reason: 'deleted' });

    logger.info('AgentProcessManager', `Deleted agent ${agentId}`);
  }

  // --- Output Handling ---

  private handleOutput(agentProcess: AgentProcess, rawData: string): void {
    // 1. Append to ring buffer
    agentProcess.outputBuffer.append(rawData);

    // 2. Check backpressure — if all clients are backpressured, skip WS push
    //    but still parse and log to DB
    let allBackpressured = false;
    const clients = getConnectedClients();
    if (clients.size > 0) {
      allBackpressured = true;
      for (const client of clients) {
        if (!isBackpressured(client)) {
          allBackpressured = false;
          break;
        }
      }
    }

    // 3. Parse using the agent's parser
    const parsed = agentProcess.parser.parse(rawData);

    // 4. Append to structured log and schedule throttled WS push
    for (const item of parsed) {
      const entry = { timestamp: Date.now(), ...item };
      agentProcess.outputLog.push(entry);
      const currentIndex = agentProcess.outputLog.length - 1;

      // 5. Throttled WebSocket push (skip if all clients are backpressured)
      if (!allBackpressured) {
        this.throttledBroadcast(agentProcess.id, item, currentIndex);
      }
    }

    // 6. Schedule batch DB flush (always persist regardless of backpressure)
    this.scheduleFlush(agentProcess.id, parsed);
  }

  private throttledBroadcast(agentId: string, data: ParsedOutput, index: number): void {
    // Accumulate outputs with their indices, send at most every WS_THROTTLE_MS
    let buffer = this.wsThrottleBuffers.get(agentId);
    if (!buffer) {
      buffer = [];
      this.wsThrottleBuffers.set(agentId, buffer);
    }
    buffer.push({ data, index });

    if (!this.wsThrottleTimers.has(agentId)) {
      this.wsThrottleTimers.set(
        agentId,
        setTimeout(() => {
          const items = this.wsThrottleBuffers.get(agentId) || [];
          this.wsThrottleBuffers.set(agentId, []);
          this.wsThrottleTimers.delete(agentId);

          for (const item of items) {
            this.broadcast('agent.output', {
              agentId,
              data: item.data,
              index: item.index,
            });
          }
        }, WS_THROTTLE_MS),
      );
    }
  }

  // --- Exit Handling ---

  private handleExit(agentProcess: AgentProcess, exitCode: number): void {
    agentProcess.exitCode = exitCode;
    agentProcess.ptyProcess = null;

    // If already marked as STOPPED by user action, skip status update
    if (agentProcess.status === 'STOPPED') {
      return;
    }

    if (exitCode === 0) {
      agentProcess.status = 'EXITED';
    } else {
      agentProcess.status = 'CRASHED';
    }

    // Update DB
    this.updateDbStatus(agentProcess.id, agentProcess.status, exitCode);

    // Notify clients
    this.broadcast('agent.status', {
      agentId: agentProcess.id,
      status: agentProcess.status,
      exitCode,
    });

    // Flush any pending output
    this.flushOutputs(agentProcess.id);

    logger.info(
      'AgentProcessManager',
      `Agent ${agentProcess.id} exited (code: ${exitCode}, status: ${agentProcess.status})`,
    );
  }

  // --- DB Flush ---

  private scheduleFlush(agentId: string, items: ParsedOutput[]): void {
    let pending = this.pendingFlush.get(agentId);
    if (!pending) {
      pending = [];
      this.pendingFlush.set(agentId, pending);
    }
    for (const item of items) {
      pending.push({ timestamp: Date.now(), ...item });
    }

    if (!this.flushTimers.has(agentId)) {
      this.flushTimers.set(
        agentId,
        setTimeout(() => {
          this.flushOutputs(agentId);
        }, FLUSH_INTERVAL_MS),
      );
    }
  }

  private flushOutputs(agentId: string): void {
    const pending = this.pendingFlush.get(agentId);
    if (!pending || pending.length === 0) {
      this.flushTimers.delete(agentId);
      return;
    }

    this.pendingFlush.set(agentId, []);
    this.flushTimers.delete(agentId);

    try {
      const db = getDb();
      const rows = pending.map((item) => ({
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
    } catch (err) {
      logger.error('AgentProcessManager', `Failed to flush outputs for ${agentId}`, err);
    }
  }

  // --- Server Restart Recovery ---

  recoverAgents(): void {
    try {
      const db = getDb();
      const runningRecords = db
        .select()
        .from(schema.agentProcesses)
        .where(eq(schema.agentProcesses.status, 'RUNNING'))
        .all();

      const startingRecords = db
        .select()
        .from(schema.agentProcesses)
        .where(eq(schema.agentProcesses.status, 'STARTING'))
        .all();

      const records = [...runningRecords, ...startingRecords];

      if (records.length === 0) {
        logger.info('AgentProcessManager', 'No agents to recover');
        return;
      }

      for (const record of records) {
        db.update(schema.agentProcesses)
          .set({ status: 'STOPPED', stoppedAt: Date.now() })
          .where(eq(schema.agentProcesses.id, record.id))
          .run();

        logger.info(
          'AgentProcessManager',
          `Recovered agent ${record.id}: marked as STOPPED (server_restart)`,
        );
      }

      // Notify connected clients (if any are connected at startup)
      for (const record of records) {
        this.broadcast('agent.status', {
          agentId: record.id,
          status: 'STOPPED',
          reason: 'server_restart',
        });
      }

      logger.info('AgentProcessManager', `Recovered ${records.length} agents`);
    } catch (err) {
      logger.error('AgentProcessManager', 'Failed to recover agents', err);
    }
  }

  // --- Query Methods ---

  get(agentId: string): AgentProcess | undefined {
    return this.processes.get(agentId);
  }

  getInfo(agentId: string): AgentInfo | undefined {
    const proc = this.processes.get(agentId);
    if (!proc) return undefined;
    return this.toAgentInfo(proc);
  }

  listAll(): AgentInfo[] {
    // Combine in-memory running processes with DB records for stopped ones
    const result: AgentInfo[] = [];
    const seenIds = new Set<string>();

    // In-memory processes first
    for (const proc of this.processes.values()) {
      result.push(this.toAgentInfo(proc));
      seenIds.add(proc.id);
    }

    // DB records for stopped/exited/crashed/failed agents not in memory
    try {
      const db = getDb();
      const dbRecords = db.select().from(schema.agentProcesses).all();
      for (const rec of dbRecords) {
        if (seenIds.has(rec.id)) continue;
        result.push({
          id: rec.id,
          name: rec.name,
          typeId: rec.typeId as AgentTypeId,
          status: rec.status as AgentStatus,
          workDir: rec.workDir || '',
          createdAt: rec.createdAt,
        });
      }
    } catch (err) {
      logger.error('AgentProcessManager', 'Failed to load agents from DB', err);
    }

    return result;
  }

  getOutputHistory(agentId: string, fromIndex?: number): ParsedOutput[] {
    const proc = this.processes.get(agentId);
    if (proc) {
      const log = proc.outputLog;
      const start = fromIndex ?? 0;
      return log.slice(start).map(({ timestamp: _ts, ...rest }) => rest);
    }

    // Fallback: load from DB
    try {
      const db = getDb();
      const rows = db
        .select()
        .from(schema.agentOutputs)
        .where(eq(schema.agentOutputs.agentId, agentId))
        .all();
      return rows.map((r) => ({
        type: r.type as ParsedOutput['type'],
        content: r.content ?? undefined,
        tool: r.tool ?? undefined,
        args: r.args ?? undefined,
        success: r.success !== null ? r.success === 1 : undefined,
        duration: r.duration ?? undefined,
      }));
    } catch {
      return [];
    }
  }

  getRunningCount(): number {
    let count = 0;
    for (const proc of this.processes.values()) {
      if (proc.status === 'RUNNING') count++;
    }
    return count;
  }

  // --- Dispatch helpers (used by custom-tools.ts) ---

  findOrCreate(typeId: AgentTypeId, workDir?: string): Promise<AgentInfo> {
    // Find existing running agent of this type, matching workspace when provided
    for (const proc of this.processes.values()) {
      if (proc.typeId === typeId && proc.status === 'RUNNING') {
        if (workDir) {
          // Only reuse agents with matching workDir (normalize paths for comparison)
          if (resolve(proc.workDir) === resolve(workDir)) {
            return Promise.resolve(this.toAgentInfo(proc));
          }
          // Different workspace — skip this agent
          continue;
        }
        // No workDir constraint — legacy behavior: reuse any running agent of this type
        return Promise.resolve(this.toAgentInfo(proc));
      }
    }
    // Create a new one
    return this.createProcess(typeId, undefined, workDir);
  }

  autoSelect(_task: string, workDir?: string): Promise<AgentInfo> {
    // Find any running agent (matching workspace when provided), or create a claude-code one by default
    for (const proc of this.processes.values()) {
      if (proc.status === 'RUNNING') {
        if (workDir) {
          if (resolve(proc.workDir) === resolve(workDir)) {
            return Promise.resolve(this.toAgentInfo(proc));
          }
          continue;
        }
        return Promise.resolve(this.toAgentInfo(proc));
      }
    }
    return this.createProcess('claude-code', undefined, workDir);
  }

  // --- Helpers ---

  private toAgentInfo(proc: AgentProcess): AgentInfo {
    return {
      id: proc.id,
      name: proc.name,
      typeId: proc.typeId,
      status: proc.status,
      workDir: proc.workDir,
      createdAt: proc.createdAt,
    };
  }

  private getCredential(credKey: string): string | undefined {
    // Try environment variables with common patterns
    const envMappings: Record<string, string> = {
      anthropic_key: 'ANTHROPIC_API_KEY',
      openai_key: 'OPENAI_API_KEY',
      google_key: 'GOOGLE_API_KEY',
    };

    const envVar = envMappings[credKey];
    if (envVar && process.env[envVar]) {
      return process.env[envVar];
    }

    // Try credential store in DB (encrypted values — simplified for now)
    try {
      const db = getDb();
      const cred = db
        .select()
        .from(schema.credentials)
        .where(eq(schema.credentials.key, credKey))
        .get();
      if (cred) {
        // Full decryption will be implemented in 07-settings-and-credentials
        // For now, credentials are loaded from environment variables
        return undefined;
      }
    } catch { /* DB may not be ready */ }

    return undefined;
  }

  private updateDbStatus(agentId: string, status: AgentStatus, exitCode?: number): void {
    try {
      const db = getDb();
      const updates: Record<string, unknown> = { status, stoppedAt: Date.now() };
      if (exitCode !== undefined) {
        updates.exitCode = exitCode;
      }
      db.update(schema.agentProcesses)
        .set(updates)
        .where(eq(schema.agentProcesses.id, agentId))
        .run();
    } catch (err) {
      logger.error('AgentProcessManager', `Failed to update DB status for ${agentId}`, err);
    }
  }

  private waitForExit(agentProcess: AgentProcess, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!agentProcess.ptyProcess) {
        resolve(true);
        return;
      }

      let settled = false;

      const check = setInterval(() => {
        if (!agentProcess.ptyProcess) {
          settled = true;
          clearTimeout(timer);
          clearInterval(check);
          resolve(true);
        }
      }, 200);

      const timer = setTimeout(() => {
        if (!settled) {
          clearInterval(check);
          resolve(false);
        }
      }, timeoutMs);
    });
  }

  private broadcast(type: ServerMessageType, payload: unknown): void {
    broadcastToAllClients(type, payload);
  }

  private clearTimers(agentId: string): void {
    const flushTimer = this.flushTimers.get(agentId);
    if (flushTimer) {
      clearTimeout(flushTimer);
      this.flushTimers.delete(agentId);
    }
    const wsTimer = this.wsThrottleTimers.get(agentId);
    if (wsTimer) {
      clearTimeout(wsTimer);
      this.wsThrottleTimers.delete(agentId);
    }
    this.pendingFlush.delete(agentId);
    this.wsThrottleBuffers.delete(agentId);
  }

  // --- Cleanup ---

  async destroy(): Promise<void> {
    // Flush all pending outputs before destroying
    const agentIds = [...this.pendingFlush.keys()];
    for (const id of agentIds) {
      this.flushOutputs(id);
    }

    // Stop all running processes
    for (const proc of this.processes.values()) {
      if (proc.ptyProcess) {
        try {
          proc.ptyProcess.kill();
        } catch { /* ignore */ }
      }
    }

    // Clear all timers (collect keys first to avoid modifying during iteration)
    const timerIds = [...this.flushTimers.keys(), ...this.wsThrottleTimers.keys()];
    const uniqueIds = [...new Set(timerIds)];
    for (const id of uniqueIds) {
      this.clearTimers(id);
    }

    this.processes.clear();
    logger.info('AgentProcessManager', 'Destroyed');
  }
}

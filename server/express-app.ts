import express from 'express';
import { logger } from './utils/logger.js';
import type { AgentProcessManager } from './services/agent-process-manager.js';
import type { AgentTypeId } from '../shared/types.js';
import { getAllAgentTypes } from './services/agent-registry.js';

export interface ExpressAppOptions {
  dataDir: string;
  agentProcessManager: AgentProcessManager;
}

export function createExpressApp(options: ExpressAppOptions) {
  const { agentProcessManager } = options;
  const app = express();

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // --- REST API Routes ---

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Agent types
  app.get('/api/agent-types', (_req, res) => {
    const types = getAllAgentTypes();
    res.json(types);
  });

  // GET /api/agents — List all backend agents and their status
  app.get('/api/agents', (_req, res) => {
    try {
      const agents = agentProcessManager.listAll();
      res.json(agents);
    } catch (err: any) {
      logger.error('REST', 'Failed to list agents', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/agents — Create a new backend agent
  app.post('/api/agents', async (req, res) => {
    const { typeId, name, workDir, initialPrompt } = req.body;

    if (!typeId) {
      res.status(400).json({ error: 'typeId is required' });
      return;
    }

    try {
      const info = await agentProcessManager.createProcess(
        typeId as AgentTypeId,
        name,
        workDir,
        initialPrompt,
      );
      res.status(201).json(info);
    } catch (err: any) {
      logger.error('REST', 'Failed to create agent', err);
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/agents/:id — Stop and delete a backend agent
  app.delete('/api/agents/:id', async (req, res) => {
    const { id } = req.params;

    try {
      await agentProcessManager.deleteProcess(id);
      res.json({ success: true });
    } catch (err: any) {
      logger.error('REST', `Failed to delete agent ${id}`, err);
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/agents/:id/restart — Restart an agent
  app.post('/api/agents/:id/restart', async (req, res) => {
    const { id } = req.params;

    try {
      const info = await agentProcessManager.restartProcess(id);
      res.json(info);
    } catch (err: any) {
      logger.error('REST', `Failed to restart agent ${id}`, err);
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/agents/:id/stop — Stop an agent (convenience)
  app.post('/api/agents/:id/stop', async (req, res) => {
    const { id } = req.params;

    try {
      await agentProcessManager.stopProcess(id);
      res.json({ success: true });
    } catch (err: any) {
      logger.error('REST', `Failed to stop agent ${id}`, err);
      res.status(400).json({ error: err.message });
    }
  });

  // Settings
  app.get('/api/settings', (_req, res) => {
    // TODO: Implement in 07-settings-and-credentials
    res.json({});
  });

  app.put('/api/settings', (_req, res) => {
    // TODO: Implement in 07-settings-and-credentials
    res.status(501).json({ error: 'Not implemented' });
  });

  // Credentials
  app.get('/api/credentials', (_req, res) => {
    // TODO: Implement in 07-settings-and-credentials
    res.json([]);
  });

  app.put('/api/credentials/:key', (_req, res) => {
    // TODO: Implement in 07-settings-and-credentials
    res.status(501).json({ error: 'Not implemented' });
  });

  // File upload/download
  app.post('/api/upload', (_req, res) => {
    // TODO: Implement in 08-file-transfer
    res.status(501).json({ error: 'Not implemented' });
  });

  app.get('/api/download/:fileId', (_req, res) => {
    // TODO: Implement in 08-file-transfer
    res.status(501).json({ error: 'Not implemented' });
  });

  // Conversations
  app.get('/api/conversations', (_req, res) => {
    // TODO: Implement in 06-data-persistence
    res.json([]);
  });

  app.get('/api/conversations/:id', (_req, res) => {
    // TODO: Implement in 06-data-persistence
    res.status(501).json({ error: 'Not implemented' });
  });

  logger.info('Express', 'REST API routes mounted on /api/*');

  return app;
}

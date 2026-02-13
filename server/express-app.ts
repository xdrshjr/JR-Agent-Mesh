import express from 'express';
import { logger } from './utils/logger.js';

export function createExpressApp(_dataDir: string) {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // --- REST API Routes ---

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Agents
  app.get('/api/agents', (_req, res) => {
    // TODO: Implement in 04-backend-agent-manager
    res.json([]);
  });

  app.post('/api/agents', (_req, res) => {
    // TODO: Implement in 04-backend-agent-manager
    res.status(501).json({ error: 'Not implemented' });
  });

  app.delete('/api/agents/:id', (_req, res) => {
    // TODO: Implement in 04-backend-agent-manager
    res.status(501).json({ error: 'Not implemented' });
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

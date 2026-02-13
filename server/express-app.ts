import express from 'express';
import multer from 'multer';
import { existsSync, mkdirSync, createReadStream, statSync, renameSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger.js';
import type { AgentProcessManager } from './services/agent-process-manager.js';
import type { SelfAgentService } from './services/self-agent.js';
import type { AgentTypeId } from '../shared/types.js';
import { getAllAgentTypes } from './services/agent-registry.js';
import {
  ConversationRepository,
  MessageRepository,
  SettingsRepository,
  CredentialRepository,
  FileTransferRepository,
} from './db/repositories/index.js';
import { broadcastToAllClients } from './websocket/server.js';
import { getDb } from './db/index.js';
import * as schema from './db/schema.js';
import { detectProviderModels } from './services/model-detection.js';

export interface ExpressAppOptions {
  dataDir: string;
  agentProcessManager: AgentProcessManager;
  selfAgentService?: SelfAgentService;
}

export function createExpressApp(options: ExpressAppOptions) {
  const { agentProcessManager, selfAgentService } = options;
  const app = express();

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Repository instances
  const conversationRepo = new ConversationRepository();
  const messageRepo = new MessageRepository();
  const settingsRepo = new SettingsRepository();
  const credentialRepo = new CredentialRepository();
  const fileTransferRepo = new FileTransferRepository();

  // Upload limits
  const UPLOAD_MAX_FILE_SIZE = 50 * 1024 * 1024;   // 50MB per file
  const UPLOAD_MAX_TOTAL_SIZE = 200 * 1024 * 1024;  // 200MB total
  const UPLOAD_MAX_FILE_COUNT = 10;

  // Configure multer for file uploads
  const uploadDir = join(options.dataDir, 'uploads');
  const uploadTmpDir = join(options.dataDir, 'uploads', '_tmp');
  mkdirSync(uploadTmpDir, { recursive: true });

  const upload = multer({
    dest: uploadTmpDir,
    limits: {
      fileSize: UPLOAD_MAX_FILE_SIZE,
      files: UPLOAD_MAX_FILE_COUNT,
    },
  });

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

  // --- Conversations ---

  // GET /api/conversations — List conversations
  app.get('/api/conversations', (req, res) => {
    try {
      const archived = req.query.archived === 'true';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

      const conversations = conversationRepo.list({ archived, limit, offset });
      res.json(conversations);
    } catch (err: any) {
      logger.error('REST', 'Failed to list conversations', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/conversations/:id — Get conversation with messages
  app.get('/api/conversations/:id', (req, res) => {
    try {
      const conv = conversationRepo.getById(req.params.id);
      if (!conv) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      res.json(conv);
    } catch (err: any) {
      logger.error('REST', `Failed to get conversation ${req.params.id}`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/conversations/:id/title — Update conversation title
  app.put('/api/conversations/:id/title', (req, res) => {
    try {
      const { title } = req.body;
      if (typeof title !== 'string') {
        res.status(400).json({ error: 'title is required' });
        return;
      }
      conversationRepo.updateTitle(req.params.id, title);
      res.json({ success: true });
    } catch (err: any) {
      logger.error('REST', `Failed to update conversation title ${req.params.id}`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/conversations/:id/archive — Archive conversation
  app.post('/api/conversations/:id/archive', (req, res) => {
    try {
      conversationRepo.archive(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      logger.error('REST', `Failed to archive conversation ${req.params.id}`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/conversations/:id — Delete conversation
  app.delete('/api/conversations/:id', (req, res) => {
    try {
      conversationRepo.delete(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      logger.error('REST', `Failed to delete conversation ${req.params.id}`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- Settings ---

  app.get('/api/settings', (_req, res) => {
    try {
      const all = settingsRepo.getAll();
      // Group settings by category prefix (e.g. "self_agent.provider" → self_agent)
      const grouped: Record<string, Record<string, string>> = {};
      for (const [key, value] of all) {
        const dotIndex = key.indexOf('.');
        if (dotIndex > 0) {
          const category = key.substring(0, dotIndex);
          const field = key.substring(dotIndex + 1);
          if (!grouped[category]) grouped[category] = {};
          grouped[category][field] = value;
        } else {
          // Keys without a dot go into a "general" bucket
          if (!grouped['general']) grouped['general'] = {};
          grouped['general'][key] = value;
        }
      }
      res.json(grouped);
    } catch (err: any) {
      logger.error('REST', 'Failed to get settings', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/settings', (req, res) => {
    try {
      const entries = req.body;
      if (typeof entries !== 'object' || entries === null) {
        res.status(400).json({ error: 'Request body must be a key-value object' });
        return;
      }

      // Phase 1: Persist all settings to DB first
      const changedKeys: string[] = [];
      for (const [key, value] of Object.entries(entries)) {
        settingsRepo.set(key, String(value));
        changedKeys.push(key);
      }

      // Phase 2: React to changes (all values now in DB)
      onSettingsChanged(changedKeys);

      res.json({ success: true });
    } catch (err: any) {
      logger.error('REST', 'Failed to update settings', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- Setting Change Reactions ---

  function onSettingsChanged(keys: string[]): void {
    try {
      // Model / provider — do a single switchModel with final values from DB
      const modelRelatedKeys = [
        'self_agent.provider',
        'self_agent.model',
        'self_agent.custom_url',
        'self_agent.custom_model_id',
        'self_agent.provider_api_urls',
        'self_agent.custom_api_mode',
      ];
      if (keys.some((k) => modelRelatedKeys.includes(k))) {
        if (selfAgentService) {
          const provider = settingsRepo.get('self_agent.provider') || 'anthropic';
          const model = settingsRepo.get('self_agent.model') || 'claude-sonnet-4-5-20250929';
          selfAgentService.switchModel(provider, model);
        }
      }

      if (keys.includes('self_agent.system_prompt')) {
        if (selfAgentService) {
          const value = settingsRepo.get('self_agent.system_prompt') || '';
          selfAgentService.setSystemPrompt(value);
        }
      }

      if (keys.includes('notification.sound') || keys.includes('notification.browser')) {
        broadcastToAllClients('system.notification', {
          level: 'info',
          title: 'Settings Updated',
          message: 'Notification settings changed',
        });
      }

      if (keys.includes('agent.max_processes')) {
        const raw = settingsRepo.get('agent.max_processes');
        if (raw) {
          const max = parseInt(raw, 10);
          if (!isNaN(max) && max > 0) {
            agentProcessManager.setMaxProcesses(max);
          }
        }
      }
    } catch (err) {
      logger.error('REST', 'Error in onSettingsChanged', err);
    }
  }

  // --- Credentials ---

  app.get('/api/credentials', (_req, res) => {
    try {
      const list = credentialRepo.list();
      res.json(list);
    } catch (err: any) {
      logger.error('REST', 'Failed to list credentials', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/credentials/:key', (req, res) => {
    try {
      const { displayName, value, provider } = req.body;
      if (!value) {
        res.status(400).json({ error: 'value is required' });
        return;
      }
      credentialRepo.set(
        req.params.key,
        displayName || req.params.key,
        value,
        provider,
      );
      res.json({ success: true });
    } catch (err: any) {
      logger.error('REST', `Failed to set credential ${req.params.key}`, err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/credentials/:key', (req, res) => {
    try {
      credentialRepo.delete(req.params.key);
      res.json({ success: true });
    } catch (err: any) {
      logger.error('REST', `Failed to delete credential ${req.params.key}`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- Model Detection ---

  app.post('/api/providers/:provider/models', async (req, res) => {
    try {
      const { provider } = req.params;

      // Map provider to credential key
      const credKeyMap: Record<string, string> = {
        anthropic: 'anthropic_key',
        openai: 'openai_key',
        google: 'google_key',
        xai: 'xai_key',
        groq: 'groq_key',
        custom: 'custom_key',
      };

      const credKey = credKeyMap[provider];
      if (!credKey) {
        res.status(400).json({ error: `Unknown provider: ${provider}` });
        return;
      }

      // Look up API key from credential store
      const apiKey = credentialRepo.get(credKey);
      if (!apiKey) {
        res.status(400).json({ error: 'No API key configured for this provider', code: 'NO_KEY' });
        return;
      }

      // Look up override URL from settings
      let overrideUrl: string | undefined;
      const urlsJson = settingsRepo.get('self_agent.provider_api_urls');
      if (urlsJson) {
        try {
          const urls = JSON.parse(urlsJson);
          if (urls[provider]) {
            overrideUrl = urls[provider];
          }
        } catch { /* ignore parse errors */ }
      }

      // For custom provider, read the API mode setting
      let apiMode: string | undefined;
      if (provider === 'custom') {
        apiMode = settingsRepo.get('self_agent.custom_api_mode') || 'openai';
      }

      const result = await detectProviderModels(provider, apiKey, overrideUrl, apiMode);

      if (result.error) {
        res.status(502).json({ error: result.error, code: 'DETECTION_FAILED', models: result.models });
        return;
      }

      res.json({ models: result.models });
    } catch (err: any) {
      logger.error('REST', `Failed to detect models for ${req.params.provider}`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- File upload/download ---

  app.post('/api/upload', upload.array('files', UPLOAD_MAX_FILE_COUNT), (req, res) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files provided' });
        return;
      }

      // Check total size
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > UPLOAD_MAX_TOTAL_SIZE) {
        res.status(413).json({ error: `Total upload size exceeds ${UPLOAD_MAX_TOTAL_SIZE / 1024 / 1024}MB limit` });
        return;
      }

      const conversationId = (req.body?.conversationId as string) || undefined;
      const results: Array<{ fileId: string; filename: string; size: number }> = [];

      for (const file of files) {
        const fileId = uuidv4();
        const fileDir = join(uploadDir, fileId);
        mkdirSync(fileDir, { recursive: true });

        const safeName = basename(file.originalname);
        const destPath = join(fileDir, safeName);
        renameSync(file.path, destPath);

        // Record in database
        fileTransferRepo.create({
          id: fileId,
          conversationId,
          filename: safeName,
          filePath: destPath,
          fileSize: file.size,
          direction: 'upload',
          status: 'completed',
        });

        results.push({
          fileId,
          filename: safeName,
          size: file.size,
        });

        logger.info('Upload', `File uploaded: ${safeName} (${file.size} bytes) → ${fileId}`);
      }

      res.json({ files: results });
    } catch (err: any) {
      logger.error('REST', 'File upload failed', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Handle multer errors (file too large, too many files)
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: `File exceeds ${UPLOAD_MAX_FILE_SIZE / 1024 / 1024}MB size limit` });
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        res.status(413).json({ error: `Maximum ${UPLOAD_MAX_FILE_COUNT} files per upload` });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  });

  app.get('/api/download/:fileId', (req, res) => {
    try {
      const { fileId } = req.params;
      const record = fileTransferRepo.getById(fileId);

      if (!record) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      if (record.status === 'expired') {
        res.status(410).json({ error: 'File has expired' });
        return;
      }

      if (!existsSync(record.filePath)) {
        res.status(404).json({ error: 'File has been deleted' });
        return;
      }

      // Update status to completed and extend expiry to 7 days
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      fileTransferRepo.updateStatus(record.id, 'completed', Date.now() + sevenDays);

      // Determine MIME type
      const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.zip': 'application/zip',
        '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
        '.js': 'text/javascript',
        '.ts': 'text/typescript',
        '.py': 'text/x-python',
        '.html': 'text/html',
        '.css': 'text/css',
        '.xml': 'application/xml',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
      };

      const ext = extname(record.filename).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      const stat = statSync(record.filePath);

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.filename)}"`);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stat.size);

      const stream = createReadStream(record.filePath);
      stream.pipe(res);
    } catch (err: any) {
      logger.error('REST', `File download failed for ${req.params.fileId}`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- Data Export / Import ---

  // GET /api/export — Export conversations and settings as JSON
  app.get('/api/export', (_req, res) => {
    try {
      const conversations = conversationRepo.list({ limit: 10000 });
      const allMessages: Record<string, unknown[]> = {};

      for (const conv of conversations) {
        allMessages[conv.id] = messageRepo.listByConversation(conv.id);
      }

      const settings = Object.fromEntries(settingsRepo.getAll());

      const exportData = {
        version: 1,
        exportedAt: Date.now(),
        conversations: conversations.map((c: any) => ({
          ...c,
          messages: allMessages[c.id] || [],
        })),
        settings,
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="jragentmesh-export-${new Date().toISOString().slice(0, 10)}.json"`,
      );
      res.json(exportData);
    } catch (err: any) {
      logger.error('REST', 'Failed to export data', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/import — Import conversations and settings from JSON
  app.post('/api/import', (req, res) => {
    try {
      const data = req.body;

      if (!data || data.version !== 1) {
        res.status(400).json({ error: 'Invalid or unsupported export format' });
        return;
      }

      const mode = (req.query.mode as string) || 'merge'; // 'merge' | 'overwrite'
      const db = getDb();

      let importedConversations = 0;
      let importedSettings = 0;

      // Import settings
      if (data.settings && typeof data.settings === 'object') {
        for (const [key, value] of Object.entries(data.settings)) {
          if (mode === 'merge') {
            const existing = settingsRepo.get(key);
            if (existing === null) {
              settingsRepo.set(key, String(value));
              importedSettings++;
            }
          } else {
            settingsRepo.set(key, String(value));
            importedSettings++;
          }
        }
      }

      // Import conversations
      if (Array.isArray(data.conversations)) {
        for (const conv of data.conversations) {
          if (!conv.id) continue;

          const existing = conversationRepo.getById(conv.id);

          if (existing && mode === 'merge') {
            continue;
          }

          if (existing && mode === 'overwrite') {
            conversationRepo.delete(conv.id);
          }

          db.insert(schema.conversations)
            .values({
              id: conv.id,
              title: conv.title ?? null,
              modelProvider: conv.modelProvider ?? conv.model_provider ?? null,
              modelId: conv.modelId ?? conv.model_id ?? null,
              createdAt: conv.createdAt ?? conv.created_at ?? Date.now(),
              updatedAt: conv.updatedAt ?? conv.updated_at ?? Date.now(),
              isArchived: conv.isArchived ?? conv.is_archived ?? 0,
            })
            .onConflictDoNothing()
            .run();

          // Import messages
          if (Array.isArray(conv.messages)) {
            for (const msg of conv.messages) {
              if (!msg.id || !msg.role) continue; // skip malformed messages

              db.insert(schema.messages)
                .values({
                  id: msg.id,
                  conversationId: conv.id,
                  role: msg.role,
                  content: msg.content ?? null,
                  thinking: msg.thinking ?? null,
                  toolCalls: msg.toolCalls
                    ? (typeof msg.toolCalls === 'string' ? msg.toolCalls : JSON.stringify(msg.toolCalls))
                    : null,
                  attachments: msg.attachments
                    ? (typeof msg.attachments === 'string' ? msg.attachments : JSON.stringify(msg.attachments))
                    : null,
                  tokenUsage: msg.tokenUsage
                    ? (typeof msg.tokenUsage === 'string' ? msg.tokenUsage : JSON.stringify(msg.tokenUsage))
                    : null,
                  createdAt: msg.createdAt ?? msg.created_at ?? Date.now(),
                })
                .onConflictDoNothing()
                .run();
            }
          }

          importedConversations++;
        }
      }

      res.json({
        success: true,
        imported: {
          conversations: importedConversations,
          settings: importedSettings,
        },
      });
    } catch (err: any) {
      logger.error('REST', 'Failed to import data', err);
      res.status(500).json({ error: err.message });
    }
  });

  logger.info('Express', 'REST API routes mounted on /api/*');

  return app;
}

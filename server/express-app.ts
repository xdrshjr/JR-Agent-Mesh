import express from 'express';
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
} from './db/repositories/index.js';
import { broadcastToAllClients } from './websocket/server.js';
import { getDb } from './db/index.js';
import * as schema from './db/schema.js';

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
      if (keys.includes('self_agent.provider') || keys.includes('self_agent.model')) {
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

  // --- File upload/download ---

  app.post('/api/upload', (_req, res) => {
    // TODO: Implement in 08-file-transfer
    res.status(501).json({ error: 'Not implemented' });
  });

  app.get('/api/download/:fileId', (_req, res) => {
    // TODO: Implement in 08-file-transfer
    res.status(501).json({ error: 'Not implemented' });
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

import { Agent } from '@mariozechner/pi-agent-core';
import type { AgentTool, AgentEvent, AgentMessage } from '@mariozechner/pi-agent-core';
import {
  streamSimple,
  completeSimple,
  getModel,
  getModels,
  type Model,
  type Message,
  type UserMessage,
  type AssistantMessage as PiAssistantMessage,
  type ToolResultMessage,
  type TextContent,
  type ThinkingContent,
  type ToolCall,
  type Context,
} from '@mariozechner/pi-ai';
import { v4 as uuidv4 } from 'uuid';
import { eq, asc } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { CredentialRepository } from '../db/repositories/index.js';
import { broadcastToAllClients } from '../websocket/server.js';
import { logger } from '../utils/logger.js';
import type {
  ServerMessageType,
  Conversation,
  ContentBlock,
  ChatConversationUpdatedPayload,
  ChatStreamDeltaPayload,
  ChatThinkingDeltaPayload,
  ChatThinkingBlockStartPayload,
  ChatToolStartPayload,
  ChatToolEndPayload,
  ChatMessageCompletePayload,
  ChatErrorPayload,
  TokenUsage,
  ToolCallRecord,
} from '../../shared/types.js';
import { createReadTool, createWriteTool, createEditTool, createBashTool } from './tools/builtin-tools.js';
import { createFileTransferTool, createAgentDispatchTool } from './tools/custom-tools.js';
import type { AgentProcessManager } from './agent-process-manager.js';
import type { FileTransferService } from './file-transfer.js';
import type { SkillManagementService } from './skill-management.js';

// --- Default System Prompt ---

const DEFAULT_SYSTEM_PROMPT = `You are JRAgentMesh's built-in AI assistant with full general-purpose capabilities.

You can:
- Have natural language conversations with users
- Read, write, and edit files on the server
- Execute shell commands
- Assist with programming, documentation, file management, and other tasks
- Send files to users via the file_transfer tool`;

const DISPATCH_PROMPT_SUFFIX = `

You can also dispatch tasks to background agents:
- Use the agent_dispatch tool to assign tasks to a specific background agent
- Select the most appropriate agent based on the nature of the task, or let the user specify
- Each conversation is assigned an isolated workspace directory; the workDir is allocated automatically — do not specify it manually`;

// --- SelfAgentService ---

export interface SelfAgentServiceOptions {
  dataDir: string;
  agentProcessManager: AgentProcessManager;
  fileTransferService: FileTransferService;
  skillManagementService?: SkillManagementService;
}

export class SelfAgentService {
  private agent: Agent;
  private currentConversationId: string | null = null;
  private currentMessageId: string | null = null;
  private dispatchMode = false;
  private agentProcessManager: AgentProcessManager;
  private fileTransferService: FileTransferService;
  private skillManagementService?: SkillManagementService;
  private credentialRepo: CredentialRepository;
  private dataDir: string;
  private unsubscribe: (() => void) | null = null;

  // Tracking tool calls for the current message
  private toolCallStartTimes = new Map<string, number>();

  constructor(options: SelfAgentServiceOptions) {
    this.dataDir = options.dataDir;
    this.agentProcessManager = options.agentProcessManager;
    this.fileTransferService = options.fileTransferService;
    this.skillManagementService = options.skillManagementService;
    this.credentialRepo = new CredentialRepository();

    // Load settings from DB
    const { provider, modelId, systemPrompt, thinkingLevel } = this.loadSettings();

    // Get model from pi-ai
    const model = this.resolveModel(provider, modelId);

    // Build tools
    const tools = this.buildTools(false);

    // Create Agent instance
    this.agent = new Agent({
      initialState: {
        systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT,
        model,
        tools,
        thinkingLevel: (thinkingLevel || 'medium') as any,
      },
      streamFn: streamSimple,
      getApiKey: (prov) => this.getApiKeyForProvider(prov),
    });

    // Subscribe to agent events
    this.unsubscribe = this.agent.subscribe((event) => this.handleAgentEvent(event));

    logger.info('SelfAgent', `Initialized with ${provider}/${modelId}`);
  }

  // --- Settings ---

  private loadSettings(): {
    provider: string;
    modelId: string;
    systemPrompt: string;
    customUrl: string;
    customModelId: string;
    customApiMode: string;
    thinkingLevel: string;
  } {
    const db = getDb();
    const rows = db.select().from(schema.settings).all();
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return {
      provider: map.get('self_agent.provider') || 'anthropic',
      modelId: map.get('self_agent.model') || 'claude-sonnet-4-5-20250929',
      systemPrompt: map.get('self_agent.system_prompt') || '',
      customUrl: map.get('self_agent.custom_url') || '',
      customModelId: map.get('self_agent.custom_model_id') || '',
      customApiMode: map.get('self_agent.custom_api_mode') || 'openai',
      thinkingLevel: map.get('self_agent.thinking_level') || 'medium',
    };
  }

  private getApiKeyForProvider(provider: string): string | undefined {
    // Try environment variables first
    const envKeyMap: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      google: 'GOOGLE_API_KEY',
      xai: 'XAI_API_KEY',
      groq: 'GROQ_API_KEY',
      cerebras: 'CEREBRAS_API_KEY',
      mistral: 'MISTRAL_API_KEY',
    };

    const envKey = envKeyMap[provider];
    if (envKey && process.env[envKey]) {
      return process.env[envKey];
    }

    // Try credentials table (decrypt from encrypted storage)
    const credKeyMap: Record<string, string> = {
      anthropic: 'anthropic_key',
      openai: 'openai_key',
      google: 'google_key',
      xai: 'xai_key',
      groq: 'groq_key',
      custom: 'custom_key',
      cp_openai: 'cp_openai_key',
      cp_anthropic: 'cp_anthropic_key',
      cp_google: 'cp_google_key',
      cp_kimi: 'cp_kimi_key',
    };

    // For predefined providers use the map; for custom providers the key IS the provider id
    const credKey = credKeyMap[provider] || provider;
    try {
      const value = this.credentialRepo.get(credKey);
      if (value) return value;
    } catch {
      // Decryption failed or DB not available
    }

    return undefined;
  }

  private getProviderApiUrl(provider: string): string | undefined {
    try {
      const settingsKey = provider.startsWith('cp_')
        ? 'coding_plan.provider_api_urls'
        : 'self_agent.provider_api_urls';
      const db = getDb();
      const row = db.select().from(schema.settings)
        .where(eq(schema.settings.key, settingsKey))
        .get();
      if (row?.value) {
        const urls = JSON.parse(row.value);
        const url = urls[provider];
        if (url && typeof url === 'string' && url.trim()) {
          return url.trim();
        }
      }
    } catch {
      // Ignore parse/DB errors
    }
    return undefined;
  }

  private static CODING_PLAN_BASE: Record<string, string> = {
    cp_openai: 'openai',
    cp_anthropic: 'anthropic',
    cp_google: 'google',
    cp_kimi: 'anthropic',
  };

  private static CODING_PLAN_DEFAULT_URLS: Record<string, string> = {
    cp_openai: 'https://api.openai.com/v1',
    cp_anthropic: 'https://api.anthropic.com',
    cp_google: 'https://generativelanguage.googleapis.com',
    cp_kimi: 'https://api.kimi.com/coding',
  };

  private resolveModel(provider: string, modelId: string): Model<any> {
    // Handle custom provider — construct Model object from DB settings
    if (provider === 'custom') {
      return this.buildCustomModel();
    }

    // Handle coding plan providers — resolve via base provider's model registry
    const baseProvider = SelfAgentService.CODING_PLAN_BASE[provider];
    if (baseProvider) {
      const overrideUrl = this.getProviderApiUrl(provider);
      const defaultUrl = SelfAgentService.CODING_PLAN_DEFAULT_URLS[provider];
      const baseModels = getModels(baseProvider as any);
      if (baseModels.length > 0) {
        const found = baseModels.find((m) => m.id === modelId);
        const template = found || baseModels[0];
        return {
          ...template,
          id: modelId,
          name: found?.name || modelId,
          provider,
          baseUrl: overrideUrl || defaultUrl || '',
        };
      }
      // Fallback: construct model object manually
      return {
        id: modelId,
        name: modelId,
        api: baseProvider === 'google' ? 'google-generative' : (baseProvider === 'anthropic' ? 'anthropic-messages' : 'openai-completions'),
        provider,
        baseUrl: overrideUrl || defaultUrl || '',
        reasoning: false,
        input: ['text', 'image'] as ('text' | 'image')[],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      };
    }

    const models = getModels(provider as any);
    const overrideUrl = this.getProviderApiUrl(provider);

    if (models.length > 0) {
      // Known pi-ai provider
      const found = models.find((m) => m.id === modelId);
      if (found) {
        return overrideUrl ? { ...found, baseUrl: overrideUrl } : found;
      }
      // Model ID not in registry — use user's model ID with the provider's API type
      const template = models[0];
      return {
        ...template,
        id: modelId,
        name: modelId,
        ...(overrideUrl ? { baseUrl: overrideUrl } : {}),
      };
    }

    // Unknown/custom credential provider — construct OpenAI-compatible model
    return {
      id: modelId,
      name: modelId,
      api: 'openai-completions',
      provider,
      baseUrl: overrideUrl || '',
      reasoning: false,
      input: ['text', 'image'] as ('text' | 'image')[],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 4096,
    };
  }

  private buildCustomModel(): Model<any> {
    const db = getDb();
    const rows = db.select().from(schema.settings).all();
    const map = new Map(rows.map((r) => [r.key, r.value]));

    // Read from per-provider URLs first, then fall back to legacy custom_url
    let customUrl = '';
    const providerUrlsRaw = map.get('self_agent.provider_api_urls');
    if (providerUrlsRaw) {
      try {
        const urls = JSON.parse(providerUrlsRaw);
        if (urls['custom'] && typeof urls['custom'] === 'string') {
          customUrl = urls['custom'];
        }
      } catch { /* ignore */ }
    }
    if (!customUrl) {
      customUrl = map.get('self_agent.custom_url') || '';
    }
    const customModelId = map.get('self_agent.custom_model_id') || 'custom';
    const customApiMode = map.get('self_agent.custom_api_mode') || 'openai';

    if (!customUrl) {
      logger.warn('SelfAgent', 'Custom provider selected but no API URL configured');
    }

    const api = customApiMode === 'anthropic' ? 'anthropic-messages' : 'openai-completions';

    return {
      id: customModelId,
      name: customModelId,
      api,
      provider: 'custom',
      baseUrl: customUrl,
      reasoning: false,
      input: ['text', 'image'] as ('text' | 'image')[],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 4096,
    };
  }

  private buildTools(includeDispatch: boolean): AgentTool<any>[] {
    const getWorkspaceContext = () => ({
      conversationId: this.currentConversationId ?? undefined,
      dataDir: this.dataDir,
    });

    const tools: AgentTool<any>[] = [
      createReadTool(getWorkspaceContext),
      createWriteTool(getWorkspaceContext),
      createEditTool(getWorkspaceContext),
      createBashTool(getWorkspaceContext),
      createFileTransferTool(this.fileTransferService, () => ({
        conversationId: this.currentConversationId ?? undefined,
        messageId: this.currentMessageId ?? undefined,
      })),
    ];

    if (includeDispatch) {
      tools.push(createAgentDispatchTool(this.agentProcessManager, this.skillManagementService, getWorkspaceContext));
    }

    return tools;
  }

  // --- System Prompt ---

  private buildSystemPrompt(customPrompt?: string): string {
    let prompt = customPrompt || DEFAULT_SYSTEM_PROMPT;
    if (this.dispatchMode) {
      prompt += DISPATCH_PROMPT_SUFFIX;
    }

    // Inject active skill contents
    if (this.skillManagementService && this.currentConversationId) {
      try {
        const activeSkills = this.skillManagementService.getActiveSkillContents(
          'default',
          this.currentConversationId,
        );
        if (activeSkills.length > 0) {
          prompt += '\n\n# Active Skills\n\nThe following skills are available. Use them when relevant:\n\n';
          for (const skill of activeSkills) {
            prompt += `<skill name="${skill.name}">\n${skill.content}\n</skill>\n\n`;
          }
        }
      } catch (err) {
        logger.error('SelfAgent', 'Failed to inject skill contents', err);
      }
    }

    return prompt;
  }

  refreshSystemPrompt(): void {
    const { systemPrompt } = this.loadSettings();
    const prompt = this.buildSystemPrompt(systemPrompt || undefined);
    this.agent.setSystemPrompt(prompt);
    logger.info('SelfAgent', 'System prompt refreshed with skills');
  }

  // --- Agent Event Handling → WebSocket Forwarding ---

  private handleAgentEvent(event: AgentEvent): void {
    const conversationId = this.currentConversationId;
    if (!conversationId) return;

    switch (event.type) {
      case 'agent_start':
        // Generate a new message ID for the assistant response
        this.currentMessageId = `msg-${uuidv4()}`;
        break;

      case 'message_update': {
        const messageId = this.currentMessageId;
        if (!messageId) break;

        const aEvent = event.assistantMessageEvent;

        if (aEvent.type === 'thinking_start') {
          this.broadcast<ChatThinkingBlockStartPayload>('chat.thinking_block_start', {
            conversationId,
            messageId,
          });
        } else if (aEvent.type === 'text_delta') {
          this.broadcast<ChatStreamDeltaPayload>('chat.stream_delta', {
            conversationId,
            messageId,
            delta: aEvent.delta,
          });
        } else if (aEvent.type === 'thinking_delta') {
          this.broadcast<ChatThinkingDeltaPayload>('chat.thinking_delta', {
            conversationId,
            messageId,
            delta: aEvent.delta,
          });
        }
        break;
      }

      case 'tool_execution_start': {
        const messageId = this.currentMessageId;
        if (!messageId) break;

        this.toolCallStartTimes.set(event.toolCallId, Date.now());

        this.broadcast<ChatToolStartPayload>('chat.tool_start', {
          conversationId,
          messageId,
          toolCallId: event.toolCallId,
          tool: event.toolName,
          args: event.args,
        });
        break;
      }

      case 'tool_execution_end': {
        const messageId = this.currentMessageId;
        if (!messageId) break;

        const startTime = this.toolCallStartTimes.get(event.toolCallId) || Date.now();
        const duration = Date.now() - startTime;
        this.toolCallStartTimes.delete(event.toolCallId);

        // Extract result text
        let resultText: string | undefined;
        if (event.result?.content) {
          resultText = event.result.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
        }

        this.broadcast<ChatToolEndPayload>('chat.tool_end', {
          conversationId,
          messageId,
          toolCallId: event.toolCallId,
          tool: event.toolName,
          success: !event.isError,
          result: resultText,
          duration,
        });
        break;
      }

      case 'agent_end': {
        const messageId = this.currentMessageId;
        if (!messageId) break;

        // Extract usage from last assistant message
        const lastAssistant = event.messages
          .filter((m): m is PiAssistantMessage => (m as any).role === 'assistant')
          .pop();

        const usage: TokenUsage | undefined = lastAssistant?.usage
          ? {
              inputTokens: lastAssistant.usage.input,
              outputTokens: lastAssistant.usage.output,
              cost: lastAssistant.usage.cost?.total,
            }
          : undefined;

        this.broadcast<ChatMessageCompletePayload>('chat.message_complete', {
          conversationId,
          messageId,
          usage,
        });

        // Detect error recovery: empty messages indicates the agent loop
        // caught an error and closed the stream without producing a response
        if (!lastAssistant) {
          this.broadcast<ChatErrorPayload>('chat.error', {
            conversationId,
            error: 'Failed to get a response from the model. Check your API configuration and try again.',
            code: 'llm_error',
          });
        }

        // Persist messages to DB
        this.persistMessages(conversationId);

        this.currentMessageId = null;
        this.toolCallStartTimes.clear();
        break;
      }
    }
  }

  private broadcast<T>(type: ServerMessageType, payload: T): void {
    broadcastToAllClients(type, payload);
  }

  // --- User Interaction ---

  async handleUserMessage(conversationId: string, content: string, attachments?: any[]): Promise<void> {
    // Ensure we have a conversation
    if (!this.currentConversationId || this.currentConversationId !== conversationId) {
      await this.createOrLoadConversation(conversationId);
    }

    this.currentConversationId = conversationId;

    try {
      // Pre-flight validation: check model configuration before calling agent.prompt()
      // This is needed because pi-agent-core's agentLoop wraps runLoop in an IIFE
      // without .catch(), so errors during streaming cause the promise to hang forever.
      this.validateModelConfig();

      // Build user message with optional attachments
      let messageContent: string = content;
      if (attachments && attachments.length > 0) {
        const attachmentParts: string[] = [];
        for (const att of attachments) {
          const fileInfo = this.fileTransferService.getUploadInfo(att.fileId);
          if (fileInfo) {
            const sizeStr = fileInfo.fileSize < 1024
              ? `${fileInfo.fileSize} B`
              : fileInfo.fileSize < 1024 * 1024
                ? `${(fileInfo.fileSize / 1024).toFixed(1)} KB`
                : `${(fileInfo.fileSize / (1024 * 1024)).toFixed(1)} MB`;
            attachmentParts.push(
              `[Attached file: ${att.filename} (path: ${fileInfo.filePath}, size: ${sizeStr})]`
            );
          } else {
            attachmentParts.push(`[Attached file: ${att.filename}]`);
          }
        }
        messageContent = `${content}\n\n${attachmentParts.join('\n')}`;
      }

      await this.promptWithWatchdog(messageContent);
    } catch (err: any) {
      logger.error('SelfAgent', 'Error handling user message', err);

      // Recover from a potentially stuck agent
      try {
        this.agent.abort();
        await this.agent.waitForIdle();
      } catch {
        // Ignore recovery errors
      }

      this.broadcast<ChatErrorPayload>('chat.error', {
        conversationId,
        error: err.message || 'Unknown error occurred',
        code: 'llm_error',
      });
    }
  }

  /**
   * Wrap agent.prompt() with an idle watchdog that aborts if no agent events
   * are received within the timeout. This prevents permanent hangs when the
   * LLM call fails silently (e.g. network error, invalid URL).
   */
  private async promptWithWatchdog(content: string, idleTimeoutMs = 60_000): Promise<void> {
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let rejectPrompt: ((err: Error) => void) | null = null;

    const resetWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => {
        logger.error('SelfAgent', `Watchdog: no agent events for ${idleTimeoutMs / 1000}s, aborting`);
        this.agent.abort();
        rejectPrompt?.(new Error(
          `Agent response timed out (no activity for ${idleTimeoutMs / 1000}s). Check your model configuration and API URL.`
        ));
      }, idleTimeoutMs);
      if (watchdogTimer.unref) watchdogTimer.unref();
    };

    const unsubWatchdog = this.agent.subscribe(() => resetWatchdog());
    const watchdogPromise = new Promise<never>((_, reject) => { rejectPrompt = reject; });

    resetWatchdog();
    try {
      await Promise.race([this.agent.prompt(content), watchdogPromise]);
    } finally {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      unsubWatchdog();
    }
  }

  /**
   * Validate that the current model has the required configuration (API key, base URL)
   * before sending a prompt. Throws with a clear error message if misconfigured.
   */
  private validateModelConfig(): void {
    const model = this.agent.state.model;
    if (!model) {
      throw new Error('No model configured. Please select a model in Settings.');
    }

    // Check API key availability
    const apiKey = this.getApiKeyForProvider(model.provider);
    if (!apiKey) {
      const providerName = model.provider === 'custom' ? 'Custom LLM' : model.provider;
      throw new Error(
        `No API key configured for ${providerName}. Please set it in Settings → Credentials.`
      );
    }

    // For custom provider, also check that base URL is configured
    if (model.provider === 'custom' && !model.baseUrl) {
      throw new Error(
        'Custom LLM selected but no API URL configured. Please set it in Settings → Custom LLM → API URL.'
      );
    }

    // Custom credential providers (not built-in) require a base URL
    const hasBuiltinModels = getModels(model.provider as any).length > 0;
    if (!hasBuiltinModels && model.provider !== 'custom' && !model.baseUrl) {
      throw new Error(
        `No API URL configured for ${model.provider}. Please set it in Settings → Credentials.`
      );
    }
  }

  handleAbort(conversationId: string): void {
    if (this.currentConversationId !== conversationId) return;
    this.agent.abort();
    logger.info('SelfAgent', `Aborted conversation ${conversationId}`);
  }

  handleSteer(conversationId: string, content: string): void {
    if (this.currentConversationId !== conversationId) return;

    const steerMessage: UserMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.agent.steer(steerMessage);
    logger.info('SelfAgent', `Steer message queued for ${conversationId}`);
  }

  // --- Model Info ---

  getCurrentModel(): { provider: string; model: string } {
    return {
      provider: this.agent.state.model.provider,
      model: this.agent.state.model.id,
    };
  }

  // --- Model Switching ---

  switchModel(provider: string, modelId: string): void {
    const model = this.resolveModel(provider, modelId);
    this.agent.setModel(model);

    // Persist to settings
    try {
      const db = getDb();
      const now = Date.now();
      db.update(schema.settings)
        .set({ value: provider, updatedAt: now })
        .where(eq(schema.settings.key, 'self_agent.provider'))
        .run();
      db.update(schema.settings)
        .set({ value: modelId, updatedAt: now })
        .where(eq(schema.settings.key, 'self_agent.model'))
        .run();
    } catch (err) {
      logger.error('SelfAgent', 'Failed to persist model settings', err);
    }

    logger.info('SelfAgent', `Switched model to ${provider}/${modelId}`);
  }

  // --- System Prompt ---

  setSystemPrompt(prompt: string): void {
    this.agent.setSystemPrompt(this.buildSystemPrompt(prompt || undefined));
    logger.info('SelfAgent', 'System prompt updated');
  }

  // --- Clear Conversation ---

  clearConversation(conversationId: string): void {
    // Only clear agent memory if this is the active conversation
    if (this.currentConversationId === conversationId) {
      this.agent.clearMessages();
      this.agent.clearAllQueues();
    }

    // Delete messages from DB
    try {
      const db = getDb();
      db.delete(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .run();

      // Reset conversation title
      const now = Date.now();
      db.update(schema.conversations)
        .set({ title: null, updatedAt: now })
        .where(eq(schema.conversations.id, conversationId))
        .run();

      this.broadcast<ChatConversationUpdatedPayload>('chat.conversation_updated', {
        conversationId,
        title: null,
        updatedAt: now,
      });
    } catch (err) {
      logger.error('SelfAgent', 'Failed to clear conversation', err);
    }

    logger.info('SelfAgent', `Cleared conversation ${conversationId}`);
  }

  // --- Thinking Level ---

  setThinkingLevel(level: string): void {
    this.agent.setThinkingLevel(level as any);

    // Persist to settings
    try {
      const db = getDb();
      const now = Date.now();
      const existing = db.select().from(schema.settings)
        .where(eq(schema.settings.key, 'self_agent.thinking_level'))
        .get();

      if (existing) {
        db.update(schema.settings)
          .set({ value: level, updatedAt: now })
          .where(eq(schema.settings.key, 'self_agent.thinking_level'))
          .run();
      } else {
        db.insert(schema.settings).values({
          key: 'self_agent.thinking_level',
          value: level,
          updatedAt: now,
        }).run();
      }
    } catch (err) {
      logger.error('SelfAgent', 'Failed to persist thinking level', err);
    }

    logger.info('SelfAgent', `Thinking level set to: ${level}`);
  }

  getThinkingLevel(): string {
    return (this.agent.state as any).thinkingLevel || 'medium';
  }

  // --- Dispatch Mode ---

  toggleDispatch(enabled: boolean): void {
    this.dispatchMode = enabled;

    // Update tools
    const tools = this.buildTools(enabled);
    this.agent.setTools(tools);

    // Update system prompt
    const { systemPrompt } = this.loadSettings();
    this.agent.setSystemPrompt(this.buildSystemPrompt(systemPrompt));

    // Persist
    try {
      const db = getDb();
      db.update(schema.settings)
        .set({ value: String(enabled), updatedAt: Date.now() })
        .where(eq(schema.settings.key, 'dispatch.enabled'))
        .run();
    } catch (err) {
      logger.error('SelfAgent', 'Failed to persist dispatch setting', err);
    }

    logger.info('SelfAgent', `Dispatch mode: ${enabled}`);
  }

  // --- Conversation Management ---

  async createConversation(): Promise<Conversation> {
    const id = `conv-${uuidv4()}`;
    const now = Date.now();

    // Reset agent state
    this.agent.clearMessages();
    this.agent.clearAllQueues();
    this.currentConversationId = id;
    this.currentMessageId = null;

    // Persist to DB
    const db = getDb();
    db.insert(schema.conversations).values({
      id,
      title: null,
      modelProvider: this.agent.state.model.provider,
      modelId: this.agent.state.model.id,
      createdAt: now,
      updatedAt: now,
    }).run();

    logger.info('SelfAgent', `Created conversation ${id}`);
    return {
      id,
      title: null,
      modelProvider: this.agent.state.model.provider,
      modelId: this.agent.state.model.id,
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    };
  }

  async loadConversation(conversationId: string): Promise<void> {
    const db = getDb();

    // Get conversation
    const conv = db.select().from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();

    if (!conv) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Get messages ordered by creation time
    const dbMessages = db.select().from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(asc(schema.messages.createdAt))
      .all();

    // Reset agent and load messages
    this.agent.clearMessages();
    this.agent.clearAllQueues();
    this.currentConversationId = conversationId;

    // Convert DB messages to AgentMessage format
    const agentMessages: Message[] = [];
    for (const msg of dbMessages) {
      if (msg.role === 'user') {
        agentMessages.push({
          role: 'user',
          content: msg.content || '',
          timestamp: msg.createdAt,
        } as UserMessage);
      } else if (msg.role === 'assistant') {
        // Parse tool calls once
        let parsedToolCalls: ToolCallRecord[] | null = null;
        if (msg.toolCalls) {
          try {
            parsedToolCalls = JSON.parse(msg.toolCalls);
          } catch { /* ignore parse errors */ }
        }

        // Reconstruct assistant message content
        const content: (TextContent | ThinkingContent | ToolCall)[] = [];

        if (msg.thinking) {
          content.push({ type: 'thinking', thinking: msg.thinking } as ThinkingContent);
        }
        if (msg.content) {
          content.push({ type: 'text', text: msg.content } as TextContent);
        }

        if (parsedToolCalls) {
          for (const tc of parsedToolCalls) {
            content.push({
              type: 'toolCall',
              id: tc.id,
              name: tc.tool,
              arguments: tc.args,
            } as ToolCall);
          }
        }

        const stubUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
        agentMessages.push({
          role: 'assistant',
          content,
          api: (conv.modelProvider === 'openai' ? 'openai-completions' : 'anthropic-messages') as any,
          provider: conv.modelProvider || 'anthropic',
          model: conv.modelId || '',
          usage: stubUsage,
          stopReason: 'stop',
          timestamp: msg.createdAt,
        } as PiAssistantMessage);

        // Add tool results for tool calls
        if (parsedToolCalls) {
          for (const tc of parsedToolCalls) {
            agentMessages.push({
              role: 'toolResult',
              toolCallId: tc.id,
              toolName: tc.tool,
              content: [{ type: 'text', text: tc.result || '' } as TextContent],
              isError: !tc.success,
              timestamp: msg.createdAt,
            } as ToolResultMessage);
          }
        }
      }
    }

    this.agent.replaceMessages(agentMessages);
    this.refreshSystemPrompt();
    logger.info('SelfAgent', `Loaded conversation ${conversationId} with ${agentMessages.length} messages`);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const db = getDb();

    // Delete messages first (cascade should handle this, but be explicit)
    db.delete(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .run();

    // Delete conversation
    db.delete(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .run();

    // If this is the current conversation, clear agent state
    if (this.currentConversationId === conversationId) {
      this.agent.clearMessages();
      this.agent.clearAllQueues();
      this.currentConversationId = null;
      this.currentMessageId = null;
    }

    logger.info('SelfAgent', `Deleted conversation ${conversationId}`);
  }

  renameConversation(conversationId: string, title: string): number {
    const db = getDb();
    const now = Date.now();
    db.update(schema.conversations)
      .set({ title, updatedAt: now })
      .where(eq(schema.conversations.id, conversationId))
      .run();
    logger.info('SelfAgent', `Renamed conversation ${conversationId} to "${title}"`);
    return now;
  }

  deleteAllConversations(): void {
    const db = getDb();
    db.delete(schema.messages).run();
    db.delete(schema.conversations).run();

    // Clear agent state
    this.agent.clearMessages();
    this.agent.clearAllQueues();
    this.currentConversationId = null;
    this.currentMessageId = null;

    logger.info('SelfAgent', 'Deleted all conversations');
  }

  private async createOrLoadConversation(conversationId: string): Promise<void> {
    const db = getDb();
    const existing = db.select().from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();

    if (existing) {
      await this.loadConversation(conversationId);
    } else {
      // Create new conversation with the provided ID
      const now = Date.now();
      this.agent.clearMessages();
      this.agent.clearAllQueues();
      this.currentConversationId = conversationId;
      this.currentMessageId = null;

      db.insert(schema.conversations).values({
        id: conversationId,
        title: null,
        modelProvider: this.agent.state.model.provider,
        modelId: this.agent.state.model.id,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  }

  // --- Persistence ---

  private persistMessages(conversationId: string): void {
    try {
      const db = getDb();
      const agentMessages = this.agent.state.messages;

      // Get existing message IDs for this conversation
      const existingIds = new Set(
        db.select({ id: schema.messages.id })
          .from(schema.messages)
          .where(eq(schema.messages.conversationId, conversationId))
          .all()
          .map((r) => r.id),
      );

      // Build a list of messages to persist
      let msgIndex = 0;
      for (const msg of agentMessages) {
        const role = (msg as any).role;
        if (role !== 'user' && role !== 'assistant') continue;

        const msgId = `${conversationId}-${msgIndex++}`;
        if (existingIds.has(msgId)) continue;

        if (role === 'user') {
          const userMsg = msg as UserMessage;
          const content = typeof userMsg.content === 'string'
            ? userMsg.content
            : userMsg.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('\n');

          db.insert(schema.messages).values({
            id: msgId,
            conversationId,
            role: 'user',
            content,
            thinking: null,
            toolCalls: null,
            attachments: null,
            tokenUsage: null,
            createdAt: userMsg.timestamp || Date.now(),
          }).onConflictDoNothing().run();
        } else if (role === 'assistant') {
          const assistantMsg = msg as PiAssistantMessage;

          // Extract text content
          const textParts = assistantMsg.content
            .filter((c): c is TextContent => c.type === 'text')
            .map((c) => c.text);
          const text = textParts.join('') || null;

          // Extract thinking content
          const thinkingParts = assistantMsg.content
            .filter((c): c is ThinkingContent => c.type === 'thinking')
            .map((c) => c.thinking);
          const thinking = thinkingParts.join('') || null;

          // Extract tool calls
          const toolCalls = assistantMsg.content
            .filter((c): c is ToolCall => c.type === 'toolCall')
            .map((tc) => ({
              id: tc.id,
              tool: tc.name,
              args: tc.arguments,
              success: true,
              duration: 0,
              startedAt: assistantMsg.timestamp,
            }));

          const usage: TokenUsage | null = assistantMsg.usage
            ? {
                inputTokens: assistantMsg.usage.input,
                outputTokens: assistantMsg.usage.output,
                cost: assistantMsg.usage.cost?.total,
              }
            : null;

          // Build interleaved contentBlocks preserving order from assistant message
          const contentBlocks: ContentBlock[] = assistantMsg.content
            .map((c): ContentBlock | null => {
              if (c.type === 'text') return { type: 'text', text: (c as TextContent).text };
              if (c.type === 'thinking') return { type: 'thinking', text: (c as ThinkingContent).thinking };
              if (c.type === 'toolCall') return { type: 'tool_use', toolCallId: (c as ToolCall).id };
              return null;
            })
            .filter((b): b is ContentBlock => b !== null);

          db.insert(schema.messages).values({
            id: msgId,
            conversationId,
            role: 'assistant',
            content: text,
            thinking,
            toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
            contentBlocks: contentBlocks.length > 0 ? JSON.stringify(contentBlocks) : null,
            attachments: null,
            tokenUsage: usage ? JSON.stringify(usage) : null,
            createdAt: assistantMsg.timestamp || Date.now(),
          }).onConflictDoNothing().run();
        }
      }

      // Update conversation timestamp
      const updatedAt = Date.now();
      db.update(schema.conversations)
        .set({ updatedAt })
        .where(eq(schema.conversations.id, conversationId))
        .run();

      // Auto-generate title from first user message if needed, and broadcast update
      this.maybeUpdateTitle(conversationId, updatedAt);
    } catch (err) {
      logger.error('SelfAgent', 'Failed to persist messages', err);
    }
  }

  private maybeUpdateTitle(conversationId: string, updatedAt: number): void {
    const db = getDb();
    const conv = db.select().from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();

    if (!conv) return;

    if (!conv.title) {
      // Use the first user message as title
      const firstUserMsg = this.agent.state.messages.find(
        (m) => (m as any).role === 'user',
      );
      if (firstUserMsg) {
        const content = (firstUserMsg as UserMessage).content;
        const text = typeof content === 'string' ? content : '';
        const title = text.length > 50 ? text.slice(0, 47) + '...' : text;

        if (title) {
          const now = Date.now();
          db.update(schema.conversations)
            .set({ title, updatedAt: now })
            .where(eq(schema.conversations.id, conversationId))
            .run();

          this.broadcast<ChatConversationUpdatedPayload>('chat.conversation_updated', {
            conversationId,
            title,
            updatedAt: now,
          });
          return;
        }
      }
    }

    // Broadcast updatedAt so sidebar reorders by most recent activity
    this.broadcast<ChatConversationUpdatedPayload>('chat.conversation_updated', {
      conversationId,
      updatedAt,
    });
  }

  // --- Public getters ---

  getCurrentConversationId(): string | null {
    return this.currentConversationId;
  }

  isDispatchMode(): boolean {
    return this.dispatchMode;
  }

  getAgentState() {
    return this.agent.state;
  }

  // --- Skill Generation ---

  private static SKILL_GENERATION_SYSTEM_PROMPT = `You are a skill extraction specialist. Your job is to analyze a conversation between a user and an AI assistant and extract a reusable skill document.

A "skill" is a structured methodology guide that captures HOW to accomplish a type of task — not a transcript of a specific conversation. It should be general enough to apply to similar future tasks.

Output format:
1. Start with YAML frontmatter delimited by --- lines containing:
   - name: A short, descriptive skill name (3-8 words, imperative form like "Debug React Component Errors")
   - description: A one-sentence summary of what this skill helps with

2. Follow with structured markdown sections:
   - ## When to Use — Describe the situations/triggers when this skill applies
   - ## Approach — Step-by-step methodology (numbered list)
   - ## Key Patterns — Important patterns, heuristics, or decision points discovered
   - ## Tools & Commands — Specific tools, commands, or APIs used (with examples)
   - ## Common Pitfalls — Mistakes to avoid or edge cases to watch for

Focus on extracting generalizable methodology, not conversation-specific details. If the conversation is about fixing a specific bug, the skill should be about the debugging approach used, not the specific bug.

Keep the skill concise — aim for 300-800 words in the body.`;

  private buildConversationTranscript(messages: Array<{
    role: string;
    content: string | null;
    toolCalls?: Array<{ tool: string; args: any; result?: string; success: boolean; duration: number }> | null;
  }>): string {
    const turns: string[] = [];

    for (const msg of messages) {
      if (msg.role !== 'user' && msg.role !== 'assistant') continue;

      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const parts: string[] = [];

      // Text content (truncated)
      if (msg.content) {
        const text = msg.content.length > 1000
          ? msg.content.substring(0, 1000) + '... [truncated]'
          : msg.content;
        parts.push(text);
      }

      // Tool calls
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          const status = tc.success ? 'SUCCESS' : 'FAILED';
          const duration = tc.duration ? ` (${tc.duration}ms)` : '';
          let args = '';
          try {
            args = tc.args ? JSON.stringify(tc.args).substring(0, 300) : '';
          } catch { /* ignore stringify errors */ }
          const result = tc.result
            ? tc.result.substring(0, 200)
            : '';
          parts.push(`[Tool: ${tc.tool}] ${status}${duration}\n  Args: ${args}\n  Result: ${result}`);
        }
      }

      if (parts.length > 0) {
        turns.push(`### ${role}\n${parts.join('\n')}`);
      }
    }

    let transcript = turns.join('\n\n');

    // Global truncation: if too long, keep first 2 + last 3 turns
    if (transcript.length > 30000 && turns.length > 5) {
      const kept = [
        ...turns.slice(0, 2),
        '\n--- [middle of conversation omitted for brevity] ---\n',
        ...turns.slice(-3),
      ];
      transcript = kept.join('\n\n');
    }

    return transcript;
  }

  private parseSkillResponse(response: string): { name: string; description: string; content: string } {
    // Match frontmatter anywhere in the response (LLMs may prefix with text)
    const frontmatterMatch = response.match(/---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      return {
        name: 'Untitled Skill',
        description: '',
        content: response.trim(),
      };
    }

    const frontmatter = frontmatterMatch[1];
    const content = frontmatterMatch[2].trim();

    // Extract name and description from YAML frontmatter
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

    return {
      name: nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, '') : 'Untitled Skill',
      description: descMatch ? descMatch[1].trim().replace(/^["']|["']$/g, '') : '',
      content,
    };
  }

  async generateSkillDraft(messages: Array<{
    role: string;
    content: string | null;
    toolCalls?: Array<{ tool: string; args: any; result?: string; success: boolean; duration: number }> | null;
  }>): Promise<{ name: string; description: string; content: string }> {
    // Build conversation transcript
    const transcript = this.buildConversationTranscript(messages);

    // Get current model and API key
    const { provider, modelId } = this.loadSettings();
    const model = this.resolveModel(provider, modelId);
    const apiKey = this.getApiKeyForProvider(model.provider);

    if (!apiKey) {
      throw new Error(`No API key available for provider: ${model.provider}`);
    }

    // Build context for one-shot LLM call
    const context: Context = {
      systemPrompt: SelfAgentService.SKILL_GENERATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze the following conversation and extract a reusable skill document:\n\n${transcript}`,
          timestamp: Date.now(),
        } as UserMessage,
      ],
    };

    // Make the LLM call
    const response = await completeSimple(model, context, {
      apiKey,
      maxTokens: 4096,
    });

    // Extract text from response
    const textParts = response.content
      .filter((c): c is TextContent => c.type === 'text')
      .map((c) => c.text);
    const responseText = textParts.join('');

    if (!responseText) {
      throw new Error('LLM returned empty response');
    }

    return this.parseSkillResponse(responseText);
  }

  // --- Cleanup ---

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.agent.abort();
    logger.info('SelfAgent', 'Destroyed');
  }
}

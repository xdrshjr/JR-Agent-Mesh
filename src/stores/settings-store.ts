import { create } from 'zustand';

// --- Credential Types ---

export interface CredentialType {
  key: string;
  displayName: string;
  provider: string;
  placeholder: string;
  description: string;
}

export const CREDENTIAL_TYPES: CredentialType[] = [
  {
    key: 'anthropic_key',
    displayName: 'Anthropic API Key',
    provider: 'anthropic',
    placeholder: 'sk-ant-...',
    description: 'Used for Claude models and Claude Code',
  },
  {
    key: 'openai_key',
    displayName: 'OpenAI API Key',
    provider: 'openai',
    placeholder: 'sk-...',
    description: 'Used for GPT models, OpenCode, and Codex',
  },
  {
    key: 'google_key',
    displayName: 'Google AI API Key',
    provider: 'google',
    placeholder: 'AIza...',
    description: 'Used for Gemini models',
  },
  {
    key: 'xai_key',
    displayName: 'xAI API Key',
    provider: 'xai',
    placeholder: 'xai-...',
    description: 'Used for Grok models',
  },
  {
    key: 'groq_key',
    displayName: 'Groq API Key',
    provider: 'groq',
    placeholder: 'gsk_...',
    description: 'Used for Groq inference acceleration',
  },
  {
    key: 'custom_key',
    displayName: 'Custom API Key',
    provider: 'custom',
    placeholder: '',
    description: 'Used for custom OpenAI-compatible API',
  },
];

// --- Credential Info (from server) ---

export interface CredentialInfo {
  key: string;
  displayName: string;
  provider: string | null;
  hasValue: boolean;
  maskedValue: string | null;
  updatedAt: number;
}

// --- Settings State ---

interface SettingsState {
  // Self Agent
  defaultProvider: string;
  defaultModel: string;
  providerApiUrls: Record<string, string>;
  customModelId: string;
  customApiMode: 'openai' | 'anthropic';
  systemPrompt: string;

  // Backend Agent
  agentConfigs: Record<string, { cliPath: string; defaultArgs: string }>;

  // Notifications
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;

  // General
  dataRetentionDays: number;
  agentLogRetentionDays: number;

  // Credentials (fetched from server)
  credentials: CredentialInfo[];

  // Model detection
  detectedModels: Record<string, { id: string; name: string }[]>;
  isDetectingModels: Record<string, boolean>;
  modelDetectionErrors: Record<string, string | null>;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isLoaded: boolean;

  // Actions — local state setters
  setDefaultProvider: (provider: string) => void;
  setDefaultModel: (model: string) => void;
  setProviderApiUrl: (provider: string, url: string) => void;
  setCustomModelId: (id: string) => void;
  setCustomApiMode: (mode: 'openai' | 'anthropic') => void;
  setSystemPrompt: (prompt: string) => void;

  setAgentConfig: (typeId: string, config: { cliPath: string; defaultArgs: string }) => void;

  setSoundEnabled: (enabled: boolean) => void;
  setBrowserNotificationsEnabled: (enabled: boolean) => void;

  setDataRetentionDays: (days: number) => void;
  setAgentLogRetentionDays: (days: number) => void;

  // Server sync actions
  fetchSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  fetchCredentials: () => Promise<void>;
  saveCredential: (key: string, value: string) => Promise<void>;
  deleteCredential: (key: string) => Promise<void>;
  detectModels: (provider: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  defaultProvider: 'anthropic',
  defaultModel: 'claude-sonnet-4-5-20250929',
  providerApiUrls: {},
  customModelId: '',
  customApiMode: 'openai',
  systemPrompt: '',

  agentConfigs: {
    'claude-code': { cliPath: 'claude', defaultArgs: '' },
    opencode: { cliPath: 'opencode', defaultArgs: '' },
    codex: { cliPath: 'codex', defaultArgs: '' },
  },

  soundEnabled: true,
  browserNotificationsEnabled: false,

  dataRetentionDays: 90,
  agentLogRetentionDays: 30,

  credentials: [],

  detectedModels: {},
  isDetectingModels: {},
  modelDetectionErrors: {},

  isLoading: false,
  isSaving: false,
  isLoaded: false,

  setDefaultProvider: (provider) => set({ defaultProvider: provider }),
  setDefaultModel: (model) => set({ defaultModel: model }),
  setProviderApiUrl: (provider, url) =>
    set((s) => ({
      providerApiUrls: { ...s.providerApiUrls, [provider]: url },
    })),
  setCustomModelId: (id) => set({ customModelId: id }),
  setCustomApiMode: (mode) => set({ customApiMode: mode }),
  setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),

  setAgentConfig: (typeId, config) =>
    set((s) => ({
      agentConfigs: { ...s.agentConfigs, [typeId]: config },
    })),

  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
  setBrowserNotificationsEnabled: (enabled) => set({ browserNotificationsEnabled: enabled }),

  setDataRetentionDays: (days) => set({ dataRetentionDays: days }),
  setAgentLogRetentionDays: (days) => set({ agentLogRetentionDays: days }),

  // --- Server Sync ---

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();

      // Map grouped server settings to store fields
      const selfAgent = data.self_agent || {};
      const notification = data.notification || {};
      const agent = data.agent || {};
      const general = data.general || {};

      // Parse per-provider API URLs
      let providerApiUrls: Record<string, string> = {};
      if (selfAgent.provider_api_urls) {
        try {
          providerApiUrls = JSON.parse(selfAgent.provider_api_urls);
        } catch { /* ignore parse errors */ }
      }
      // Backward compat: migrate old custom_url into providerApiUrls
      if (selfAgent.custom_url && !providerApiUrls['custom']) {
        providerApiUrls['custom'] = selfAgent.custom_url;
      }

      set({
        defaultProvider: selfAgent.provider ?? 'anthropic',
        defaultModel: selfAgent.model ?? 'claude-sonnet-4-5-20250929',
        providerApiUrls,
        customModelId: selfAgent.custom_model_id ?? '',
        customApiMode: (selfAgent.custom_api_mode === 'anthropic' ? 'anthropic' : 'openai') as 'openai' | 'anthropic',
        systemPrompt: selfAgent.system_prompt ?? '',

        soundEnabled: notification.sound !== 'false',
        browserNotificationsEnabled: notification.browser === 'true',

        dataRetentionDays: parseInt(general.conversation_retention_days ?? '90', 10),
        agentLogRetentionDays: parseInt(general.agent_log_retention_days ?? '30', 10),

        isLoaded: true,
      });

      // Parse agent configs from server
      if (agent.cli_paths) {
        try {
          const cliPaths = JSON.parse(agent.cli_paths);
          if (typeof cliPaths === 'object') {
            set((s) => ({
              agentConfigs: { ...s.agentConfigs, ...cliPaths },
            }));
          }
        } catch { /* ignore parse errors */ }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  saveSettings: async () => {
    const state = get();
    set({ isSaving: true });
    try {
      const payload: Record<string, string> = {
        'self_agent.provider': state.defaultProvider,
        'self_agent.model': state.defaultModel,
        'self_agent.provider_api_urls': JSON.stringify(state.providerApiUrls),
        'self_agent.custom_url': state.providerApiUrls['custom'] ?? '',
        'self_agent.custom_model_id': state.customModelId,
        'self_agent.custom_api_mode': state.customApiMode,
        'self_agent.system_prompt': state.systemPrompt,
        'notification.sound': String(state.soundEnabled),
        'notification.browser': String(state.browserNotificationsEnabled),
        'general.conversation_retention_days': String(state.dataRetentionDays),
        'general.agent_log_retention_days': String(state.agentLogRetentionDays),
        'agent.cli_paths': JSON.stringify(state.agentConfigs),
      };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save settings');
    } catch (err) {
      console.error('Failed to save settings:', err);
      throw err;
    } finally {
      set({ isSaving: false });
    }
  },

  fetchCredentials: async () => {
    try {
      const res = await fetch('/api/credentials');
      if (!res.ok) throw new Error('Failed to fetch credentials');
      const data: CredentialInfo[] = await res.json();
      set({ credentials: data });
    } catch (err) {
      console.error('Failed to fetch credentials:', err);
    }
  },

  saveCredential: async (key: string, value: string) => {
    const credType = CREDENTIAL_TYPES.find((t) => t.key === key);
    try {
      const res = await fetch(`/api/credentials/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value,
          displayName: credType?.displayName || key,
          provider: credType?.provider || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save credential');

      // Refresh credentials list
      await get().fetchCredentials();
    } catch (err) {
      console.error('Failed to save credential:', err);
      throw err;
    }
  },

  deleteCredential: async (key: string) => {
    try {
      const res = await fetch(`/api/credentials/${key}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete credential');

      // Refresh credentials list
      await get().fetchCredentials();
    } catch (err) {
      console.error('Failed to delete credential:', err);
      throw err;
    }
  },

  detectModels: async (provider: string) => {
    set((s) => ({
      isDetectingModels: { ...s.isDetectingModels, [provider]: true },
      modelDetectionErrors: { ...s.modelDetectionErrors, [provider]: null },
    }));
    try {
      const res = await fetch(`/api/providers/${provider}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (!res.ok && (!data.models || data.models.length === 0)) {
        set((s) => ({
          modelDetectionErrors: {
            ...s.modelDetectionErrors,
            [provider]: data.error || 'Failed to detect models',
          },
        }));
        return;
      }

      set((s) => ({
        detectedModels: { ...s.detectedModels, [provider]: data.models },
        modelDetectionErrors: {
          ...s.modelDetectionErrors,
          [provider]: data.error || null,
        },
      }));
    } catch (err) {
      console.error('Failed to detect models:', err);
      set((s) => ({
        modelDetectionErrors: {
          ...s.modelDetectionErrors,
          [provider]: err instanceof Error ? err.message : 'Network error',
        },
      }));
    } finally {
      set((s) => ({
        isDetectingModels: { ...s.isDetectingModels, [provider]: false },
      }));
    }
  },
}));

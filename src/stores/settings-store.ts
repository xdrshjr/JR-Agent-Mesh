import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Credential {
  id: string;
  name: string;
  provider: string;
  maskedValue: string;
}

interface SettingsState {
  // Self Agent
  defaultProvider: string;
  defaultModel: string;
  customApiUrl: string;
  customApiKey: string;
  customModelId: string;
  systemPrompt: string;

  // Backend Agent
  agentConfigs: Record<string, { cliPath: string; defaultArgs: string }>;

  // Notifications
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;

  // General
  dataRetentionDays: number;

  // Credentials (fetched from server, not persisted locally)
  credentials: Credential[];

  // Actions
  setDefaultProvider: (provider: string) => void;
  setDefaultModel: (model: string) => void;
  setCustomApiUrl: (url: string) => void;
  setCustomApiKey: (key: string) => void;
  setCustomModelId: (id: string) => void;
  setSystemPrompt: (prompt: string) => void;

  setAgentConfig: (typeId: string, config: { cliPath: string; defaultArgs: string }) => void;

  setSoundEnabled: (enabled: boolean) => void;
  setBrowserNotificationsEnabled: (enabled: boolean) => void;

  setDataRetentionDays: (days: number) => void;

  setCredentials: (creds: Credential[]) => void;
  addCredential: (cred: Credential) => void;
  removeCredential: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultProvider: 'anthropic',
      defaultModel: 'claude-sonnet-4-5-20250929',
      customApiUrl: '',
      customApiKey: '',
      customModelId: '',
      systemPrompt: '',

      agentConfigs: {
        'claude-code': { cliPath: 'claude', defaultArgs: '' },
        opencode: { cliPath: 'opencode', defaultArgs: '' },
        codex: { cliPath: 'codex', defaultArgs: '' },
      },

      soundEnabled: true,
      browserNotificationsEnabled: false,

      dataRetentionDays: 30,

      credentials: [],

      setDefaultProvider: (provider) => set({ defaultProvider: provider }),
      setDefaultModel: (model) => set({ defaultModel: model }),
      setCustomApiUrl: (url) => set({ customApiUrl: url }),
      setCustomApiKey: (key) => set({ customApiKey: key }),
      setCustomModelId: (id) => set({ customModelId: id }),
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),

      setAgentConfig: (typeId, config) =>
        set((s) => ({
          agentConfigs: { ...s.agentConfigs, [typeId]: config },
        })),

      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setBrowserNotificationsEnabled: (enabled) => set({ browserNotificationsEnabled: enabled }),

      setDataRetentionDays: (days) => set({ dataRetentionDays: days }),

      setCredentials: (creds) => set({ credentials: creds }),
      addCredential: (cred) => set((s) => ({ credentials: [...s.credentials, cred] })),
      removeCredential: (id) =>
        set((s) => ({ credentials: s.credentials.filter((c) => c.id !== id) })),
    }),
    {
      name: 'jragentmesh-settings',
      partialize: (state) => ({
        defaultProvider: state.defaultProvider,
        defaultModel: state.defaultModel,
        soundEnabled: state.soundEnabled,
        browserNotificationsEnabled: state.browserNotificationsEnabled,
        dataRetentionDays: state.dataRetentionDays,
        systemPrompt: state.systemPrompt,
        agentConfigs: state.agentConfigs,
      }),
    },
  ),
);

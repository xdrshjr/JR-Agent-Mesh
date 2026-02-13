'use client';

import { useSettingsStore } from '@/stores/settings-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';

export function GeneralSettings() {
  const dataRetentionDays = useSettingsStore((s) => s.dataRetentionDays);
  const setDataRetentionDays = useSettingsStore((s) => s.setDataRetentionDays);

  const handleExport = () => {
    const state = useSettingsStore.getState();
    const data = {
      defaultProvider: state.defaultProvider,
      defaultModel: state.defaultModel,
      systemPrompt: state.systemPrompt,
      agentConfigs: state.agentConfigs,
      soundEnabled: state.soundEnabled,
      browserNotificationsEnabled: state.browserNotificationsEnabled,
      dataRetentionDays: state.dataRetentionDays,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jragentmesh-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const store = useSettingsStore.getState();
        if (data.defaultProvider) store.setDefaultProvider(data.defaultProvider);
        if (data.defaultModel) store.setDefaultModel(data.defaultModel);
        if (data.systemPrompt !== undefined) store.setSystemPrompt(data.systemPrompt);
        if (data.soundEnabled !== undefined) store.setSoundEnabled(data.soundEnabled);
        if (data.dataRetentionDays) store.setDataRetentionDays(data.dataRetentionDays);
        if (data.agentConfigs) {
          Object.entries(data.agentConfigs).forEach(([k, v]) => {
            store.setAgentConfig(k, v as { cliPath: string; defaultArgs: string });
          });
        }
      } catch {
        console.error('Failed to import settings');
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Data Retention</h4>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={1}
            max={365}
            value={dataRetentionDays}
            onChange={(e) => setDataRetentionDays(Number(e.target.value) || 30)}
            className="w-24"
          />
          <span className="text-sm text-[var(--text-secondary)]">days</span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Conversations older than this will be automatically archived
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Import / Export</h4>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Settings
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Import Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

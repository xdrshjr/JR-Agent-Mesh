'use client';

import { useSettingsStore } from '@/stores/settings-store';
import { Input } from '@/components/ui/input';

const AGENT_TYPES = [
  { id: 'claude-code', name: 'Claude Code' },
  { id: 'opencode', name: 'OpenCode' },
  { id: 'codex', name: 'Codex' },
];

export function BackendAgentSettings() {
  const agentConfigs = useSettingsStore((s) => s.agentConfigs);
  const setAgentConfig = useSettingsStore((s) => s.setAgentConfig);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-[var(--foreground)]">Agent Type Configuration</h4>
      {AGENT_TYPES.map((type) => {
        const config = agentConfigs[type.id] || { cliPath: '', defaultArgs: '' };
        return (
          <div
            key={type.id}
            className="p-4 border border-[var(--border)] rounded-[var(--radius)] space-y-3"
          >
            <div className="text-sm font-medium text-[var(--foreground)]">{type.name}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-secondary)]">CLI Path</label>
                <Input
                  value={config.cliPath}
                  onChange={(e) =>
                    setAgentConfig(type.id, { ...config, cliPath: e.target.value })
                  }
                  placeholder="e.g. claude"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-secondary)]">Default Arguments</label>
                <Input
                  value={config.defaultArgs}
                  onChange={(e) =>
                    setAgentConfig(type.id, { ...config, defaultArgs: e.target.value })
                  }
                  placeholder="e.g. --no-confirm"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSelfAgent } from '@/hooks/use-self-agent';
import { useSettingsStore } from '@/stores/settings-store';
import { PROVIDERS, MODELS } from '@/lib/model-options';

export function ModelSelector() {
  const { provider, model, dispatchMode, switchModel, toggleDispatch } = useSelfAgent();
  const detectedModels = useSettingsStore((s) => s.detectedModels);

  const models = useMemo(() => {
    // Prefer detected models, fall back to static list
    const detected = detectedModels[provider];
    const base = detected?.length ? detected : MODELS[provider] || [];

    // If current model isn't in the list, append it so SelectValue can render
    if (model && !base.some((m) => m.id === model)) {
      return [...base, { id: model, name: model }];
    }
    return base;
  }, [provider, model, detectedModels]);

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-white">
      {/* Provider */}
      <Select
        value={provider}
        onValueChange={(val) => {
          const firstModel = MODELS[val]?.[0]?.id || '';
          switchModel(val, firstModel);
        }}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROVIDERS.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Model */}
      <Select value={model} onValueChange={(val) => switchModel(provider, val)}>
        <SelectTrigger className="w-[220px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Dispatch mode toggle */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-[var(--text-secondary)]">Dispatch Mode</span>
        <Switch checked={dispatchMode} onCheckedChange={toggleDispatch} />
      </div>
    </div>
  );
}

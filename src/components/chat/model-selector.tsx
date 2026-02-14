'use client';

import { useEffect, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSelfAgent } from '@/hooks/use-self-agent';
import { useSettingsStore, CREDENTIAL_TYPES, buildProviderList } from '@/stores/settings-store';
import { useSkillStore } from '@/stores/skill-store';
import { MODELS } from '@/lib/model-options';
import { SkillViewDialog } from './skill-view-dialog';

export function ModelSelector() {
  const { provider, model, dispatchMode, switchModel, toggleDispatch } = useSelfAgent();
  const detectedModels = useSettingsStore((s) => s.detectedModels);
  const credentials = useSettingsStore((s) => s.credentials);
  const fetchCredentials = useSettingsStore((s) => s.fetchCredentials);
  const detectModels = useSettingsStore((s) => s.detectModels);
  const skills = useSkillStore((s) => s.skills);
  const fetchSkills = useSkillStore((s) => s.fetchSkills);
  const [showSkillDialog, setShowSkillDialog] = useState(false);

  // Load credentials on mount so custom providers appear
  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Auto-detect models when provider has credentials but no detected models
  useEffect(() => {
    if (detectedModels[provider]) return;
    const credType = CREDENTIAL_TYPES.find((t) => t.provider === provider);
    const credInfo = credType
      ? credentials.find((c) => c.key === credType.key)
      : credentials.find((c) => c.provider === provider);
    if (credInfo?.hasValue) {
      detectModels(provider);
    }
  }, [provider, credentials, detectedModels]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSkillCount = skills.filter((s) => s.isGlobal).length;

  // Build provider list, ensuring the current provider is always included
  const allProviders = useMemo(() => {
    const list = buildProviderList(credentials);
    if (provider && !list.some((p) => p.id === provider)) {
      list.push({ id: provider, name: provider });
    }
    return list;
  }, [credentials, provider]);

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
          const detectedForVal = detectedModels[val];
          const list = detectedForVal?.length ? detectedForVal : MODELS[val] || [];
          const firstModel = list[0]?.id || '';
          switchModel(val, firstModel);
        }}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allProviders.map((p) => (
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

      {/* Skills button + Dispatch mode toggle */}
      <div className="flex items-center gap-3 ml-auto">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowSkillDialog(true)}
        >
          <Zap className="w-3 h-3" />
          Skills{activeSkillCount > 0 ? ` (${activeSkillCount})` : ''}
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Dispatch Mode</span>
          <Switch checked={dispatchMode} onCheckedChange={toggleDispatch} />
        </div>
      </div>

      {showSkillDialog && <SkillViewDialog onClose={() => setShowSkillDialog(false)} />}
    </div>
  );
}

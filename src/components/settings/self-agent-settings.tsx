'use client';

import { useEffect } from 'react';
import { useSettingsStore, CREDENTIAL_TYPES } from '@/stores/settings-store';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RotateCcw, RefreshCw, Loader2 } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { PROVIDERS, MODELS, CUSTOM_API_MODES } from '@/lib/model-options';

const DEFAULT_SYSTEM_PROMPT = '';

export function SelfAgentSettings() {
  const store = useSettingsStore();
  const isCustomProvider = store.defaultProvider === 'custom';
  const provider = store.defaultProvider;

  const detected = store.detectedModels[provider];
  const modelList = detected?.length ? detected : MODELS[provider] || [];
  const isDetecting = store.isDetectingModels[provider] || false;
  const detectionError = store.modelDetectionErrors[provider] || null;

  // Ensure credentials are loaded for auto-detect
  useEffect(() => {
    store.fetchCredentials();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-detect models on mount when credentials exist for the current provider
  useEffect(() => {
    const credType = CREDENTIAL_TYPES.find((t) => t.provider === provider);
    if (!credType) return;
    const credInfo = store.credentials.find((c) => c.key === credType.key);
    if (credInfo?.hasValue && !store.detectedModels[provider]) {
      store.detectModels(provider);
    }
  }, [provider, store.credentials]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDetectModels = () => {
    store.detectModels(provider);
  };

  return (
    <div className="space-y-6">
      {/* Default Model */}
      <section>
        <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Default Model</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--text-secondary)]">Provider</label>
            <Select
              value={store.defaultProvider}
              onValueChange={(val) => {
                store.setDefaultProvider(val);
                const detectedForProvider = store.detectedModels[val];
                const list = detectedForProvider?.length ? detectedForProvider : MODELS[val] || [];
                const firstModel = list[0]?.id || '';
                if (firstModel) store.setDefaultModel(firstModel);
              }}
            >
              <SelectTrigger>
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
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[var(--text-secondary)]">Model</label>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={handleDetectModels}
                disabled={isDetecting}
                title="Detect available models from API"
              >
                {isDetecting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
              </Button>
            </div>
            <Select value={store.defaultModel} onValueChange={store.setDefaultModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelList.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {detectionError && (
              <p className="text-xs text-[var(--error)]">{detectionError}</p>
            )}
            {detected && detected.length > 0 && !detectionError && (
              <p className="text-xs text-[var(--success)]">
                {detected.length} model{detected.length !== 1 ? 's' : ''} detected
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Custom provider options — only visible when provider is "custom" */}
      {isCustomProvider && (
        <section>
          {/* API Mode Selector */}
          <div className="space-y-1.5 mb-4">
            <label className="text-xs text-[var(--text-secondary)]">API Mode</label>
            <Select value={store.customApiMode} onValueChange={(val) => store.setCustomApiMode(val as 'openai' | 'anthropic')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_API_MODES.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-muted)]">
              {CUSTOM_API_MODES.find(m => m.id === store.customApiMode)?.description}
            </p>
          </div>
          {/* Custom Model ID */}
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--text-secondary)]">Custom Model ID</label>
            <Input
              value={store.customModelId}
              onChange={(e) => store.setCustomModelId(e.target.value)}
              placeholder="custom-model-name"
            />
          </div>
        </section>
      )}

      {/* System Prompt */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-[var(--foreground)]">System Prompt</h4>
          {store.systemPrompt && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => store.setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset to Default
            </Button>
          )}
        </div>
        <Textarea
          value={store.systemPrompt}
          onChange={(e) => store.setSystemPrompt(e.target.value)}
          placeholder="You are a helpful AI assistant... (leave empty for default)"
          rows={5}
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Leave empty to use the built-in default system prompt.
        </p>
      </section>
    </div>
  );
}

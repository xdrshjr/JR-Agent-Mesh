'use client';

import { useSettingsStore } from '@/stores/settings-store';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { PROVIDERS, MODELS } from '@/lib/model-options';

const DEFAULT_SYSTEM_PROMPT = '';

export function SelfAgentSettings() {
  const store = useSettingsStore();
  const isCustomProvider = store.defaultProvider === 'custom';

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
                const firstModel = MODELS[val]?.[0]?.id || '';
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
            <label className="text-xs text-[var(--text-secondary)]">Model</label>
            <Select value={store.defaultModel} onValueChange={store.setDefaultModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(MODELS[store.defaultProvider] || []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Custom LLM — only visible when provider is "custom" */}
      {isCustomProvider && (
        <section>
          <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Custom LLM</h4>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">API URL</label>
              <Input
                value={store.customApiUrl}
                onChange={(e) => store.setCustomApiUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">Model ID</label>
              <Input
                value={store.customModelId}
                onChange={(e) => store.setCustomModelId(e.target.value)}
                placeholder="custom-model-name"
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              API Key for custom provider can be set in the Credentials section below.
            </p>
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

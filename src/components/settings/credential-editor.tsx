'use client';

import { useState, useEffect } from 'react';
import { Pencil, Trash2, ShieldAlert, Key, Loader2 } from 'lucide-react';
import {
  useSettingsStore,
  CREDENTIAL_TYPES,
} from '@/stores/settings-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { PROVIDER_DEFAULT_URLS } from '@/lib/model-options';

export function CredentialEditor() {
  const credentials = useSettingsStore((s) => s.credentials);
  const providerApiUrls = useSettingsStore((s) => s.providerApiUrls);
  const fetchCredentials = useSettingsStore((s) => s.fetchCredentials);
  const saveCredential = useSettingsStore((s) => s.saveCredential);
  const deleteCredential = useSettingsStore((s) => s.deleteCredential);
  const setProviderApiUrl = useSettingsStore((s) => s.setProviderApiUrl);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const detectModels = useSettingsStore((s) => s.detectModels);
  const isDetectingModels = useSettingsStore((s) => s.isDetectingModels);
  const customApiMode = useSettingsStore((s) => s.customApiMode);

  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ count?: number; error?: string } | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Build display list: merge predefined types with server data
  const credentialItems = CREDENTIAL_TYPES.map((type) => {
    const serverCred = credentials.find((c) => c.key === type.key);
    // Dynamic description for custom_key based on API mode
    const description = type.key === 'custom_key'
      ? (customApiMode === 'anthropic'
        ? 'Used for custom Anthropic-compatible API'
        : 'Used for custom OpenAI-compatible API')
      : type.description;
    return {
      ...type,
      description,
      hasValue: serverCred?.hasValue || false,
      maskedValue: serverCred?.maskedValue || null,
      updatedAt: serverCred?.updatedAt || null,
    };
  });

  const handleEdit = (key: string) => {
    const credType = CREDENTIAL_TYPES.find((t) => t.key === key);
    setEditKey(key);
    setEditValue('');
    setEditUrl(credType ? (providerApiUrls[credType.provider] || '') : '');
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!editKey) return;
    const credType = CREDENTIAL_TYPES.find((t) => t.key === editKey);
    const provider = credType?.provider;

    // At least one of URL or key value should be provided to save
    const hasUrlChange = provider && editUrl.trim() !== (providerApiUrls[provider] || '');
    const hasKeyValue = editValue.trim().length > 0;

    if (!hasUrlChange && !hasKeyValue) return;

    setIsSaving(true);
    try {
      // Save URL if changed
      if (provider && hasUrlChange) {
        setProviderApiUrl(provider, editUrl.trim());
        await saveSettings();
      }

      // Save key if provided
      if (hasKeyValue) {
        await saveCredential(editKey, editValue.trim());
      }

      setEditKey(null);
      setEditValue('');
      setEditUrl('');
      setTestResult(null);
    } catch {
      // Error already logged in store
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!editKey) return;
    const credType = CREDENTIAL_TYPES.find((t) => t.key === editKey);
    const provider = credType?.provider;
    if (!provider) return;

    setTestResult(null);

    // Save URL + key first so the server has them
    setIsSaving(true);
    try {
      const hasUrlChange = editUrl.trim() !== (providerApiUrls[provider] || '');
      if (hasUrlChange) {
        setProviderApiUrl(provider, editUrl.trim());
      }
      // Always save settings so the server has latest state (e.g. customApiMode)
      await saveSettings();
      if (editValue.trim()) {
        await saveCredential(editKey, editValue.trim());
        setEditValue('');
      }
    } catch {
      setTestResult({ error: 'Failed to save credentials before testing' });
      setIsSaving(false);
      return;
    }
    setIsSaving(false);

    // Now detect models
    await detectModels(provider);

    // Read result from store after detection
    const store = useSettingsStore.getState();
    const models = store.detectedModels[provider];
    const error = store.modelDetectionErrors[provider];

    if (error) {
      setTestResult({ error });
    } else if (models && models.length > 0) {
      setTestResult({ count: models.length });
    } else {
      setTestResult({ error: 'No models found' });
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await deleteCredential(key);
    } catch {
      // Error already logged in store
    }
  };

  const editingItem = credentialItems.find((t) => t.key === editKey);
  const editingProvider = editingItem?.provider;
  const isTesting = editingProvider ? (isDetectingModels[editingProvider] || false) : false;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Key className="w-4 h-4 text-[var(--text-secondary)]" />
        <h4 className="text-sm font-medium text-[var(--foreground)]">API Credentials</h4>
      </div>

      <div className="space-y-2">
        {credentialItems.map((item) => {
          const customUrl = providerApiUrls[item.provider];
          return (
            <div
              key={item.key}
              className="flex items-center justify-between px-3 py-2.5 border border-[var(--border)] rounded-[var(--radius)]"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--foreground)]">
                  {item.displayName}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {item.description}
                </div>
                {item.hasValue && item.maskedValue ? (
                  <div className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                    {item.maskedValue}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--warning)] mt-0.5">Not configured</div>
                )}
                {customUrl && (
                  <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5 truncate max-w-[300px]" title={customUrl}>
                    URL: {customUrl}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleEdit(item.key)}
                  title={item.hasValue ? 'Update' : 'Set'}
                >
                  <Pencil className="w-3 h-3 text-[var(--text-secondary)]" />
                </Button>
                {item.hasValue && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(item.key)}
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-[var(--error)]" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Notice */}
      <div className="flex items-start gap-2 mt-3 p-2.5 bg-[var(--surface-secondary)] rounded-[var(--radius)]">
        <ShieldAlert className="w-3.5 h-3.5 text-[var(--warning)] mt-0.5 shrink-0" />
        <p className="text-xs text-[var(--text-muted)]">
          Credentials are encrypted and stored on the server locally. Please use in a trusted network environment.
        </p>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editKey} onOpenChange={(open) => { if (!open) { setEditKey(null); setTestResult(null); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem?.hasValue ? 'Update' : 'Set'} {editingItem?.displayName}
            </DialogTitle>
            <DialogDescription>
              {editingItem?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* API URL */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">API URL</label>
              <Input
                type="text"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder={editingProvider ? (PROVIDER_DEFAULT_URLS[editingProvider] || 'https://api.example.com/v1') : ''}
              />
              <p className="text-xs text-[var(--text-muted)]">
                {editingProvider && PROVIDER_DEFAULT_URLS[editingProvider]
                  ? `Leave empty to use default: ${PROVIDER_DEFAULT_URLS[editingProvider]}`
                  : 'Enter the API endpoint URL for this provider'}
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">API Key</label>
              <Input
                type="password"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={editingItem?.placeholder || 'Enter API key...'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (editValue.trim() || editUrl.trim())) handleSave();
                }}
              />
              {editingItem?.hasValue && (
                <p className="text-xs text-[var(--text-muted)]">
                  Leave empty to keep the existing key unchanged.
                </p>
              )}
            </div>

            {/* Test Connection Result */}
            {testResult && (
              <div className={`text-xs px-2 py-1.5 rounded ${testResult.error ? 'bg-[var(--error)]/10 text-[var(--error)]' : 'bg-[var(--success)]/10 text-[var(--success)]'}`}>
                {testResult.error
                  ? `Error: ${testResult.error}`
                  : `Connected successfully - ${testResult.count} model${testResult.count !== 1 ? 's' : ''} detected`}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isSaving || isTesting}
              className="mr-auto"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
            <Button variant="outline" onClick={() => { setEditKey(null); setTestResult(null); }} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={(!editValue.trim() && editUrl.trim() === (editingProvider ? (providerApiUrls[editingProvider] || '') : '')) || isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2, ShieldAlert, Key, Loader2, Plus } from 'lucide-react';
import {
  useSettingsStore,
  CREDENTIAL_TYPES,
  CODING_PLAN_CREDENTIAL_TYPES,
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
import { PROVIDER_DEFAULT_URLS, CODING_PLAN_PROVIDER_DEFAULT_URLS } from '@/lib/model-options';

interface CredentialDisplayItem {
  key: string;
  displayName: string;
  provider: string;
  placeholder: string;
  description: string;
  hasValue: boolean;
  maskedValue: string | null;
  updatedAt: number | null;
  isCustom: boolean;
}

/** Convert a display name to a credential key: "DeepSeek API Key" -> "deepseek_api_key" */
function toCredentialKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const predefinedKeys = new Set([
  ...CREDENTIAL_TYPES.map((t) => t.key),
  ...CODING_PLAN_CREDENTIAL_TYPES.map((t) => t.key),
]);

export function CredentialEditor() {
  const credentials = useSettingsStore((s) => s.credentials);
  const providerApiUrls = useSettingsStore((s) => s.providerApiUrls);
  const codingPlanApiUrls = useSettingsStore((s) => s.codingPlanApiUrls);
  const fetchCredentials = useSettingsStore((s) => s.fetchCredentials);
  const saveCredential = useSettingsStore((s) => s.saveCredential);
  const deleteCredential = useSettingsStore((s) => s.deleteCredential);
  const setProviderApiUrl = useSettingsStore((s) => s.setProviderApiUrl);
  const setCodingPlanApiUrl = useSettingsStore((s) => s.setCodingPlanApiUrl);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const detectModels = useSettingsStore((s) => s.detectModels);
  const isDetectingModels = useSettingsStore((s) => s.isDetectingModels);
  const customApiMode = useSettingsStore((s) => s.customApiMode);

  const [activeTab, setActiveTab] = useState<'standard' | 'coding-plan'>('standard');
  const [editingIsCodingPlan, setEditingIsCodingPlan] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ count?: number; error?: string } | null>(null);

  // Add credential dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addDisplayName, setAddDisplayName] = useState('');
  const [addApiUrl, setAddApiUrl] = useState('');
  const [addApiKey, setAddApiKey] = useState('');
  const [addError, setAddError] = useState('');
  const [isAddSaving, setIsAddSaving] = useState(false);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Build display list: merge predefined types with custom server credentials
  const credentialItems = useMemo<CredentialDisplayItem[]>(() => {
    // Predefined items
    const predefined = CREDENTIAL_TYPES.map((type) => {
      const serverCred = credentials.find((c) => c.key === type.key);
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
        isCustom: false,
      };
    });

    // Custom items: server credentials whose key is NOT in predefined
    const custom = credentials
      .filter((c) => !predefinedKeys.has(c.key))
      .map((c) => ({
        key: c.key,
        displayName: c.displayName || c.key,
        provider: c.provider || c.key,
        placeholder: '',
        description: 'Custom credential',
        hasValue: c.hasValue,
        maskedValue: c.maskedValue || null,
        updatedAt: c.updatedAt || null,
        isCustom: true,
      }));

    return [...predefined, ...custom];
  }, [credentials, customApiMode]);

  // Build coding plan display list
  const codingPlanItems = useMemo<CredentialDisplayItem[]>(() => {
    return CODING_PLAN_CREDENTIAL_TYPES.map((type) => {
      const serverCred = credentials.find((c) => c.key === type.key);
      return {
        ...type,
        hasValue: serverCred?.hasValue || false,
        maskedValue: serverCred?.maskedValue || null,
        updatedAt: serverCred?.updatedAt || null,
        isCustom: false,
      };
    });
  }, [credentials]);

  // Track which item is being edited (for the edit dialog)
  const allItems = [...credentialItems, ...codingPlanItems];
  const editingItem = allItems.find((t) => t.key === editKey);
  const editingIsCustom = editingItem?.isCustom ?? false;
  const editingProvider = editingItem?.provider;
  const isTesting = editingProvider ? (isDetectingModels[editingProvider] || false) : false;

  const handleEdit = (key: string, isCodingPlan = false) => {
    const item = allItems.find((t) => t.key === key);
    const credType = CREDENTIAL_TYPES.find((t) => t.key === key);
    const cpCredType = CODING_PLAN_CREDENTIAL_TYPES.find((t) => t.key === key);
    setEditKey(key);
    setEditValue('');
    setEditingIsCodingPlan(isCodingPlan);
    // For coding plan items, load from codingPlanApiUrls; for standard, load from providerApiUrls
    if (cpCredType) {
      setEditUrl(codingPlanApiUrls[cpCredType.provider] || '');
    } else if (credType) {
      setEditUrl(providerApiUrls[credType.provider] || '');
    } else if (item) {
      setEditUrl(providerApiUrls[item.provider] || '');
    } else {
      setEditUrl('');
    }
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!editKey) return;
    const credType = CREDENTIAL_TYPES.find((t) => t.key === editKey);
    const cpCredType = CODING_PLAN_CREDENTIAL_TYPES.find((t) => t.key === editKey);
    const item = allItems.find((t) => t.key === editKey);
    const provider = cpCredType?.provider || credType?.provider || item?.provider;

    // Determine current URL source based on credential type
    const currentUrls = editingIsCodingPlan ? codingPlanApiUrls : providerApiUrls;
    const hasUrlChange = provider && editUrl.trim() !== (currentUrls[provider] || '');
    const hasKeyValue = editValue.trim().length > 0;

    if (!hasUrlChange && !hasKeyValue) return;

    setIsSaving(true);
    try {
      // Save URL if changed
      if (provider && hasUrlChange) {
        if (editingIsCodingPlan) {
          setCodingPlanApiUrl(provider, editUrl.trim());
        } else {
          setProviderApiUrl(provider, editUrl.trim());
        }
        await saveSettings();
      }

      // Save key if provided
      if (hasKeyValue) {
        if (editingIsCustom && item) {
          await saveCredential(editKey, editValue.trim(), item.displayName, item.provider);
        } else {
          await saveCredential(editKey, editValue.trim());
        }
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

  // --- Add Credential ---
  const generatedKey = toCredentialKey(addDisplayName);
  const isDuplicateKey = generatedKey.length > 0 && (predefinedKeys.has(generatedKey) || credentialItems.some((item) => item.key === generatedKey));

  const resetAddDialog = () => {
    setAddOpen(false);
    setAddDisplayName('');
    setAddApiUrl('');
    setAddApiKey('');
    setAddError('');
  };

  const handleAddSave = async () => {
    if (!addDisplayName.trim() || !addApiKey.trim() || !generatedKey) return;
    if (isDuplicateKey) {
      setAddError(`A credential with key "${generatedKey}" already exists.`);
      return;
    }

    const key = generatedKey;
    const provider = key; // use key as provider for custom credentials

    setIsAddSaving(true);
    setAddError('');
    try {
      // Save URL if provided
      if (addApiUrl.trim()) {
        setProviderApiUrl(provider, addApiUrl.trim());
        await saveSettings();
      }

      // Save the credential with explicit displayName and provider
      await saveCredential(key, addApiKey.trim(), addDisplayName.trim(), provider);

      resetAddDialog();
    } catch {
      setAddError('Failed to save credential');
    } finally {
      setIsAddSaving(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-[var(--text-secondary)]" />
          <h4 className="text-sm font-medium text-[var(--foreground)]">API Credentials</h4>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab Toggle */}
          <div className="flex rounded-full bg-[var(--surface-secondary)] p-0.5">
            <button
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                activeTab === 'standard'
                  ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              onClick={() => setActiveTab('standard')}
            >
              Standard API
            </button>
            <button
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                activeTab === 'coding-plan'
                  ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              onClick={() => setActiveTab('coding-plan')}
            >
              Coding Plan
            </button>
          </div>
          {activeTab === 'standard' && (
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {(activeTab === 'standard' ? credentialItems : codingPlanItems).map((item) => {
          const isCp = activeTab === 'coding-plan';
          const urlMap = isCp ? codingPlanApiUrls : providerApiUrls;
          const customUrl = urlMap[item.provider];
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
                  onClick={() => handleEdit(item.key, isCp)}
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
                placeholder={editingProvider
                  ? ((editingIsCodingPlan ? CODING_PLAN_PROVIDER_DEFAULT_URLS[editingProvider] : PROVIDER_DEFAULT_URLS[editingProvider]) || 'https://api.example.com/v1')
                  : ''}
              />
              <p className="text-xs text-[var(--text-muted)]">
                {editingProvider && (editingIsCodingPlan ? CODING_PLAN_PROVIDER_DEFAULT_URLS[editingProvider] : PROVIDER_DEFAULT_URLS[editingProvider])
                  ? `Leave empty to use default: ${editingIsCodingPlan ? CODING_PLAN_PROVIDER_DEFAULT_URLS[editingProvider] : PROVIDER_DEFAULT_URLS[editingProvider]}`
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
            {/* Hide Test Connection for custom (user-added) and coding plan credentials */}
            {!editingIsCustom && !editingIsCodingPlan && (
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
            )}
            <Button variant="outline" onClick={() => { setEditKey(null); setTestResult(null); }} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={(!editValue.trim() && editUrl.trim() === (editingProvider ? ((editingIsCodingPlan ? codingPlanApiUrls : providerApiUrls)[editingProvider] || '') : '')) || isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Credential Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) resetAddDialog(); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Credential</DialogTitle>
            <DialogDescription>
              Add a custom API credential for any provider.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">Display Name</label>
              <Input
                type="text"
                value={addDisplayName}
                onChange={(e) => { setAddDisplayName(e.target.value); setAddError(''); }}
                placeholder="e.g., DeepSeek API Key"
              />
              {generatedKey && (
                <p className="text-xs text-[var(--text-muted)]">
                  Key: <span className="font-mono">{generatedKey}</span>
                </p>
              )}
              {isDuplicateKey && (
                <p className="text-xs text-[var(--error)]">
                  A credential with this key already exists.
                </p>
              )}
            </div>

            {/* API URL */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">API URL <span className="text-[var(--text-muted)]">(optional)</span></label>
              <Input
                type="text"
                value={addApiUrl}
                onChange={(e) => setAddApiUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">API Key</label>
              <Input
                type="password"
                value={addApiKey}
                onChange={(e) => setAddApiKey(e.target.value)}
                placeholder="Enter API key..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && addDisplayName.trim() && addApiKey.trim() && !isDuplicateKey) handleAddSave();
                }}
              />
            </div>

            {/* Error */}
            {addError && (
              <div className="text-xs px-2 py-1.5 rounded bg-[var(--error)]/10 text-[var(--error)]">
                {addError}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={resetAddDialog} disabled={isAddSaving}>
              Cancel
            </Button>
            <Button onClick={handleAddSave} disabled={!addDisplayName.trim() || !addApiKey.trim() || !generatedKey || isDuplicateKey || isAddSaving}>
              {isAddSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

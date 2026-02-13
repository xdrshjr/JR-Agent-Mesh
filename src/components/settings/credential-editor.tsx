'use client';

import { useState, useEffect } from 'react';
import { Pencil, Trash2, ShieldAlert, Key } from 'lucide-react';
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

export function CredentialEditor() {
  const credentials = useSettingsStore((s) => s.credentials);
  const fetchCredentials = useSettingsStore((s) => s.fetchCredentials);
  const saveCredential = useSettingsStore((s) => s.saveCredential);
  const deleteCredential = useSettingsStore((s) => s.deleteCredential);

  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Build display list: merge predefined types with server data
  const credentialItems = CREDENTIAL_TYPES.map((type) => {
    const serverCred = credentials.find((c) => c.key === type.key);
    return {
      ...type,
      hasValue: serverCred?.hasValue || false,
      maskedValue: serverCred?.maskedValue || null,
      updatedAt: serverCred?.updatedAt || null,
    };
  });

  const handleEdit = (key: string) => {
    setEditKey(key);
    setEditValue('');
  };

  const handleSave = async () => {
    if (!editKey || !editValue.trim()) return;
    setIsSaving(true);
    try {
      await saveCredential(editKey, editValue.trim());
      setEditKey(null);
      setEditValue('');
    } catch {
      // Error already logged in store
    } finally {
      setIsSaving(false);
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

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Key className="w-4 h-4 text-[var(--text-secondary)]" />
        <h4 className="text-sm font-medium text-[var(--foreground)]">API Credentials</h4>
      </div>

      <div className="space-y-2">
        {credentialItems.map((item) => (
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
        ))}
      </div>

      {/* Security Notice */}
      <div className="flex items-start gap-2 mt-3 p-2.5 bg-[var(--surface-secondary)] rounded-[var(--radius)]">
        <ShieldAlert className="w-3.5 h-3.5 text-[var(--warning)] mt-0.5 shrink-0" />
        <p className="text-xs text-[var(--text-muted)]">
          Credentials are encrypted and stored on the server locally. Please use in a trusted network environment.
        </p>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editKey} onOpenChange={(open) => !open && setEditKey(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem?.hasValue ? 'Update' : 'Set'} {editingItem?.displayName}
            </DialogTitle>
            <DialogDescription>
              {editingItem?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">API Key</label>
              <Input
                type="password"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={editingItem?.placeholder || 'Enter API key...'}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editValue.trim()) handleSave();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditKey(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!editValue.trim() || isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

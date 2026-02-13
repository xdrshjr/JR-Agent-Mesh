'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export function CredentialEditor() {
  const credentials = useSettingsStore((s) => s.credentials);
  const addCredential = useSettingsStore((s) => s.addCredential);
  const removeCredential = useSettingsStore((s) => s.removeCredential);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [value, setValue] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !value.trim()) return;
    addCredential({
      id: `cred-${Date.now()}`,
      name: name.trim(),
      provider: provider.trim(),
      maskedValue: value.slice(0, 4) + '••••••••',
    });
    setName('');
    setProvider('');
    setValue('');
    setDialogOpen(false);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-[var(--foreground)]">API Credentials</h4>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {credentials.length === 0 ? (
          <div className="text-xs text-[var(--text-muted)] text-center py-4 border border-dashed border-[var(--border)] rounded-[var(--radius)]">
            No credentials configured
          </div>
        ) : (
          credentials.map((cred) => (
            <div
              key={cred.id}
              className="flex items-center justify-between px-3 py-2.5 border border-[var(--border)] rounded-[var(--radius)]"
            >
              <div>
                <div className="text-sm font-medium text-[var(--foreground)]">{cred.name}</div>
                <div className="text-xs text-[var(--text-muted)] font-mono">{cred.maskedValue}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Pencil className="w-3 h-3 text-[var(--text-secondary)]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeCredential(cred.id)}
                >
                  <Trash2 className="w-3 h-3 text-[var(--error)]" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Credential</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Anthropic API Key"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">Provider</label>
              <Input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. anthropic"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">API Key</label>
              <Input
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="sk-..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!name.trim() || !value.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

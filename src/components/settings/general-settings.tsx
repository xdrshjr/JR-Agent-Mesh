'use client';

import { useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2 } from 'lucide-react';

export function GeneralSettings() {
  const dataRetentionDays = useSettingsStore((s) => s.dataRetentionDays);
  const agentLogRetentionDays = useSettingsStore((s) => s.agentLogRetentionDays);
  const setDataRetentionDays = useSettingsStore((s) => s.setDataRetentionDays);
  const setAgentLogRetentionDays = useSettingsStore((s) => s.setAgentLogRetentionDays);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jragentmesh-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await fetch('/api/import?mode=merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Import failed');
        const result = await res.json();
        console.log('Import result:', result);

        // Refresh settings from server after import
        const fetchSettings = useSettingsStore.getState().fetchSettings;
        await fetchSettings();
      } catch (err) {
        console.error('Failed to import:', err);
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Data Retention</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-[var(--text-secondary)] w-40">Conversation History</label>
            <Input
              type="number"
              min={1}
              max={365}
              value={dataRetentionDays}
              onChange={(e) => setDataRetentionDays(Number(e.target.value) || 90)}
              className="w-24"
            />
            <span className="text-sm text-[var(--text-secondary)]">days</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-[var(--text-secondary)] w-40">Agent Logs</label>
            <Input
              type="number"
              min={1}
              max={365}
              value={agentLogRetentionDays}
              onChange={(e) => setAgentLogRetentionDays(Number(e.target.value) || 30)}
              className="w-24"
            />
            <span className="text-sm text-[var(--text-secondary)]">days</span>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Data older than the configured retention period will be automatically cleaned up.
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">Import / Export</h4>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5" />
            )}
            {isExporting ? 'Exporting...' : 'Export Data'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport} disabled={isImporting}>
            {isImporting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 mr-1.5" />
            )}
            {isImporting ? 'Importing...' : 'Import Data'}
          </Button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Export includes conversations, messages, and settings. Credentials are not exported for security.
        </p>
      </div>
    </div>
  );
}

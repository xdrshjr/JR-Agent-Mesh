'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SelfAgentSettings } from '@/components/settings/self-agent-settings';
import { CredentialEditor } from '@/components/settings/credential-editor';
import { BackendAgentSettings } from '@/components/settings/backend-agent-settings';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { GeneralSettings } from '@/components/settings/general-settings';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Check } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';

export default function SettingsPage() {
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const isSaving = useSettingsStore((s) => s.isSaving);
  const isLoading = useSettingsStore((s) => s.isLoading);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    try {
      await saveSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Error logged in store
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-12 border-b border-[var(--border)] flex items-center justify-between px-6 bg-white shrink-0">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Settings</h2>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={isSaving || isLoading}
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : saved ? (
            <Check className="w-3.5 h-3.5 mr-1.5" />
          ) : (
            <Save className="w-3.5 h-3.5 mr-1.5" />
          )}
          {isSaving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Tabs defaultValue="self-agent">
            <TabsList className="w-full">
              <TabsTrigger value="self-agent">Self Agent</TabsTrigger>
              <TabsTrigger value="backend-agents">Backend Agents</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="general">General</TabsTrigger>
            </TabsList>

            <TabsContent value="self-agent">
              <div className="space-y-8">
                <SelfAgentSettings />
                <CredentialEditor />
              </div>
            </TabsContent>

            <TabsContent value="backend-agents">
              <BackendAgentSettings />
            </TabsContent>

            <TabsContent value="notifications">
              <NotificationSettings />
            </TabsContent>

            <TabsContent value="general">
              <GeneralSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

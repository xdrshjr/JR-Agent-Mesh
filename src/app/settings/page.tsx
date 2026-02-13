'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SelfAgentSettings } from '@/components/settings/self-agent-settings';
import { CredentialEditor } from '@/components/settings/credential-editor';
import { BackendAgentSettings } from '@/components/settings/backend-agent-settings';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { GeneralSettings } from '@/components/settings/general-settings';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const handleSave = () => {
    // Settings are auto-saved via Zustand persist
    // This could also trigger a server-side sync
    console.log('Settings saved');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-12 border-b border-[var(--border)] flex items-center justify-between px-6 bg-white shrink-0">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Settings</h2>
        <Button variant="default" size="sm" onClick={handleSave}>
          <Save className="w-3.5 h-3.5 mr-1.5" />
          Save
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

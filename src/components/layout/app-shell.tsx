'use client';

import { WebSocketProvider, useWebSocketClient } from '@/hooks/use-websocket';
import { useAgentStore } from '@/stores/agent-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useRoutePrefetch } from '@/hooks/use-route-prefetch';
import { MobileGuard } from './mobile-guard';
import { TopBar } from './top-bar';
import { Sidebar } from './sidebar';
import { ToastContainer } from './toast';

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { connected } = useWebSocketClient();
  const agents = useAgentStore((s) => s.agents);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);

  useKeyboardShortcuts();
  useRoutePrefetch();

  return (
    <MobileGuard>
      <div className="flex flex-col h-screen overflow-hidden">
        <TopBar
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar connected={connected} activeAgents={agents} />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
      <ToastContainer />
    </MobileGuard>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProvider>
      <AppShellInner>{children}</AppShellInner>
    </WebSocketProvider>
  );
}

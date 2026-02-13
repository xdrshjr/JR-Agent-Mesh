'use client';

import { useSettingsStore } from '@/stores/settings-store';
import { Switch } from '@/components/ui/switch';
import { useCallback } from 'react';

export function NotificationSettings() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const browserNotificationsEnabled = useSettingsStore((s) => s.browserNotificationsEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const setBrowserNotificationsEnabled = useSettingsStore((s) => s.setBrowserNotificationsEnabled);

  const handleBrowserNotificationToggle = useCallback(
    async (enabled: boolean) => {
      if (enabled && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setBrowserNotificationsEnabled(true);
        }
      } else {
        setBrowserNotificationsEnabled(false);
      }
    },
    [setBrowserNotificationsEnabled],
  );

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-[var(--foreground)]">Notifications</h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 border border-[var(--border)] rounded-[var(--radius)]">
          <div>
            <div className="text-sm text-[var(--foreground)]">Sound Notifications</div>
            <div className="text-xs text-[var(--text-muted)]">
              Play a sound when an agent completes a task
            </div>
          </div>
          <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
        </div>
        <div className="flex items-center justify-between p-3 border border-[var(--border)] rounded-[var(--radius)]">
          <div>
            <div className="text-sm text-[var(--foreground)]">Browser Notifications</div>
            <div className="text-xs text-[var(--text-muted)]">
              Show desktop notifications for important events
            </div>
          </div>
          <Switch
            checked={browserNotificationsEnabled}
            onCheckedChange={handleBrowserNotificationToggle}
          />
        </div>
      </div>
    </div>
  );
}

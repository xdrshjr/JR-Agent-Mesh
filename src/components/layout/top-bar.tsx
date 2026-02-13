'use client';

import { Bell, Volume2, VolumeX, Settings } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface TopBarProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  notificationCount?: number;
}

export function TopBar({ soundEnabled, onToggleSound, notificationCount = 0 }: TopBarProps) {
  return (
    <header className="h-12 border-b border-[var(--border)] bg-white flex items-center justify-between px-4 shrink-0">
      {/* Left: Logo + Project Name */}
      <div className="flex items-center gap-3">
        <Image src="/logo.png" alt="JRAgentMesh" width={28} height={28} className="rounded-[6px]" />
        <span className="text-sm font-semibold text-[var(--foreground)]">JRAgentMesh</span>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1">
        {/* Notification Bell */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4 text-[var(--text-secondary)]" />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--error)] rounded-full text-[10px] text-white flex items-center justify-center font-medium">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </Button>

        {/* Sound Toggle */}
        <Button variant="ghost" size="icon" onClick={onToggleSound}>
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-[var(--text-secondary)]" />
          ) : (
            <VolumeX className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </Button>

        {/* Settings Shortcut */}
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="w-4 h-4 text-[var(--text-secondary)]" />
          </Button>
        </Link>
      </div>
    </header>
  );
}

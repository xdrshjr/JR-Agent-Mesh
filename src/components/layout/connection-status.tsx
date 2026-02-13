'use client';

import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  connected: boolean;
  agentCount: number;
}

export function ConnectionStatus({ connected, agentCount }: ConnectionStatusProps) {
  return (
    <div className="px-4 py-3 border-t border-[var(--border)]">
      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              connected ? 'bg-[var(--success)]' : 'bg-[var(--error)]',
            )}
          />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <span>{agentCount} agent{agentCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

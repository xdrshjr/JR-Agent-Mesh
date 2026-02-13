'use client';

import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  connected: boolean;
  agentCount: number;
}

export function ConnectionStatus({ connected, agentCount }: ConnectionStatusProps) {
  const label = connected
    ? `Connected · ${agentCount} agent${agentCount !== 1 ? 's' : ''}`
    : 'Disconnected';

  return (
    <div className="w-full py-3 border-t border-[var(--border)] flex justify-center">
      <div className="relative group flex items-center justify-center">
        <span
          className={cn(
            'w-2.5 h-2.5 rounded-full',
            connected ? 'bg-[var(--success)]' : 'bg-[var(--error)]',
          )}
        />
        <span className="absolute left-full ml-2 px-2 py-1 rounded-[var(--radius)] bg-[var(--foreground)] text-[var(--background)] text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
          {label}
        </span>
      </div>
    </div>
  );
}

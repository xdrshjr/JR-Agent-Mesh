'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentInfo } from '@/lib/types';

interface AgentTabProps {
  agent: AgentInfo;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  RUNNING: 'bg-[var(--success)]',
  STOPPED: 'bg-[var(--text-muted)]',
  CRASHED: 'bg-[var(--error)]',
  EXITED: 'bg-[var(--text-muted)]',
  FAILED: 'bg-[var(--error)]',
};

export function AgentTab({ agent, isActive, onSelect, onClose }: AgentTabProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-t-[var(--radius)] text-sm border border-b-0 transition-colors duration-150 group',
        isActive
          ? 'bg-white border-[var(--border)] text-[var(--foreground)]'
          : 'bg-[var(--surface)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--border)]/30',
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', statusColors[agent.status])} />
      <span className="truncate max-w-[120px] text-xs font-medium">{agent.name}</span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="opacity-0 group-hover:opacity-100 hover:text-[var(--error)] transition-opacity ml-1"
      >
        <X className="w-3 h-3" />
      </span>
    </button>
  );
}

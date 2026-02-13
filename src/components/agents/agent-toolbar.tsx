'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AgentToolbarProps {
  statusFilter: 'all' | 'RUNNING' | 'STOPPED';
  onFilterChange: (filter: 'all' | 'RUNNING' | 'STOPPED') => void;
  onNewAgent: () => void;
}

const filters: { value: 'all' | 'RUNNING' | 'STOPPED'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'STOPPED', label: 'Stopped' },
];

export function AgentToolbar({ statusFilter, onFilterChange, onNewAgent }: AgentToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-white">
      <div className="flex items-center gap-1">
        <Button variant="default" size="sm" onClick={onNewAgent}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Agent
        </Button>
      </div>

      <div className="flex items-center gap-1 bg-[var(--surface)] rounded-[var(--radius)] p-0.5">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={cn(
              'px-3 py-1 text-xs rounded-[6px] transition-colors duration-150',
              statusFilter === f.value
                ? 'bg-white shadow-[var(--shadow-sm)] text-[var(--foreground)] font-medium'
                : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

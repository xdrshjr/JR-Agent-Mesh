'use client';

import { Square, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AgentInfo } from '@/lib/types';
import { formatDuration, cn } from '@/lib/utils';

interface AgentInfoBarProps {
  agent: AgentInfo;
  onStop: () => void;
  onRestart: () => void;
  onDelete: () => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  RUNNING: { label: 'Running', color: 'text-[var(--success)]' },
  STOPPED: { label: 'Stopped', color: 'text-[var(--text-muted)]' },
  CRASHED: { label: 'Crashed', color: 'text-[var(--error)]' },
  EXITED: { label: 'Exited', color: 'text-[var(--text-muted)]' },
  FAILED: { label: 'Failed', color: 'text-[var(--error)]' },
};

export function AgentInfoBar({ agent, onStop, onRestart, onDelete }: AgentInfoBarProps) {
  const status = statusLabels[agent.status] || { label: agent.status, color: '' };
  const uptime = agent.status === 'RUNNING' ? formatDuration(Date.now() - agent.createdAt) : '-';

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-white">
      <div className="flex items-center gap-6">
        <div>
          <div className="text-sm font-medium text-[var(--foreground)]">{agent.name}</div>
          <div className="text-[11px] text-[var(--text-muted)]">{agent.typeId}</div>
        </div>

        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
          <div>
            Status: <span className={cn('font-medium', status.color)}>{status.label}</span>
          </div>
          <div>
            Dir: <span className="font-mono text-[11px]">{agent.workDir || '-'}</span>
          </div>
          <div>
            Uptime: <span className="tabular-nums">{uptime}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {agent.status === 'RUNNING' && (
          <Button variant="outline" size="sm" onClick={onStop} className="h-7 text-xs">
            <Square className="w-3 h-3 mr-1" />
            Stop
          </Button>
        )}
        {agent.status !== 'RUNNING' && (
          <Button variant="outline" size="sm" onClick={onRestart} className="h-7 text-xs">
            <RotateCw className="w-3 h-3 mr-1" />
            Restart
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 text-xs text-[var(--error)] hover:text-[var(--error)]">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

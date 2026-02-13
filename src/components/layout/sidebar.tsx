'use client';

import { NavMenu } from './nav-menu';
import { ConnectionStatus } from './connection-status';
import type { AgentInfo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Bot } from 'lucide-react';
import Link from 'next/link';

interface SidebarProps {
  connected: boolean;
  activeAgents: AgentInfo[];
}

function AgentQuickCard({ agent }: { agent: AgentInfo }) {
  const statusColor = {
    RUNNING: 'bg-[var(--success)]',
    STOPPED: 'bg-[var(--text-muted)]',
    CRASHED: 'bg-[var(--error)]',
    EXITED: 'bg-[var(--text-muted)]',
    FAILED: 'bg-[var(--error)]',
  }[agent.status];

  return (
    <Link
      href="/agents"
      className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius)] text-xs hover:bg-white transition-colors duration-150"
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusColor)} />
      <span className="truncate text-[var(--text-secondary)]">{agent.name}</span>
    </Link>
  );
}

export function Sidebar({ connected, activeAgents }: SidebarProps) {
  const runningAgents = activeAgents.filter((a) => a.status === 'RUNNING');

  return (
    <aside className="w-60 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col shrink-0">
      {/* Navigation */}
      <div className="p-3">
        <NavMenu />
      </div>

      {/* Active Agents */}
      <div className="flex-1 overflow-y-auto px-3">
        {runningAgents.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 px-3 mb-1">
              <Bot className="w-3 h-3 text-[var(--text-muted)]" />
              <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Active Agents
              </span>
            </div>
            {runningAgents.map((agent) => (
              <AgentQuickCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>

      {/* Connection Status */}
      <ConnectionStatus connected={connected} agentCount={runningAgents.length} />
    </aside>
  );
}

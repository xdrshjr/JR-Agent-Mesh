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
    STARTING: 'bg-[var(--warning)]',
    RUNNING: 'bg-[var(--success)]',
    STOPPED: 'bg-[var(--text-muted)]',
    CRASHED: 'bg-[var(--error)]',
    EXITED: 'bg-[var(--text-muted)]',
    FAILED: 'bg-[var(--error)]',
  }[agent.status];

  return (
    <Link
      href="/agents"
      title={agent.name}
      className="relative group flex items-center justify-center w-8 h-8 rounded-[var(--radius)] hover:bg-white transition-colors duration-150"
    >
      <Bot className="w-4 h-4 text-[var(--text-secondary)]" />
      <span className={cn('absolute top-0.5 right-0.5 w-2 h-2 rounded-full', statusColor)} />
      <span className="absolute left-full ml-2 px-2 py-1 rounded-[var(--radius)] bg-[var(--foreground)] text-[var(--background)] text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
        {agent.name}
      </span>
    </Link>
  );
}

export function Sidebar({ connected, activeAgents }: SidebarProps) {
  const runningAgents = activeAgents.filter((a) => a.status === 'RUNNING');

  return (
    <aside className="w-14 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col shrink-0 items-center">
      {/* Navigation */}
      <div className="pt-3 pb-2">
        <NavMenu />
      </div>

      {/* Active Agents */}
      <div className="flex-1 min-h-0 flex flex-col items-center gap-1 py-2">
        {runningAgents.map((agent) => (
          <AgentQuickCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Connection Status */}
      <ConnectionStatus connected={connected} agentCount={runningAgents.length} />
    </aside>
  );
}

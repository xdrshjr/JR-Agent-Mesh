'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgentTab } from './agent-tab';
import type { AgentInfo } from '@/lib/types';

interface AgentTabBarProps {
  agents: AgentInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewAgent: () => void;
}

export function AgentTabBar({ agents, selectedId, onSelect, onClose, onNewAgent }: AgentTabBarProps) {
  return (
    <div className="flex items-end gap-1 px-4 pt-2 border-b border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
      {agents.map((agent) => (
        <AgentTab
          key={agent.id}
          agent={agent}
          isActive={agent.id === selectedId}
          onSelect={() => onSelect(agent.id)}
          onClose={() => onClose(agent.id)}
        />
      ))}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 mb-px"
        onClick={onNewAgent}
      >
        <Plus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </Button>
    </div>
  );
}

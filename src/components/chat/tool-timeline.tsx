'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import type { ToolCallRecord } from '@/lib/types';
import { ToolStep } from './tool-step';

interface ToolTimelineProps {
  toolCalls: ToolCallRecord[];
}

export function ToolTimeline({ toolCalls }: ToolTimelineProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (toolCalls.length === 0) return null;

  const completed = toolCalls.filter((tc) => tc.duration > 0).length;
  const total = toolCalls.length;

  return (
    <div className="my-2 border border-[var(--border)] rounded-[var(--radius)] overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-[var(--surface)] hover:bg-[var(--border)]/30 transition-colors text-left"
      >
        <Wrench className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          Tool Calls ({completed}/{total})
        </span>
        <span className="flex-1" />
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        )}
      </button>

      {!collapsed && (
        <div className="px-2 py-1 space-y-0.5" style={{ transition: 'height 200ms ease' }}>
          {toolCalls.map((tc) => (
            <ToolStep key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

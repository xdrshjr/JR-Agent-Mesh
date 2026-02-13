'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { ToolCallRecord } from '@/lib/types';
import { formatDuration } from '@/lib/utils';

interface ToolStepProps {
  toolCall: ToolCallRecord;
}

export function ToolStep({ toolCall }: ToolStepProps) {
  const [expanded, setExpanded] = useState(false);

  const isRunning = toolCall.duration === 0 && !toolCall.success;
  const StatusIcon = isRunning ? Loader2 : toolCall.success ? CheckCircle2 : XCircle;
  const statusColor = isRunning
    ? 'text-[var(--info)]'
    : toolCall.success
      ? 'text-[var(--success)]'
      : 'text-[var(--error)]';

  const argsSummary = Object.entries(toolCall.args)
    .slice(0, 2)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v);
      return `${k}: ${val.length > 30 ? val.slice(0, 30) + '...' : val}`;
    })
    .join(', ');

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full py-1 px-2 rounded hover:bg-[var(--surface)] transition-colors text-left"
      >
        <StatusIcon
          className={`w-3.5 h-3.5 shrink-0 ${statusColor} ${isRunning ? 'animate-spin' : ''}`}
        />
        <span className="text-xs font-medium text-[var(--foreground)] font-mono">{toolCall.tool}</span>
        <span className="text-xs text-[var(--text-muted)] truncate flex-1">{argsSummary}</span>
        <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
          {isRunning ? 'running' : formatDuration(toolCall.duration)}
        </span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
        )}
      </button>

      {expanded && (
        <div className="ml-6 mt-1 mb-2 text-xs space-y-2">
          <div>
            <div className="text-[var(--text-muted)] mb-0.5">Arguments:</div>
            <pre className="bg-[var(--surface)] border border-[var(--border)] rounded p-2 overflow-x-auto font-mono text-[11px]">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          {toolCall.result && (
            <div>
              <div className="text-[var(--text-muted)] mb-0.5">Result:</div>
              <pre className="bg-[var(--surface)] border border-[var(--border)] rounded p-2 overflow-x-auto font-mono text-[11px] max-h-40 overflow-y-auto">
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

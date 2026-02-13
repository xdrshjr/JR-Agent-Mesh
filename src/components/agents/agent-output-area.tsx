'use client';

import { useEffect, useRef } from 'react';
import { AnsiRenderer } from './ansi-renderer';
import type { ParsedOutput } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AgentOutputAreaProps {
  outputs: ParsedOutput[];
}

function OutputLine({ output }: { output: ParsedOutput }) {
  const typeColor = {
    text: 'text-[var(--foreground)]',
    tool_start: 'text-[var(--info)]',
    tool_end: 'text-[var(--success)]',
    thinking: 'text-[var(--text-muted)] italic',
    error: 'text-[var(--error)]',
    raw: 'text-[var(--foreground)]',
    user_input: 'text-[var(--primary)]',
  }[output.type];

  const prefix = {
    text: '',
    tool_start: '> ',
    tool_end: '> ',
    thinking: '💭 ',
    error: '❌ ',
    raw: '',
    user_input: '$ ',
  }[output.type];

  return (
    <div className={cn('font-mono text-[13px] leading-relaxed px-4 py-0.5', typeColor)}>
      {prefix && <span className="select-none">{prefix}</span>}
      {output.content ? <AnsiRenderer text={output.content} /> : null}
      {output.tool && !output.content && (
        <span>
          {output.type === 'tool_start' ? `Using ${output.tool}...` : `${output.tool} completed`}
          {output.args && <span className="text-[var(--text-muted)]"> ({output.args})</span>}
        </span>
      )}
    </div>
  );
}

export function AgentOutputArea({ outputs }: AgentOutputAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [outputs.length]);

  return (
    <div className="flex-1 overflow-y-auto bg-white font-mono">
      {outputs.length === 0 ? (
        <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
          Waiting for output...
        </div>
      ) : (
        <div className="py-2">
          {outputs.map((output, i) => (
            <OutputLine key={i} output={output} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

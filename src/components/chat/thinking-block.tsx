'use client';

import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

interface ThinkingBlockProps {
  text: string;
  streaming?: boolean;
}

export function ThinkingBlock({ text, streaming }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(streaming ?? false);

  if (!text && !streaming) return null;

  return (
    <div className="my-2 border-l-2 border-[var(--primary-light)] rounded-r-md bg-[var(--surface)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
      >
        <Brain className="w-3 h-3 text-[var(--primary)]" />
        <span className="font-medium">Thinking</span>
        {expanded
          ? <ChevronDown className="w-3 h-3 ml-auto" />
          : <ChevronRight className="w-3 h-3 ml-auto" />
        }
      </button>
      {expanded && (
        <div className="px-3 pb-2 text-xs text-[var(--text-secondary)] italic whitespace-pre-wrap max-h-64 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';
import { AgentInfoBar } from './agent-info-bar';
import { AgentOutputArea } from './agent-output-area';
import { AgentInputBox } from './agent-input-box';
import type { AgentInfo, ParsedOutput } from '@/lib/types';

// Dynamically import XtermTerminal to avoid SSR issues with xterm.js
const XtermTerminal = dynamic(
  () => import('./xterm-terminal').then((m) => ({ default: m.XtermTerminal })),
  { ssr: false },
);

/** Agent types that use a full TUI and need xterm.js rendering */
const TUI_AGENT_TYPES = new Set(['opencode', 'codex']);

interface AgentDetailPanelProps {
  agent: AgentInfo;
  outputs: ParsedOutput[];
  onStop: () => void;
  onRestart: () => void;
  onDelete: () => void;
  onSendInput: (text: string) => void;
}

export function AgentDetailPanel({
  agent,
  outputs,
  onStop,
  onRestart,
  onDelete,
  onSendInput,
}: AgentDetailPanelProps) {
  const useTui = TUI_AGENT_TYPES.has(agent.typeId);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AgentInfoBar
        agent={agent}
        onStop={onStop}
        onRestart={onRestart}
        onDelete={onDelete}
      />
      {useTui ? (
        <XtermTerminal
          agentId={agent.id}
          outputs={outputs}
          disabled={agent.status !== 'RUNNING'}
        />
      ) : (
        <>
          <AgentOutputArea outputs={outputs} />
          <AgentInputBox
            onSend={onSendInput}
            disabled={agent.status !== 'RUNNING'}
          />
        </>
      )}
    </div>
  );
}

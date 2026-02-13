'use client';

import { AgentInfoBar } from './agent-info-bar';
import { AgentOutputArea } from './agent-output-area';
import { AgentInputBox } from './agent-input-box';
import type { AgentInfo, ParsedOutput } from '@/lib/types';

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
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AgentInfoBar
        agent={agent}
        onStop={onStop}
        onRestart={onRestart}
        onDelete={onDelete}
      />
      <AgentOutputArea outputs={outputs} />
      <AgentInputBox
        onSend={onSendInput}
        disabled={agent.status !== 'RUNNING'}
      />
    </div>
  );
}

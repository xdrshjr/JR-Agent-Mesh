'use client';

import { useState } from 'react';
import { useAgentStore } from '@/stores/agent-store';
import { useAgentManager } from '@/hooks/use-agent-manager';
import { AgentToolbar } from '@/components/agents/agent-toolbar';
import { AgentTabBar } from '@/components/agents/agent-tab-bar';
import { AgentDetailPanel } from '@/components/agents/agent-detail-panel';
import { CreateAgentDialog } from '@/components/agents/create-agent-dialog';
import { Bot } from 'lucide-react';

export default function AgentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const agents = useAgentStore((s) => s.agents);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const outputs = useAgentStore((s) => s.outputs);
  const statusFilter = useAgentStore((s) => s.statusFilter);
  const setStatusFilter = useAgentStore((s) => s.setStatusFilter);
  const setSelectedAgent = useAgentStore((s) => s.setSelectedAgent);

  const { createAgent, sendInput, stopAgent, restartAgent, deleteAgent } = useAgentManager();

  const filteredAgents =
    statusFilter === 'all'
      ? agents
      : agents.filter((a) => {
          if (statusFilter === 'RUNNING') return a.status === 'RUNNING';
          return a.status !== 'RUNNING';
        });

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const selectedOutputs = selectedAgentId ? outputs[selectedAgentId] || [] : [];

  return (
    <div className="flex flex-col h-full">
      <AgentToolbar
        statusFilter={statusFilter}
        onFilterChange={setStatusFilter}
        onNewAgent={() => setDialogOpen(true)}
      />

      {agents.length > 0 && (
        <AgentTabBar
          agents={filteredAgents}
          selectedId={selectedAgentId}
          onSelect={setSelectedAgent}
          onClose={(id) => deleteAgent(id)}
          onNewAgent={() => setDialogOpen(true)}
        />
      )}

      {selectedAgent ? (
        <AgentDetailPanel
          agent={selectedAgent}
          outputs={selectedOutputs}
          onStop={() => stopAgent(selectedAgent.id)}
          onRestart={() => restartAgent(selectedAgent.id)}
          onDelete={() => deleteAgent(selectedAgent.id)}
          onSendInput={(text) => sendInput(selectedAgent.id, text)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--surface)] flex items-center justify-center">
              <Bot className="w-6 h-6 text-[var(--text-muted)]" />
            </div>
            <p className="text-base font-light text-[var(--foreground)] mb-1">No agents running</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Create a new agent to get started
            </p>
          </div>
        </div>
      )}

      <CreateAgentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={createAgent}
      />
    </div>
  );
}

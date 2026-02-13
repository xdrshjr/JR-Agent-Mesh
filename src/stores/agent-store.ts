import { create } from 'zustand';
import type { AgentInfo, ParsedOutput } from '@/lib/types';

interface AgentOutputs {
  [agentId: string]: ParsedOutput[];
}

interface AgentState {
  agents: AgentInfo[];
  selectedAgentId: string | null;
  outputs: AgentOutputs;
  tabOrder: string[];
  statusFilter: 'all' | 'RUNNING' | 'STOPPED';

  // Actions
  setAgents: (agents: AgentInfo[]) => void;
  addAgent: (agent: AgentInfo) => void;
  removeAgent: (id: string) => void;
  updateAgentStatus: (id: string, status: AgentInfo['status']) => void;
  setSelectedAgent: (id: string | null) => void;

  // Outputs
  appendOutput: (agentId: string, output: ParsedOutput) => void;
  setOutputHistory: (agentId: string, outputs: ParsedOutput[]) => void;
  clearOutputs: (agentId: string) => void;

  // Tabs
  setTabOrder: (order: string[]) => void;
  setStatusFilter: (filter: 'all' | 'RUNNING' | 'STOPPED') => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  selectedAgentId: null,
  outputs: {},
  tabOrder: [],
  statusFilter: 'all',

  setAgents: (agents) =>
    set({
      agents,
      tabOrder: agents.map((a) => a.id),
    }),

  addAgent: (agent) =>
    set((s) => ({
      agents: [...s.agents, agent],
      tabOrder: [...s.tabOrder, agent.id],
      selectedAgentId: agent.id,
      outputs: { ...s.outputs, [agent.id]: [] },
    })),

  removeAgent: (id) =>
    set((s) => {
      const newAgents = s.agents.filter((a) => a.id !== id);
      const newTabOrder = s.tabOrder.filter((tid) => tid !== id);
      const newOutputs = { ...s.outputs };
      delete newOutputs[id];
      return {
        agents: newAgents,
        tabOrder: newTabOrder,
        outputs: newOutputs,
        selectedAgentId: s.selectedAgentId === id ? (newTabOrder[0] ?? null) : s.selectedAgentId,
      };
    }),

  updateAgentStatus: (id, status) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    })),

  setSelectedAgent: (id) => set({ selectedAgentId: id }),

  appendOutput: (agentId, output) =>
    set((s) => ({
      outputs: {
        ...s.outputs,
        [agentId]: [...(s.outputs[agentId] || []), output],
      },
    })),

  setOutputHistory: (agentId, outputs) =>
    set((s) => ({
      outputs: {
        ...s.outputs,
        [agentId]: outputs,
      },
    })),

  clearOutputs: (agentId) =>
    set((s) => ({
      outputs: {
        ...s.outputs,
        [agentId]: [],
      },
    })),

  setTabOrder: (order) => set({ tabOrder: order }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
}));

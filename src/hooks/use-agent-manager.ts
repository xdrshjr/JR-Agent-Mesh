'use client';

import { useCallback } from 'react';
import { useWebSocketClient } from './use-websocket';
import { useAgentStore } from '@/stores/agent-store';
import type { AgentTypeId } from '@/lib/types';

export function useAgentManager() {
  const { client } = useWebSocketClient();
  const { agents, selectedAgentId, setSelectedAgent } = useAgentStore();

  const createAgent = useCallback(
    (options: { typeId: AgentTypeId; name?: string; workDir?: string; initialPrompt?: string }) => {
      if (!client) return;
      client.send('agent.create', options);
    },
    [client],
  );

  const sendInput = useCallback(
    (agentId: string, text: string) => {
      if (!client || !text.trim()) return;
      client.send('agent.send_input', { agentId, text });
    },
    [client],
  );

  const stopAgent = useCallback(
    (agentId: string) => {
      if (!client) return;
      client.send('agent.stop', { agentId });
    },
    [client],
  );

  const restartAgent = useCallback(
    (agentId: string) => {
      if (!client) return;
      client.send('agent.restart', { agentId });
    },
    [client],
  );

  const deleteAgent = useCallback(
    (agentId: string) => {
      if (!client) return;
      client.send('agent.delete', { agentId });
      useAgentStore.getState().removeAgent(agentId);
    },
    [client],
  );

  const getOutput = useCallback(
    (agentId: string, fromIndex?: number) => {
      if (!client) return;
      client.send('agent.get_output', { agentId, fromIndex });
    },
    [client],
  );

  return {
    agents,
    selectedAgentId,
    setSelectedAgent,
    createAgent,
    sendInput,
    stopAgent,
    restartAgent,
    deleteAgent,
    getOutput,
  };
}

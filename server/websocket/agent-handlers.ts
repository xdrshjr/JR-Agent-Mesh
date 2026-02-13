import { registerHandler } from './handler.js';
import { sendToClient } from './server.js';
import { logger } from '../utils/logger.js';
import type { AgentProcessManager } from '../services/agent-process-manager.js';
import type {
  AgentCreatePayload,
  AgentSendInputPayload,
  AgentSendRawInputPayload,
  AgentResizePayload,
  AgentStopPayload,
  AgentRestartPayload,
  AgentDeletePayload,
  AgentGetOutputPayload,
} from '../../shared/types.js';

export function registerAgentHandlers(agentProcessManager: AgentProcessManager) {
  // agent.create — Create a new backend agent
  registerHandler('agent.create', async (ws, payload) => {
    const data = payload as AgentCreatePayload;

    if (!data.typeId) {
      logger.warn('AgentHandler', 'Invalid agent.create payload: missing typeId');
      sendToClient(ws, 'system.notification', {
        level: 'error',
        title: 'Create Failed',
        message: 'Agent type is required.',
      });
      return;
    }

    try {
      const info = await agentProcessManager.createProcess(
        data.typeId,
        data.name,
        data.workDir,
        data.initialPrompt,
      );
      logger.info('AgentHandler', `Agent created: ${info.name} (${info.id})`);
      // agent.created is already broadcast by AgentProcessManager
    } catch (err: any) {
      logger.error('AgentHandler', 'Failed to create agent', err);
      sendToClient(ws, 'system.notification', {
        level: 'error',
        title: 'Create Failed',
        message: err.message,
      });
    }
  });

  // agent.send_input — Send user input to a running agent
  registerHandler('agent.send_input', (_ws, payload) => {
    const data = payload as AgentSendInputPayload;

    if (!data.agentId || !data.text) {
      logger.warn('AgentHandler', 'Invalid agent.send_input payload');
      return;
    }

    try {
      agentProcessManager.sendInput(data.agentId, data.text);
    } catch (err: any) {
      logger.error('AgentHandler', `Failed to send input to ${data.agentId}`, err);
    }
  });

  // agent.send_raw_input — Send raw keystrokes to a running agent (for xterm.js)
  registerHandler('agent.send_raw_input', (_ws, payload) => {
    const data = payload as AgentSendRawInputPayload;

    if (!data.agentId || typeof data.data !== 'string') {
      return;
    }

    try {
      agentProcessManager.sendRawInput(data.agentId, data.data);
    } catch (err: any) {
      logger.error('AgentHandler', `Failed to send raw input to ${data.agentId}`, err);
    }
  });

  // agent.resize — Sync xterm.js terminal dimensions to backend PTY
  registerHandler('agent.resize', (_ws, payload) => {
    const data = payload as AgentResizePayload;

    if (!data.agentId || typeof data.cols !== 'number' || typeof data.rows !== 'number') {
      return;
    }
    if (data.cols < 1 || data.rows < 1 || !Number.isFinite(data.cols) || !Number.isFinite(data.rows)) {
      return;
    }

    try {
      agentProcessManager.resizePty(data.agentId, Math.floor(data.cols), Math.floor(data.rows));
    } catch (err: any) {
      logger.error('AgentHandler', `Failed to resize PTY for ${data.agentId}`, err);
    }
  });

  // agent.stop — Stop a running agent
  registerHandler('agent.stop', async (ws, payload) => {
    const data = payload as AgentStopPayload;

    if (!data.agentId) {
      logger.warn('AgentHandler', 'Invalid agent.stop payload');
      return;
    }

    try {
      await agentProcessManager.stopProcess(data.agentId);
      logger.info('AgentHandler', `Agent stopped: ${data.agentId}`);
    } catch (err: any) {
      logger.error('AgentHandler', `Failed to stop agent ${data.agentId}`, err);
      sendToClient(ws, 'system.notification', {
        level: 'error',
        title: 'Stop Failed',
        message: err.message,
      });
    }
  });

  // agent.restart — Restart an agent
  registerHandler('agent.restart', async (ws, payload) => {
    const data = payload as AgentRestartPayload;

    if (!data.agentId) {
      logger.warn('AgentHandler', 'Invalid agent.restart payload');
      return;
    }

    try {
      await agentProcessManager.restartProcess(data.agentId);
      logger.info('AgentHandler', `Agent restarted: ${data.agentId}`);
    } catch (err: any) {
      logger.error('AgentHandler', `Failed to restart agent ${data.agentId}`, err);
      sendToClient(ws, 'system.notification', {
        level: 'error',
        title: 'Restart Failed',
        message: err.message,
      });
    }
  });

  // agent.delete — Stop and delete an agent
  registerHandler('agent.delete', async (ws, payload) => {
    const data = payload as AgentDeletePayload;

    if (!data.agentId) {
      logger.warn('AgentHandler', 'Invalid agent.delete payload');
      return;
    }

    try {
      await agentProcessManager.deleteProcess(data.agentId);
      logger.info('AgentHandler', `Agent deleted: ${data.agentId}`);
    } catch (err: any) {
      logger.error('AgentHandler', `Failed to delete agent ${data.agentId}`, err);
      sendToClient(ws, 'system.notification', {
        level: 'error',
        title: 'Delete Failed',
        message: err.message,
      });
    }
  });

  // agent.get_output — Get output history for an agent
  registerHandler('agent.get_output', (ws, payload) => {
    const data = payload as AgentGetOutputPayload;

    if (!data.agentId) {
      logger.warn('AgentHandler', 'Invalid agent.get_output payload');
      return;
    }

    try {
      const outputs = agentProcessManager.getOutputHistory(data.agentId, data.fromIndex);
      sendToClient(ws, 'agent.output_history', {
        agentId: data.agentId,
        outputs,
        totalCount: outputs.length,
      });
    } catch (err: any) {
      logger.error('AgentHandler', `Failed to get output for ${data.agentId}`, err);
    }
  });

  logger.info('AgentHandler', 'Agent WebSocket handlers registered');
}

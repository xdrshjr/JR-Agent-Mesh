import type { AgentTypeId } from '../../shared/types.js';
import { logger } from '../utils/logger.js';

export type InputMode = 'stdin' | 'newline';

export interface AgentTypeConfig {
  id: AgentTypeId;
  displayName: string;
  command: string;
  args: string[];
  envMapping: Record<string, string>; // { ENV_VAR_NAME: credential_key }
  inputMode: InputMode;
  healthCheck?: string;
  icon: string;
  description: string;
}

const registry = new Map<AgentTypeId, AgentTypeConfig>();

export function registerAgentType(config: AgentTypeConfig) {
  registry.set(config.id, config);
  logger.info('AgentRegistry', `Registered agent type: ${config.displayName}`);
}

export function getAgentType(id: AgentTypeId): AgentTypeConfig | undefined {
  return registry.get(id);
}

export function getAllAgentTypes(): AgentTypeConfig[] {
  return Array.from(registry.values());
}

export function initAgentRegistry() {
  registerAgentType({
    id: 'claude-code',
    displayName: 'Claude Code',
    command: 'claude',
    args: ['--dangerously-skip-permissions'],
    envMapping: {
      ANTHROPIC_API_KEY: 'anthropic_key',
    },
    inputMode: 'stdin',
    healthCheck: 'claude --version',
    icon: 'anthropic',
    description: 'Anthropic Claude Code CLI agent',
  });

  registerAgentType({
    id: 'opencode',
    displayName: 'OpenCode',
    command: 'opencode',
    args: [],
    envMapping: {
      OPENAI_API_KEY: 'openai_key',
    },
    inputMode: 'stdin',
    healthCheck: 'opencode --version',
    icon: 'opencode',
    description: 'OpenCode CLI agent',
  });

  registerAgentType({
    id: 'codex',
    displayName: 'Codex',
    command: 'codex',
    args: [],
    envMapping: {
      OPENAI_API_KEY: 'openai_key',
    },
    inputMode: 'stdin',
    healthCheck: 'codex --version',
    icon: 'codex',
    description: 'OpenAI Codex CLI agent',
  });

  logger.info('AgentRegistry', `Initialized with ${registry.size} agent types`);
}

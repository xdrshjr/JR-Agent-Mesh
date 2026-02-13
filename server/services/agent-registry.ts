import type { AgentTypeId } from '../../shared/types.js';
import { logger } from '../utils/logger.js';

export interface AgentTypeConfig {
  id: AgentTypeId;
  displayName: string;
  command: string;
  args: string[];
  envVars: Record<string, string>;
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

// Register built-in agent types
export function initAgentRegistry() {
  registerAgentType({
    id: 'claude-code',
    displayName: 'Claude Code',
    command: 'claude',
    args: ['--dangerously-skip-permissions'],
    envVars: {},
    description: 'Anthropic Claude Code CLI agent',
  });

  registerAgentType({
    id: 'opencode',
    displayName: 'OpenCode',
    command: 'opencode',
    args: [],
    envVars: {},
    description: 'OpenCode CLI agent',
  });

  registerAgentType({
    id: 'codex',
    displayName: 'Codex',
    command: 'codex',
    args: [],
    envVars: {},
    description: 'OpenAI Codex CLI agent',
  });

  logger.info('AgentRegistry', `Initialized with ${registry.size} agent types`);
}

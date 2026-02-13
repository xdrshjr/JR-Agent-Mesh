import { Type } from '@sinclair/typebox';
import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import type { TextContent } from '@mariozechner/pi-ai';
import { resolve } from 'node:path';
import type { AgentProcessManager } from '../agent-process-manager.js';
import type { FileTransferService } from '../file-transfer.js';

// --- Helper ---

function textResult(text: string): AgentToolResult<undefined> {
  return {
    content: [{ type: 'text', text } as TextContent],
    details: undefined,
  };
}

function errorResult(error: string): AgentToolResult<undefined> {
  return {
    content: [{ type: 'text', text: `Error: ${error}` } as TextContent],
    details: undefined,
  };
}

// --- File Transfer Tool ---

export interface FileTransferContext {
  conversationId?: string;
  messageId?: string;
}

export type FileTransferContextProvider = () => FileTransferContext;

const FileTransferParams = Type.Object({
  path: Type.String({ description: 'Path to the file on server to send to user' }),
  filename: Type.Optional(Type.String({ description: 'Custom download filename (optional)' })),
});

export function createFileTransferTool(
  fileTransferService: FileTransferService,
  getContext: FileTransferContextProvider,
): AgentTool<typeof FileTransferParams> {
  return {
    name: 'file_transfer',
    label: 'Send File',
    description: 'Send a file from the server to the user for download.',
    parameters: FileTransferParams,
    async execute(_toolCallId, params) {
      try {
        const sourcePath = resolve(params.path);
        const ctx = getContext();

        const result = fileTransferService.prepareDownload({
          sourcePath,
          filename: params.filename,
          conversationId: ctx.conversationId ?? undefined,
          messageId: ctx.messageId ?? undefined,
        });

        if ('error' in result) {
          return errorResult(result.error);
        }

        const sizeStr = formatSize(result.size);
        return textResult(`File "${result.filename}" (${sizeStr}) is ready for user to download.`);
      } catch (err: any) {
        return errorResult(err.message);
      }
    },
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// --- Agent Dispatch Tool ---

const AgentDispatchParams = Type.Object({
  agentId: Type.Optional(Type.String({ description: 'Specific agent ID to send task to' })),
  agentType: Type.Optional(Type.String({ description: 'Agent type (e.g. "claude-code", "opencode", "codex")' })),
  task: Type.String({ description: 'Task description to send to the agent' }),
  workDir: Type.Optional(Type.String({ description: 'Working directory for the agent (optional)' })),
});

export function createAgentDispatchTool(
  agentProcessManager: AgentProcessManager,
): AgentTool<typeof AgentDispatchParams> {
  return {
    name: 'agent_dispatch',
    label: 'Dispatch to Agent',
    description:
      'Dispatch a task to a backend agent (e.g. Claude Code, OpenCode, Codex). ' +
      'Specify agentId to target a specific running agent, agentType to find or create one of that type, ' +
      'or omit both to auto-select based on the task.',
    parameters: AgentDispatchParams,
    async execute(_toolCallId, params) {
      try {
        let agent: { id: string; name: string } | null = null;

        if (params.agentId) {
          const proc = agentProcessManager.getInfo(params.agentId);
          if (!proc) {
            return errorResult(`Agent with ID "${params.agentId}" not found`);
          }
          agent = proc;
        } else if (params.agentType) {
          agent = await agentProcessManager.findOrCreate(
            params.agentType as any,
            params.workDir,
          );
        } else {
          agent = await agentProcessManager.autoSelect(params.task);
        }

        if (!agent) {
          return errorResult('Failed to find or create an agent for this task');
        }

        // Send the task to the agent
        agentProcessManager.sendInput(agent.id, params.task);

        return textResult(
          `Task dispatched to ${agent.name} (${agent.id}). User can view progress on the Agents page.`,
        );
      } catch (err: any) {
        return errorResult(err.message);
      }
    },
  };
}

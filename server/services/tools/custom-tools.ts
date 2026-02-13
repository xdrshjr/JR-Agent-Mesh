import { Type } from '@sinclair/typebox';
import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import type { TextContent } from '@mariozechner/pi-ai';
import { existsSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { AgentProcessManager } from '../agent-process-manager.js';

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

export interface FileTransferInfo {
  fileId: string;
  filename: string;
  size: number;
  filePath: string;
}

export type FileReadyCallback = (info: FileTransferInfo) => void;

const FileTransferParams = Type.Object({
  path: Type.String({ description: 'Path to the file on server to send to user' }),
  filename: Type.Optional(Type.String({ description: 'Custom download filename (optional)' })),
});

export function createFileTransferTool(
  dataDir: string,
  onFileReady: FileReadyCallback,
): AgentTool<typeof FileTransferParams> {
  const downloadDir = join(dataDir, 'downloads');
  mkdirSync(downloadDir, { recursive: true });

  return {
    name: 'file_transfer',
    label: 'Send File',
    description: 'Send a file from the server to the user for download.',
    parameters: FileTransferParams,
    async execute(_toolCallId, params) {
      try {
        const sourcePath = resolve(params.path);
        if (!existsSync(sourcePath)) {
          return errorResult(`File not found: ${sourcePath}`);
        }
        const stat = statSync(sourcePath);
        if (stat.isDirectory()) {
          return errorResult(`Path is a directory: ${sourcePath}`);
        }

        const fileId = uuidv4();
        const filename = params.filename || basename(sourcePath);
        const destPath = join(downloadDir, fileId);
        copyFileSync(sourcePath, destPath);

        onFileReady({
          fileId,
          filename,
          size: stat.size,
          filePath: destPath,
        });

        return textResult(`File "${filename}" (${stat.size} bytes) is ready for user to download.`);
      } catch (err: any) {
        return errorResult(err.message);
      }
    },
  };
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
        // AgentProcessManager is a stub for now — this provides the interface
        // It will be fully implemented in 04-backend-agent-manager
        const pm = agentProcessManager as any;

        let agent: { id: string; name: string } | null = null;

        if (params.agentId) {
          if (typeof pm.get !== 'function') {
            return errorResult('AgentProcessManager not fully implemented yet');
          }
          agent = pm.get(params.agentId);
          if (!agent) {
            return errorResult(`Agent with ID "${params.agentId}" not found`);
          }
        } else if (params.agentType) {
          if (typeof pm.findOrCreate !== 'function') {
            return errorResult('AgentProcessManager not fully implemented yet');
          }
          agent = await pm.findOrCreate(params.agentType, params.workDir);
        } else {
          if (typeof pm.autoSelect !== 'function') {
            return errorResult('AgentProcessManager not fully implemented yet');
          }
          agent = await pm.autoSelect(params.task);
        }

        if (!agent) {
          return errorResult('Failed to find or create an agent for this task');
        }

        // Send the task to the agent
        if (typeof pm.sendInput === 'function') {
          pm.sendInput(agent.id, params.task);
        }

        return textResult(
          `Task dispatched to ${agent.name} (${agent.id}). User can view progress on the Agents page.`,
        );
      } catch (err: any) {
        return errorResult(err.message);
      }
    },
  };
}

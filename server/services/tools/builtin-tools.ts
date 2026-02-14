import { Type, type Static } from '@sinclair/typebox';
import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import type { TextContent } from '@mariozechner/pi-ai';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, dirname, isAbsolute, join } from 'node:path';
import { mkdirSync } from 'node:fs';

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

// --- Workspace Context ---

export interface WorkspaceContext {
  conversationId?: string;
  dataDir: string;
}

export type WorkspaceContextProvider = () => WorkspaceContext;

function resolveWorkspacePath(userPath: string, ctx: WorkspaceContext): string {
  if (isAbsolute(userPath)) return resolve(userPath);
  if (!ctx.conversationId) return resolve(userPath);

  const workspaceDir = resolve(join(ctx.dataDir, 'workspaces', ctx.conversationId));
  mkdirSync(workspaceDir, { recursive: true });
  return resolve(join(workspaceDir, userPath));
}

function getWorkspaceCwd(ctx: WorkspaceContext): string {
  if (!ctx.conversationId) return process.cwd();

  const workspaceDir = resolve(join(ctx.dataDir, 'workspaces', ctx.conversationId));
  mkdirSync(workspaceDir, { recursive: true });
  return workspaceDir;
}

// --- Read Tool ---

const ReadParams = Type.Object({
  path: Type.String({ description: 'Absolute or relative file path to read' }),
  offset: Type.Optional(Type.Number({ description: 'Line number to start reading from (1-based)' })),
  limit: Type.Optional(Type.Number({ description: 'Maximum number of lines to read' })),
});

export function createReadTool(getContext: WorkspaceContextProvider): AgentTool<typeof ReadParams> {
  return {
    name: 'read',
    label: 'Read File',
    description: 'Read file contents. Returns the file content with line numbers.',
    parameters: ReadParams,
    async execute(_toolCallId, params) {
      try {
        const filePath = resolveWorkspacePath(params.path, getContext());
        if (!existsSync(filePath)) {
          return errorResult(`File not found: ${filePath}`);
        }
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
          return errorResult(`Path is a directory: ${filePath}`);
        }
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        const offset = (params.offset ?? 1) - 1;
        const limit = params.limit ?? lines.length;
        const slice = lines.slice(offset, offset + limit);

        const numbered = slice
          .map((line, i) => `${String(offset + i + 1).padStart(6)} | ${line}`)
          .join('\n');

        return textResult(numbered);
      } catch (err: any) {
        return errorResult(err.message);
      }
    },
  };
}

// --- Write Tool ---

const WriteParams = Type.Object({
  path: Type.String({ description: 'File path to write to' }),
  content: Type.String({ description: 'Content to write to the file' }),
});

export function createWriteTool(getContext: WorkspaceContextProvider): AgentTool<typeof WriteParams> {
  return {
    name: 'write',
    label: 'Write File',
    description: 'Write content to a file. Creates the file and parent directories if they do not exist. Overwrites existing content.',
    parameters: WriteParams,
    async execute(_toolCallId, params) {
      try {
        const filePath = resolveWorkspacePath(params.path, getContext());
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, params.content, 'utf-8');
        return textResult(`Successfully wrote ${params.content.length} characters to ${filePath}`);
      } catch (err: any) {
        return errorResult(err.message);
      }
    },
  };
}

// --- Edit Tool ---

const EditParams = Type.Object({
  path: Type.String({ description: 'File path to edit' }),
  search: Type.String({ description: 'Exact string to search for in the file' }),
  replace: Type.String({ description: 'String to replace the search match with' }),
});

export function createEditTool(getContext: WorkspaceContextProvider): AgentTool<typeof EditParams> {
  return {
    name: 'edit',
    label: 'Edit File',
    description: 'Edit a file by replacing an exact string match. The search string must appear exactly once in the file.',
    parameters: EditParams,
    async execute(_toolCallId, params) {
      try {
        const filePath = resolveWorkspacePath(params.path, getContext());
        if (!existsSync(filePath)) {
          return errorResult(`File not found: ${filePath}`);
        }
        const content = readFileSync(filePath, 'utf-8');
        const count = content.split(params.search).length - 1;

        if (count === 0) {
          return errorResult('Search string not found in file');
        }
        if (count > 1) {
          return errorResult(`Search string found ${count} times — must be unique. Provide more context.`);
        }

        const newContent = content.replace(params.search, params.replace);
        writeFileSync(filePath, newContent, 'utf-8');
        return textResult(`Successfully edited ${filePath}`);
      } catch (err: any) {
        return errorResult(err.message);
      }
    },
  };
}

// --- Bash Tool ---

const BashParams = Type.Object({
  command: Type.String({ description: 'Shell command to execute' }),
  timeout: Type.Optional(Type.Number({ description: 'Timeout in milliseconds (default: 120000)' })),
});

export function createBashTool(getContext: WorkspaceContextProvider): AgentTool<typeof BashParams> {
  return {
    name: 'bash',
    label: 'Run Command',
    description: 'Execute a shell command and return its output (stdout + stderr combined).',
    parameters: BashParams,
    async execute(_toolCallId, params, signal) {
      const timeoutMs = params.timeout ?? 120000;
      const cwd = getWorkspaceCwd(getContext());

      return new Promise((resolvePromise) => {
        const isWindows = process.platform === 'win32';
        const shell = isWindows ? 'cmd.exe' : '/bin/bash';
        const shellArgs = isWindows ? ['/c', params.command] : ['-c', params.command];

        const child = spawn(shell, shellArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env },
          cwd,
        });

        let output = '';
        let settled = false;
        const MAX_OUTPUT = 100000;

        const settle = (result: AgentToolResult<undefined>) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolvePromise(result);
        };

        // Manual timeout since spawn() does not support the timeout option
        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          // Give it a moment to die, then force kill
          setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
          }, 2000);
          settle(errorResult(`Command timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        child.stdout.on('data', (data: Buffer) => {
          if (output.length < MAX_OUTPUT) {
            output += data.toString();
          }
        });

        child.stderr.on('data', (data: Buffer) => {
          if (output.length < MAX_OUTPUT) {
            output += data.toString();
          }
        });

        if (signal) {
          signal.addEventListener('abort', () => {
            child.kill('SIGTERM');
            settle(errorResult('Command aborted'));
          }, { once: true });
        }

        child.on('close', (code) => {
          if (output.length > MAX_OUTPUT) {
            output = output.slice(0, MAX_OUTPUT) + '\n... [output truncated]';
          }
          const exitInfo = code !== 0 ? `\n[exit code: ${code}]` : '';
          settle(textResult((output || '(no output)') + exitInfo));
        });

        child.on('error', (err) => {
          settle(errorResult(err.message));
        });
      });
    },
  };
}

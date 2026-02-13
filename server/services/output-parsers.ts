import type { ParsedOutput } from '../../shared/types.js';

// --- RingBuffer: keeps the most recent N characters ---

export class RingBuffer {
  private buffer: string;
  private maxSize: number;

  constructor(maxSize: number = 100_000) {
    this.buffer = '';
    this.maxSize = maxSize;
  }

  append(data: string): void {
    this.buffer += data;
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(this.buffer.length - this.maxSize);
    }
  }

  getContent(): string {
    return this.buffer;
  }

  getLength(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = '';
  }
}

// --- OutputParser interface ---

export interface OutputParser {
  parse(rawData: string): ParsedOutput[];
}

// --- ANSI strip helper ---

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b[()][AB012]|\x1b\[[\?]?[0-9;]*[hlmsu]/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

// --- Claude Code Parser ---

export class ClaudeCodeParser implements OutputParser {
  parse(rawData: string): ParsedOutput[] {
    const stripped = stripAnsi(rawData);
    const results: ParsedOutput[] = [];

    // Match tool call patterns from Claude Code CLI
    const readMatch = stripped.match(/Reading\s+(.+)\.\.\./);
    const writeMatch = stripped.match(/Writing to\s+(.+)/);
    const bashMatch = stripped.match(/Running:\s+(.+)/);
    const editMatch = stripped.match(/Editing\s+(.+)/);

    if (readMatch) {
      results.push({ type: 'tool_start', tool: 'read', args: readMatch[1].trim() });
    } else if (writeMatch) {
      results.push({ type: 'tool_start', tool: 'write', args: writeMatch[1].trim() });
    } else if (bashMatch) {
      results.push({ type: 'tool_start', tool: 'bash', args: bashMatch[1].trim() });
    } else if (editMatch) {
      results.push({ type: 'tool_start', tool: 'edit', args: editMatch[1].trim() });
    } else {
      // Preserve raw ANSI for terminal-style display
      results.push({ type: 'text', content: rawData });
    }

    return results;
  }
}

// --- Generic CLI Parser (pass-through) ---

export class GenericCLIParser implements OutputParser {
  parse(rawData: string): ParsedOutput[] {
    return [{ type: 'raw', content: rawData }];
  }
}

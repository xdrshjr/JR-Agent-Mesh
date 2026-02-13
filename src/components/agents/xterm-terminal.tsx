'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useWebSocketClient } from '@/hooks/use-websocket';
import type { ParsedOutput } from '@/lib/types';

interface XtermTerminalProps {
  agentId: string;
  outputs: ParsedOutput[];
  disabled?: boolean;
}

export function XtermTerminal({ agentId, outputs, disabled }: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const writtenCountRef = useRef(0);
  const prevOutputsRef = useRef<ParsedOutput[]>([]);
  const { client } = useWebSocketClient();

  // Keep refs in sync for use inside callbacks
  const clientRef = useRef(client);
  const disabledRef = useRef(disabled);
  const agentIdRef = useRef(agentId);
  clientRef.current = client;
  disabledRef.current = disabled;
  agentIdRef.current = agentId;

  // Initialize xterm.js
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#d7ba7d',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#f44747',
        brightGreen: '#6a9955',
        brightYellow: '#d7ba7d',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    writtenCountRef.current = 0;
    prevOutputsRef.current = [];

    // Forward keyboard input to PTY via WebSocket
    const inputDisposable = terminal.onData((data) => {
      if (clientRef.current && !disabledRef.current) {
        clientRef.current.send('agent.send_raw_input', {
          agentId: agentIdRef.current,
          data,
        });
      }
    });

    // Sync terminal resize to backend PTY
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      if (clientRef.current) {
        clientRef.current.send('agent.resize', {
          agentId: agentIdRef.current,
          cols,
          rows,
        });
      }
    });

    // Debounced fit — avoids flooding backend during window drag
    let fitTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFit = () => {
      if (fitTimer) clearTimeout(fitTimer);
      fitTimer = setTimeout(() => {
        fitTimer = null;
        try {
          fitAddon.fit();
        } catch { /* container may not be ready */ }
      }, 100);
    };

    // Initial fit: use double-rAF to ensure the browser has computed layout
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch { /* container may not be ready */ }
        // Send initial size to backend so PTY matches xterm from the start
        if (clientRef.current) {
          clientRef.current.send('agent.resize', {
            agentId: agentIdRef.current,
            cols: terminal.cols,
            rows: terminal.rows,
          });
        }
      });
    });

    // Re-fit on container resize
    const resizeObserver = new ResizeObserver(() => debouncedFit());
    resizeObserver.observe(containerRef.current);

    return () => {
      if (fitTimer) clearTimeout(fitTimer);
      inputDisposable.dispose();
      resizeDisposable.dispose();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      writtenCountRef.current = 0;
      prevOutputsRef.current = [];
    };
  }, [agentId]);

  // Write new outputs to terminal
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const prevOutputs = prevOutputsRef.current;

    // Detect if the outputs array was replaced (clearOutputs / setOutputHistory)
    // rather than appended to. If the array identity changed and length shrunk,
    // or the leading items differ, we need to reset and replay everything.
    const wasReplaced =
      outputs !== prevOutputs && (
        outputs.length < writtenCountRef.current ||
        (outputs.length > 0 && prevOutputs.length > 0 && outputs[0] !== prevOutputs[0])
      );

    if (wasReplaced) {
      terminal.reset();
      writtenCountRef.current = 0;
    }

    const alreadyWritten = writtenCountRef.current;
    const newOutputs = outputs.slice(alreadyWritten);

    for (const output of newOutputs) {
      if (output.content) {
        terminal.write(output.content);
      }
    }

    writtenCountRef.current = outputs.length;
    prevOutputsRef.current = outputs;
  }, [outputs]);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-hidden"
      style={{ padding: '4px', backgroundColor: '#1e1e1e' }}
    />
  );
}

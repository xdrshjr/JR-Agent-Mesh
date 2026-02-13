'use client';

import { useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AgentInputBoxProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function AgentInputBox({ onSend, disabled }: AgentInputBoxProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-[var(--border)] px-4 py-2 bg-white">
      <div className="flex items-center gap-2 border border-[var(--border)] rounded-[var(--radius)] px-3 py-1.5 focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)] transition-all duration-150">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a command to this agent..."
          className="flex-1 outline-none text-sm bg-transparent font-mono"
          disabled={disabled}
        />
        <Button
          variant="default"
          size="icon"
          className="h-7 w-7 shrink-0"
          disabled={!text.trim() || disabled}
          onClick={handleSend}
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

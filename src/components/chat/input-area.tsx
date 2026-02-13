'use client';

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Paperclip, Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttachmentPreview } from './attachment-preview';
import { useSelfAgent } from '@/hooks/use-self-agent';
import { cn } from '@/lib/utils';

export function InputArea() {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, abort, isLoading } = useSelfAgent();

  const handleSend = useCallback(() => {
    if (!text.trim() || isLoading) return;
    sendMessage(text.trim());
    setText('');
    setFiles([]);
    textareaRef.current?.focus();
  }, [text, isLoading, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      e.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  return (
    <div className="border-t border-[var(--border)] bg-white">
      <AttachmentPreview files={files} onRemove={handleRemoveFile} />

      <div className="max-w-3xl mx-auto px-4 py-3">
        <div
          className={cn(
            'flex items-end gap-2 border border-[var(--border)] rounded-[var(--radius)] px-3 py-2 bg-white',
            'focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)]',
            'transition-all duration-150',
          )}
        >
          {/* Attachment button */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={handleFileSelect}
          >
            <Paperclip className="w-4 h-4 text-[var(--text-muted)]" />
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesChange}
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none outline-none text-sm bg-transparent min-h-[24px] max-h-[200px] py-1"
          />

          {/* Send / Stop button */}
          {isLoading ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8"
              onClick={abort}
            >
              <Square className="w-4 h-4 text-[var(--error)]" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="icon"
              className="shrink-0 h-8 w-8"
              disabled={!text.trim()}
              onClick={handleSend}
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './markdown-renderer';
import { ToolTimeline } from './tool-timeline';
import { FileAttachment } from './file-attachment';
import type { Message } from '@/lib/types';
import { useChatStore } from '@/stores/chat-store';
import { User, Bot } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const getFileReadyInfo = useChatStore((s) => s.getFileReadyInfo);

  return (
    <div
      className={cn(
        'flex gap-3 py-4 px-4 animate-in fade-in slide-in-from-bottom-2 duration-250',
        isUser ? 'flex-row-reverse' : '',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
          isUser ? 'bg-[var(--surface)] border border-[var(--border)]' : 'bg-[var(--primary)]',
        )}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-white" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex-1 min-w-0 max-w-[85%]',
          isUser ? 'flex flex-col items-end' : '',
        )}
      >
        <div
          className={cn(
            'rounded-[var(--radius)] px-4 py-3',
            isUser
              ? 'bg-[var(--surface)] border border-[var(--border)]'
              : 'bg-white',
          )}
        >
          {/* Thinking (collapsible) */}
          {message.thinking && (
            <details className="mb-2">
              <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)]">
                Thinking...
              </summary>
              <div className="mt-1 pl-3 border-l-2 border-[var(--border)] text-xs text-[var(--text-secondary)] italic">
                {message.thinking}
              </div>
            </details>
          )}

          {/* Content */}
          {message.content && (
            <MarkdownRenderer content={message.content} />
          )}

          {/* Tool Timeline */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <ToolTimeline toolCalls={message.toolCalls} />
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.attachments.map((att) => {
                const info = getFileReadyInfo(att.fileId);
                return (
                  <FileAttachment
                    key={att.fileId}
                    attachment={att}
                    downloadUrl={info?.downloadUrl}
                    size={info?.size}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[11px] text-[var(--text-muted)] mt-1 px-1">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

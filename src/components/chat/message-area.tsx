'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { MessageBubble } from './message-bubble';
import { TypingIndicator } from './typing-indicator';
import { MarkdownRenderer } from './markdown-renderer';
import { ToolTimeline } from './tool-timeline';
import { groupContentBlocks } from '@/lib/content-blocks';
import { MessageSquare, Bot, Loader2 } from 'lucide-react';

export function MessageArea() {
  const messages = useChatStore((s) => s.messages);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const isLoading = useChatStore((s) => s.isLoading);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage?.contentBlocks, streamingMessage?.toolCalls?.length]);

  if (messages.length === 0 && !streamingMessage) {
    return (
      <div className="flex-1 flex items-center justify-center overflow-y-auto">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--surface)] flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-[var(--text-muted)]" />
          </div>
          <p className="text-xl font-light text-[var(--foreground)] mb-1">JRAgentMesh</p>
          <p className="text-sm text-[var(--text-secondary)]">Start a conversation with the AI agent</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto py-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming message */}
        {streamingMessage && (
          <div className="flex gap-3 py-4 px-4 animate-in fade-in">
            <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="rounded-[var(--radius)] px-4 py-3 bg-white">
                {streamingMessage.thinking && (
                  <div className="mb-2 pl-3 border-l-2 border-[var(--primary-light)] text-xs text-[var(--text-secondary)] italic">
                    {streamingMessage.thinking}
                  </div>
                )}
                {streamingMessage.contentBlocks.length > 0 ? (
                  <>
                    {groupContentBlocks(streamingMessage.contentBlocks, streamingMessage.toolCalls)
                      .map((group, i) =>
                        group.type === 'text'
                          ? <MarkdownRenderer key={`text-${i}`} content={group.text} />
                          : <ToolTimeline key={`tools-${i}`} toolCalls={group.toolCalls} />
                      )}
                    <div className="flex items-center gap-2 pt-2">
                      <Loader2 className="w-3 h-3 text-[var(--primary)] animate-spin" />
                      <span className="text-xs text-[var(--text-muted)]">Generating...</span>
                    </div>
                  </>
                ) : (
                  <TypingIndicator />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading without streaming content */}
        {isLoading && !streamingMessage && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

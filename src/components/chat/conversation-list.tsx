'use client';

import { useChatStore } from '@/stores/chat-store';
import { useSelfAgent } from '@/hooks/use-self-agent';
import { cn, formatRelativeTime } from '@/lib/utils';
import { MessageSquare, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ConversationList() {
  const [collapsed, setCollapsed] = useState(false);
  const conversations = useChatStore((s) => s.conversations);
  const currentId = useChatStore((s) => s.currentConversationId);
  const { loadConversation, newConversation } = useSelfAgent();

  return (
    <div
      className={cn(
        'border-r border-[var(--border)] bg-[var(--surface)] flex flex-col transition-all duration-200',
        collapsed ? 'w-10' : 'w-64',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        {!collapsed && (
          <>
            <span className="text-xs font-medium text-[var(--text-secondary)]">Conversations</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={newConversation}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* List */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {conversations.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] text-center py-8">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-[var(--radius)] transition-colors duration-150',
                  conv.id === currentId
                    ? 'bg-[var(--accent)]'
                    : 'hover:bg-white',
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                  <span className="text-xs font-medium text-[var(--foreground)] truncate">
                    {conv.title || 'New Conversation'}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
                  {formatRelativeTime(conv.updatedAt)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

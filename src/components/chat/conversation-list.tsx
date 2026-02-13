'use client';

import { useChatStore } from '@/stores/chat-store';
import { useSelfAgent } from '@/hooks/use-self-agent';
import { cn, formatRelativeTime } from '@/lib/utils';
import { MessageSquare, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Check } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function ConversationList() {
  const [collapsed, setCollapsed] = useState(false);
  const conversations = useChatStore((s) => s.conversations);
  const currentId = useChatStore((s) => s.currentConversationId);
  const {
    loadConversation,
    newConversation,
    renameConversation,
    deleteConversation,
    deleteAllConversations,
  } = useSelfAgent();

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Confirmation dialogs
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  const startRename = useCallback((id: string, currentTitle: string | null) => {
    setRenamingId(id);
    setRenameValue(currentTitle || '');
  }, []);

  const confirmRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      renameConversation(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, renameConversation]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmRename();
      } else if (e.key === 'Escape') {
        cancelRename();
      }
    },
    [confirmRename, cancelRename],
  );

  const handleDelete = useCallback(() => {
    if (deleteTarget) {
      deleteConversation(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteConversation]);

  const handleClearAll = useCallback(() => {
    deleteAllConversations();
    setShowClearAll(false);
  }, [deleteAllConversations]);

  return (
    <>
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
              <div className="flex items-center gap-0.5">
                {conversations.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-[var(--text-muted)] hover:text-[var(--destructive)]"
                    onClick={() => setShowClearAll(true)}
                    title="Clear all conversations"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={newConversation}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
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
                <div
                  key={conv.id}
                  className={cn(
                    'group relative w-full text-left px-3 py-2 rounded-[var(--radius)] transition-colors duration-150 cursor-pointer',
                    conv.id === currentId
                      ? 'bg-[var(--accent)]'
                      : 'hover:bg-white',
                  )}
                  onClick={() => {
                    if (renamingId !== conv.id) {
                      loadConversation(conv.id);
                    }
                  }}
                >
                  {renamingId === conv.id ? (
                    /* Inline rename mode */
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={confirmRename}
                        className="h-6 text-xs px-1.5 py-0"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onMouseDown={(e) => { e.preventDefault(); confirmRename(); }}
                      >
                        <Check className="w-3 h-3 text-[var(--success)]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}
                      >
                        <X className="w-3 h-3 text-[var(--text-muted)]" />
                      </Button>
                    </div>
                  ) : (
                    /* Normal display mode */
                    <>
                      <div className="flex items-center gap-2 pr-10">
                        <MessageSquare className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                        <span className="text-xs font-medium text-[var(--foreground)] truncate">
                          {conv.title || 'New Conversation'}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
                        {formatRelativeTime(conv.updatedAt)}
                      </span>

                      {/* Hover action buttons */}
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                        <button
                          className="p-1 rounded hover:bg-[var(--accent)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(conv.id, conv.title);
                          }}
                          title="Rename"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-[var(--destructive)] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: conv.id, title: conv.title || 'New Conversation' });
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Delete single conversation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear all conversations dialog */}
      <Dialog open={showClearAll} onOpenChange={setShowClearAll}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Clear All Conversations</DialogTitle>
            <DialogDescription>
              This will permanently delete all {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} and their messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowClearAll(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearAll}>
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { AgentTypeId } from '@/lib/types';

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (options: {
    typeId: AgentTypeId;
    name?: string;
    workDir?: string;
    initialPrompt?: string;
  }) => void;
}

const AGENT_TYPES: { id: AgentTypeId; name: string; description: string }[] = [
  { id: 'claude-code', name: 'Claude Code', description: 'Anthropic Claude Code CLI agent' },
  { id: 'opencode', name: 'OpenCode', description: 'OpenCode CLI agent' },
  { id: 'codex', name: 'Codex', description: 'OpenAI Codex CLI agent' },
];

export function CreateAgentDialog({ open, onOpenChange, onCreate }: CreateAgentDialogProps) {
  const [typeId, setTypeId] = useState<AgentTypeId>('claude-code');
  const [name, setName] = useState('');
  const [workDir, setWorkDir] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');

  const handleCreate = () => {
    onCreate({
      typeId,
      name: name.trim() || undefined,
      workDir: workDir.trim() || undefined,
      initialPrompt: initialPrompt.trim() || undefined,
    });
    // Reset form
    setName('');
    setWorkDir('');
    setInitialPrompt('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>Launch a new backend AI agent</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Agent Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Agent Type</label>
            <Select value={typeId} onValueChange={(v) => setTypeId(v as AgentTypeId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div>
                      <div className="text-sm font-medium">{t.name}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Name <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Refactoring Agent"
            />
          </div>

          {/* Work Directory */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Work Directory <span className="text-[var(--text-muted)]">(optional, uses default if empty)</span>
            </label>
            <Input
              value={workDir}
              onChange={(e) => setWorkDir(e.target.value)}
              placeholder="/path/to/project"
              className="font-mono text-xs"
            />
          </div>

          {/* Initial Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Initial Prompt <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <Textarea
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              placeholder="e.g. Help me refactor the utils module"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create & Start</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

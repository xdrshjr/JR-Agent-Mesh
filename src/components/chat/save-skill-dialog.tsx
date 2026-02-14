'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSkillStore } from '@/stores/skill-store';

interface SaveSkillDialogProps {
  draft: { name: string; description: string; content: string };
  conversationId?: string;
  onClose: () => void;
}

export function SaveSkillDialog({ draft, conversationId, onClose }: SaveSkillDialogProps) {
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [content, setContent] = useState(draft.content);
  const [activateGlobally, setActivateGlobally] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const saveSkill = useSkillStore((s) => s.saveSkill);
  const setGlobalActivation = useSkillStore((s) => s.setGlobalActivation);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const skill = await saveSkill(name, description, content, conversationId);
      if (activateGlobally && skill.id) {
        await setGlobalActivation(skill.id, true);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save skill:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold">Save as Skill</h3>
          <button className="text-[var(--text-muted)] hover:text-[var(--foreground)]" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-xs" />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[300px] p-3 text-xs font-mono border border-[var(--border)] rounded-[var(--radius)] resize-y outline-none focus:border-[var(--primary)]"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activateGlobally}
              onChange={(e) => setActivateGlobally(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-[var(--text-secondary)]">Activate globally after saving</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border)]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            Save Skill
          </Button>
        </div>
      </div>
    </div>
  );
}

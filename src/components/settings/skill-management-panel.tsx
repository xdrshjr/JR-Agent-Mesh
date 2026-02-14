'use client';

import { useEffect, useState } from 'react';
import { Zap, Download, Trash2, Eye, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useSkillStore } from '@/stores/skill-store';
import type { SkillInfo } from '../../../shared/types';

function SkillContentDialog({
  skill,
  onClose,
}: {
  skill: SkillInfo;
  onClose: () => void;
}) {
  const [content, setContent] = useState('');
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const getSkillContent = useSkillStore((s) => s.getSkillContent);
  const saveSkillContent = useSkillStore((s) => s.saveSkillContent);

  useEffect(() => {
    getSkillContent(skill.id)
      .then(setContent)
      .catch(() => setContent('(Failed to load content)'))
      .finally(() => setIsLoading(false));
  }, [skill.id, getSkillContent]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSkillContent(skill.id, name, description, content);
      onClose();
    } catch (err) {
      console.error('Failed to save:', err);
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold">{skill.name}</h3>
          <button className="text-[var(--text-muted)] hover:text-[var(--foreground)]" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : (
            <>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-[300px] p-3 text-xs font-mono border border-[var(--border)] rounded-[var(--radius)] resize-y outline-none focus:border-[var(--primary)]"
              />
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Description</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border)]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  onView,
}: {
  skill: SkillInfo;
  onView: () => void;
}) {
  const setGlobalActivation = useSkillStore((s) => s.setGlobalActivation);
  const deleteSkill = useSkillStore((s) => s.deleteSkill);
  const updateSkillFromGit = useSkillStore((s) => s.updateSkillFromGit);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete skill "${skill.name}"?`)) return;
    try {
      await deleteSkill(skill.id);
    } catch {
      // error logged in store
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateSkillFromGit(skill.id);
    } catch {
      // error logged in store
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="border border-[var(--border)] rounded-[var(--radius)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-sm font-semibold truncate">{skill.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                skill.source === 'git'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-green-50 text-green-600'
              }`}
            >
              {skill.source}
            </span>
          </div>
          {skill.description && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{skill.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-[10px] text-[var(--text-secondary)]">Global</span>
            <Switch
              checked={skill.isGlobal}
              onCheckedChange={(checked) => setGlobalActivation(skill.id, checked)}
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-1 mt-3 justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onView}>
          <Eye className="w-3 h-3 mr-1" />
          View
        </Button>
        {skill.source === 'git' && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Update
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-[var(--text-secondary)] hover:text-[var(--error)]"
          onClick={handleDelete}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}

export function SkillManagementPanel() {
  const skills = useSkillStore((s) => s.skills);
  const isLoading = useSkillStore((s) => s.isLoading);
  const isInstalling = useSkillStore((s) => s.isInstalling);
  const fetchSkills = useSkillStore((s) => s.fetchSkills);
  const installSkill = useSkillStore((s) => s.installSkill);

  const [gitUrl, setGitUrl] = useState('');
  const [installError, setInstallError] = useState('');
  const [viewingSkill, setViewingSkill] = useState<SkillInfo | null>(null);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleInstall = async () => {
    if (!gitUrl.trim()) return;
    setInstallError('');
    try {
      await installSkill(gitUrl.trim());
      setGitUrl('');
    } catch (err: any) {
      setInstallError(err.message || 'Install failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Install Section */}
      <div className="border border-[var(--border)] rounded-[var(--radius)] p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Install from Git
        </h3>
        <div className="flex gap-2">
          <Input
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            placeholder="https://github.com/user/skill-repo.git"
            className="h-8 text-xs flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
          />
          <Button size="sm" className="h-8" onClick={handleInstall} disabled={isInstalling || !gitUrl.trim()}>
            {isInstalling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Installing...
              </>
            ) : (
              'Install'
            )}
          </Button>
        </div>
        {installError && <p className="text-xs text-[var(--error)] mt-2">{installError}</p>}
      </div>

      {/* Skill List */}
      <div>
        <h3 className="text-sm font-semibold mb-3">
          Installed Skills ({skills.length})
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : skills.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--text-muted)]">
            No skills installed yet. Install from a Git repository or save a skill from a conversation.
          </div>
        ) : (
          <div className="space-y-3">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onView={() => setViewingSkill(skill)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content Dialog */}
      {viewingSkill && (
        <SkillContentDialog
          skill={viewingSkill}
          onClose={() => setViewingSkill(null)}
        />
      )}
    </div>
  );
}

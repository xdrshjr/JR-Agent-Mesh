'use client';

import { useEffect, useState } from 'react';
import { Zap, X, Plus, Minus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSkillStore } from '@/stores/skill-store';
import { useChatStore } from '@/stores/chat-store';
import type { SkillInfo } from '../../../shared/types';
import { useRouter } from 'next/navigation';

export function SkillViewDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const skills = useSkillStore((s) => s.skills);
  const conversationSkills = useSkillStore((s) => s.conversationSkills);
  const fetchSkills = useSkillStore((s) => s.fetchSkills);
  const fetchConversationSkills = useSkillStore((s) => s.fetchConversationSkills);
  const activateForConversation = useSkillStore((s) => s.activateForConversation);
  const deactivateForConversation = useSkillStore((s) => s.deactivateForConversation);
  const currentConversationId = useChatStore((s) => s.currentConversationId);

  const [showAddList, setShowAddList] = useState(false);

  useEffect(() => {
    fetchSkills();
    if (currentConversationId) {
      fetchConversationSkills(currentConversationId);
    }
  }, [fetchSkills, fetchConversationSkills, currentConversationId]);

  const globalSkills = skills.filter((s) => s.isGlobal);
  const sessionSkillIds = currentConversationId
    ? conversationSkills[currentConversationId] || []
    : [];
  const sessionSkills = skills.filter((s) => sessionSkillIds.includes(s.id) && !s.isGlobal);

  // Available skills for adding (not global and not already session-activated)
  const activeIds = new Set([
    ...globalSkills.map((s) => s.id),
    ...sessionSkillIds,
  ]);
  const availableSkills = skills.filter((s) => !activeIds.has(s.id));

  const handleActivate = async (skill: SkillInfo) => {
    if (!currentConversationId) return;
    await activateForConversation(skill.id, currentConversationId);
    setShowAddList(false);
  };

  const handleDeactivate = async (skill: SkillInfo) => {
    if (!currentConversationId) return;
    await deactivateForConversation(skill.id, currentConversationId);
  };

  const totalActive = globalSkills.length + sessionSkills.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold">Active Skills ({totalActive})</h3>
          <button
            className="text-[var(--text-muted)] hover:text-[var(--foreground)] text-lg leading-none"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Global Skills */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              Global Skills
            </h4>
            {globalSkills.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-2">No global skills activated</p>
            ) : (
              <div className="space-y-1.5">
                {globalSkills.map((skill) => (
                  <SkillListItem key={skill.id} skill={skill} />
                ))}
              </div>
            )}
          </div>

          {/* Session Skills */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              Session Skills
            </h4>
            {sessionSkills.length === 0 && !showAddList ? (
              <p className="text-xs text-[var(--text-muted)] py-2">No session-specific skills activated</p>
            ) : (
              <div className="space-y-1.5">
                {sessionSkills.map((skill) => (
                  <div key={skill.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--background-secondary)]">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span className="text-xs font-medium">{skill.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleDeactivate(skill)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add skill dropdown */}
            {showAddList ? (
              <div className="mt-2 border border-[var(--border)] rounded-[var(--radius)] overflow-hidden">
                {availableSkills.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] p-3 text-center">No more skills available</p>
                ) : (
                  availableSkills.map((skill) => (
                    <button
                      key={skill.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--background-secondary)] text-left border-b border-[var(--border)] last:border-b-0"
                      onClick={() => handleActivate(skill)}
                    >
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span className="font-medium">{skill.name}</span>
                      <span className="text-[var(--text-muted)] ml-auto">
                        {skill.source}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {currentConversationId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs mt-2 w-full"
                onClick={() => setShowAddList(!showAddList)}
              >
                <Plus className="w-3 h-3 mr-1" />
                {showAddList ? 'Cancel' : 'Add skill to this session'}
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)]">
          <button
            className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
            onClick={() => {
              onClose();
              router.push('/settings?tab=skills');
            }}
          >
            <Settings className="w-3 h-3" />
            Manage all skills
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillListItem({ skill }: { skill: SkillInfo }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded">
      <Zap className="w-3 h-3 text-amber-500" />
      <span className="text-xs font-medium">{skill.name}</span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full ml-auto ${
          skill.source === 'git' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
        }`}
      >
        {skill.source}
      </span>
    </div>
  );
}

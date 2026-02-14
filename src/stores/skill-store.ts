import { create } from 'zustand';
import type { SkillInfo } from '../../shared/types';

interface SkillDraft {
  name: string;
  description: string;
  content: string;
}

interface SkillState {
  // Data
  skills: SkillInfo[];
  isLoading: boolean;
  isInstalling: boolean;
  isGenerating: boolean;

  // Session-level activations: conversationId → skillId[]
  conversationSkills: Record<string, string[]>;

  // Actions
  fetchSkills: () => Promise<void>;
  installSkill: (gitUrl: string) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  updateSkillFromGit: (id: string) => Promise<void>;
  setGlobalActivation: (id: string, active: boolean) => Promise<void>;
  getSkillContent: (id: string) => Promise<string>;
  saveSkillContent: (id: string, name: string, description: string, content: string) => Promise<void>;

  // Session-level activation
  fetchConversationSkills: (conversationId: string) => Promise<void>;
  activateForConversation: (skillId: string, conversationId: string) => Promise<void>;
  deactivateForConversation: (skillId: string, conversationId: string) => Promise<void>;

  // Save as skill
  generateSkillDraft: (conversationId: string) => Promise<SkillDraft>;
  saveSkill: (name: string, description: string, content: string, conversationId?: string) => Promise<SkillInfo>;
}

export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  isLoading: false,
  isInstalling: false,
  isGenerating: false,
  conversationSkills: {},

  fetchSkills: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/skills');
      if (!res.ok) throw new Error('Failed to fetch skills');
      const skills = await res.json();
      set({ skills });
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  installSkill: async (gitUrl: string) => {
    set({ isInstalling: true });
    try {
      const res = await fetch('/api/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gitUrl }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Install failed');
      }
      await get().fetchSkills();
    } finally {
      set({ isInstalling: false });
    }
  },

  deleteSkill: async (id: string) => {
    try {
      const res = await fetch(`/api/skills/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete skill');
      set((state) => ({ skills: state.skills.filter((s) => s.id !== id) }));
    } catch (err) {
      console.error('Failed to delete skill:', err);
      throw err;
    }
  },

  updateSkillFromGit: async (id: string) => {
    try {
      const res = await fetch(`/api/skills/${id}/update`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Update failed');
      }
      await get().fetchSkills();
    } catch (err) {
      console.error('Failed to update skill:', err);
      throw err;
    }
  },

  setGlobalActivation: async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/skills/${id}/global`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error('Failed to set activation');
      set((state) => ({
        skills: state.skills.map((s) =>
          s.id === id ? { ...s, isGlobal: active } : s
        ),
      }));
    } catch (err) {
      console.error('Failed to set global activation:', err);
      throw err;
    }
  },

  getSkillContent: async (id: string) => {
    const res = await fetch(`/api/skills/${id}/content`);
    if (!res.ok) throw new Error('Failed to get skill content');
    const data = await res.json();
    return data.content;
  },

  saveSkillContent: async (id: string, name: string, description: string, content: string) => {
    const res = await fetch(`/api/skills/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, content }),
    });
    if (!res.ok) throw new Error('Failed to save skill content');
    await get().fetchSkills();
  },

  fetchConversationSkills: async (conversationId: string) => {
    try {
      const res = await fetch(`/api/skills/active/${conversationId}`);
      if (!res.ok) return;
      const activeSkills: SkillInfo[] = await res.json();
      // Session-level only (exclude global)
      const sessionIds = activeSkills.filter((s) => !s.isGlobal).map((s) => s.id);
      set((state) => ({
        conversationSkills: { ...state.conversationSkills, [conversationId]: sessionIds },
      }));
    } catch (err) {
      console.error('Failed to fetch conversation skills:', err);
    }
  },

  activateForConversation: async (skillId: string, conversationId: string) => {
    try {
      const res = await fetch(`/api/skills/${skillId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) throw new Error('Failed to activate skill');
      set((state) => {
        const current = state.conversationSkills[conversationId] || [];
        return {
          conversationSkills: {
            ...state.conversationSkills,
            [conversationId]: [...current, skillId],
          },
        };
      });
    } catch (err) {
      console.error('Failed to activate skill:', err);
      throw err;
    }
  },

  deactivateForConversation: async (skillId: string, conversationId: string) => {
    try {
      const res = await fetch(`/api/skills/${skillId}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) throw new Error('Failed to deactivate skill');
      set((state) => {
        const current = state.conversationSkills[conversationId] || [];
        return {
          conversationSkills: {
            ...state.conversationSkills,
            [conversationId]: current.filter((id) => id !== skillId),
          },
        };
      });
    } catch (err) {
      console.error('Failed to deactivate skill:', err);
      throw err;
    }
  },

  generateSkillDraft: async (conversationId: string) => {
    set({ isGenerating: true });
    try {
      const res = await fetch('/api/skills/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate skill');
      }
      const data = await res.json();
      return data.draft as SkillDraft;
    } finally {
      set({ isGenerating: false });
    }
  },

  saveSkill: async (name: string, description: string, content: string, conversationId?: string) => {
    const res = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, content, conversationId }),
    });
    if (!res.ok) throw new Error('Failed to save skill');
    const skill = await res.json();
    await get().fetchSkills();
    return skill as SkillInfo;
  },
}));

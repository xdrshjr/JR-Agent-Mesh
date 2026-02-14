import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { SkillRepository } from '../db/repositories/index.js';
import type { SkillRow } from '../db/repositories/index.js';
import { logger } from '../utils/logger.js';

export interface SkillContent {
  id: string;
  name: string;
  content: string;
}

export interface CreateSkillParams {
  name: string;
  description?: string;
  source: 'git' | 'conversation';
  gitUrl?: string;
  gitDir?: string;
  filePath: string;
  content?: string;
  conversationId?: string;
  userId?: string;
  isGlobal?: boolean;
}

export interface UpdateSkillParams {
  name?: string;
  description?: string;
  content?: string;
}

export class SkillManagementService {
  private skillRepo: SkillRepository;
  private skillsDir: string;

  constructor(private dataDir: string) {
    this.skillRepo = new SkillRepository();
    this.skillsDir = join(dataDir, 'skills');
    this.ensureDirectories();
  }

  ensureDirectories(): void {
    mkdirSync(join(this.skillsDir, 'installed'), { recursive: true });
    mkdirSync(join(this.skillsDir, 'custom'), { recursive: true });
  }

  getSkillsDir(): string {
    return this.skillsDir;
  }

  // --- CRUD ---

  getAll(userId = 'default'): SkillRow[] {
    return this.skillRepo.getAll(userId);
  }

  getById(id: string): SkillRow | null {
    return this.skillRepo.getById(id);
  }

  create(params: CreateSkillParams): SkillRow {
    // If content is provided and source is 'conversation', write the file
    if (params.content && params.source === 'conversation') {
      const fullPath = join(this.skillsDir, params.filePath);
      mkdirSync(join(this.skillsDir, 'custom'), { recursive: true });
      writeFileSync(fullPath, params.content, 'utf-8');
    }

    return this.skillRepo.create({
      name: params.name,
      description: params.description,
      source: params.source,
      gitUrl: params.gitUrl,
      gitDir: params.gitDir,
      filePath: params.filePath,
      conversationId: params.conversationId,
      userId: params.userId,
      isGlobal: params.isGlobal,
    });
  }

  update(id: string, params: UpdateSkillParams): void {
    // Update metadata
    if (params.name !== undefined || params.description !== undefined) {
      this.skillRepo.update(id, {
        name: params.name,
        description: params.description,
      });
    }

    // Update file content
    if (params.content !== undefined) {
      const skill = this.skillRepo.getById(id);
      if (skill) {
        const fullPath = join(this.skillsDir, skill.filePath);
        writeFileSync(fullPath, params.content, 'utf-8');
      }
    }
  }

  delete(id: string): void {
    const skill = this.skillRepo.getById(id);
    if (!skill) return;

    if (skill.source === 'conversation') {
      // Delete the custom skill file
      const fullPath = join(this.skillsDir, skill.filePath);
      if (existsSync(fullPath)) {
        rmSync(fullPath);
      }
    } else if (skill.source === 'git' && skill.gitDir) {
      // Check if other skills share the same gitDir
      const siblings = this.skillRepo.getByGitDir(skill.gitDir);
      if (siblings.length <= 1) {
        // No other skills use this directory, delete it
        const dirPath = join(this.skillsDir, 'installed', skill.gitDir);
        if (existsSync(dirPath)) {
          rmSync(dirPath, { recursive: true, force: true });
        }
      }
    }

    this.skillRepo.delete(id);
  }

  // --- Activation ---

  setGlobalActivation(id: string, active: boolean): void {
    this.skillRepo.setGlobal(id, active);
  }

  activateForConversation(skillId: string, conversationId: string, userId = 'default'): void {
    this.skillRepo.activateForConversation(skillId, conversationId, userId);
  }

  deactivateForConversation(skillId: string, conversationId: string): void {
    this.skillRepo.deactivateForConversation(skillId, conversationId);
  }

  getConversationActivations(conversationId: string): SkillRow[] {
    return this.skillRepo.getConversationActivations(conversationId);
  }

  // --- Content ---

  getSkillContent(id: string): string | null {
    const skill = this.skillRepo.getById(id);
    if (!skill) return null;

    const fullPath = join(this.skillsDir, skill.filePath);
    if (!existsSync(fullPath)) {
      logger.warn('SkillManagement', `Skill file not found: ${fullPath}`);
      return null;
    }

    return readFileSync(fullPath, 'utf-8');
  }

  getActiveSkillContents(userId: string, conversationId: string): SkillContent[] {
    const activeSkills = this.skillRepo.getActiveForConversation(userId, conversationId);
    const contents: SkillContent[] = [];
    let totalChars = 0;
    const MAX_CHARS = 50000;

    for (const skill of activeSkills) {
      const fullPath = join(this.skillsDir, skill.filePath);
      if (!existsSync(fullPath)) {
        logger.warn('SkillManagement', `Skill file not found: ${fullPath} (skill: ${skill.name})`);
        continue;
      }

      const content = readFileSync(fullPath, 'utf-8');
      if (totalChars + content.length > MAX_CHARS) {
        logger.warn('SkillManagement', `Skill content truncated: ${skill.name} (total would exceed ${MAX_CHARS} chars)`);
        break;
      }

      totalChars += content.length;
      contents.push({ id: skill.id, name: skill.name, content });
    }

    return contents;
  }

  getActiveForConversation(userId: string, conversationId: string): SkillRow[] {
    return this.skillRepo.getActiveForConversation(userId, conversationId);
  }
}

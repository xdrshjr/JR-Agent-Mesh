import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index.js';
import * as schema from '../schema.js';

export interface SkillRow {
  id: string;
  name: string;
  description: string | null;
  source: string;
  gitUrl: string | null;
  gitDir: string | null;
  filePath: string;
  conversationId: string | null;
  userId: string;
  isGlobal: number;
  createdAt: number;
  updatedAt: number;
}

export class SkillRepository {
  create(skill: {
    name: string;
    description?: string;
    source: string;
    gitUrl?: string;
    gitDir?: string;
    filePath: string;
    conversationId?: string;
    userId?: string;
    isGlobal?: boolean;
  }): SkillRow {
    const db = getDb();
    const id = `skill-${uuidv4()}`;
    const now = Date.now();

    const row = {
      id,
      name: skill.name,
      description: skill.description ?? null,
      source: skill.source,
      gitUrl: skill.gitUrl ?? null,
      gitDir: skill.gitDir ?? null,
      filePath: skill.filePath,
      conversationId: skill.conversationId ?? null,
      userId: skill.userId ?? 'default',
      isGlobal: skill.isGlobal ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.skills).values(row).run();
    return row as SkillRow;
  }

  getById(id: string): SkillRow | null {
    const db = getDb();
    const row = db.select().from(schema.skills)
      .where(eq(schema.skills.id, id))
      .get();
    return (row as SkillRow) ?? null;
  }

  getAll(userId = 'default'): SkillRow[] {
    const db = getDb();
    return db.select().from(schema.skills)
      .where(eq(schema.skills.userId, userId))
      .all() as SkillRow[];
  }

  getBySource(userId: string, source: string): SkillRow[] {
    const db = getDb();
    return db.select().from(schema.skills)
      .where(and(eq(schema.skills.userId, userId), eq(schema.skills.source, source)))
      .all() as SkillRow[];
  }

  update(id: string, fields: { name?: string; description?: string }): void {
    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.name !== undefined) updates.name = fields.name;
    if (fields.description !== undefined) updates.description = fields.description;

    db.update(schema.skills)
      .set(updates)
      .where(eq(schema.skills.id, id))
      .run();
  }

  delete(id: string): void {
    const db = getDb();
    // Activations cascade-delete via FK
    db.delete(schema.skills)
      .where(eq(schema.skills.id, id))
      .run();
  }

  setGlobal(id: string, isGlobal: boolean): void {
    const db = getDb();
    db.update(schema.skills)
      .set({ isGlobal: isGlobal ? 1 : 0, updatedAt: Date.now() })
      .where(eq(schema.skills.id, id))
      .run();
  }

  getActiveForConversation(userId: string, conversationId: string): SkillRow[] {
    const db = getDb();

    // Global skills
    const globalSkills = db.select().from(schema.skills)
      .where(and(eq(schema.skills.userId, userId), eq(schema.skills.isGlobal, 1)))
      .all() as SkillRow[];

    // Session-level activated skills
    const sessionSkills = db.select({ skill: schema.skills })
      .from(schema.skillActivations)
      .innerJoin(schema.skills, eq(schema.skillActivations.skillId, schema.skills.id))
      .where(and(
        eq(schema.skillActivations.conversationId, conversationId),
        eq(schema.skillActivations.userId, userId),
      ))
      .all()
      .map((r) => r.skill as SkillRow);

    // Deduplicate by id
    const seen = new Set(globalSkills.map((s) => s.id));
    const combined = [...globalSkills];
    for (const s of sessionSkills) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        combined.push(s);
      }
    }
    return combined;
  }

  activateForConversation(skillId: string, conversationId: string, userId = 'default'): void {
    const db = getDb();
    const id = `sa-${uuidv4()}`;
    db.insert(schema.skillActivations).values({
      id,
      skillId,
      conversationId,
      userId,
      createdAt: Date.now(),
    }).onConflictDoNothing().run();
  }

  deactivateForConversation(skillId: string, conversationId: string): void {
    const db = getDb();
    db.delete(schema.skillActivations)
      .where(and(
        eq(schema.skillActivations.skillId, skillId),
        eq(schema.skillActivations.conversationId, conversationId),
      ))
      .run();
  }

  getConversationActivations(conversationId: string): SkillRow[] {
    const db = getDb();
    return db.select({ skill: schema.skills })
      .from(schema.skillActivations)
      .innerJoin(schema.skills, eq(schema.skillActivations.skillId, schema.skills.id))
      .where(eq(schema.skillActivations.conversationId, conversationId))
      .all()
      .map((r) => r.skill as SkillRow);
  }

  getByGitDir(gitDir: string): SkillRow[] {
    const db = getDb();
    return db.select().from(schema.skills)
      .where(eq(schema.skills.gitDir, gitDir))
      .all() as SkillRow[];
  }
}

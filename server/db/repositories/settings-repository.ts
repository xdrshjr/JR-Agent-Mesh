import { eq, like } from 'drizzle-orm';
import { getDb } from '../index.js';
import * as schema from '../schema.js';

export class SettingsRepository {
  get(key: string): string | null {
    const db = getDb();
    const row = db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key))
      .get();

    return row?.value ?? null;
  }

  set(key: string, value: string) {
    const db = getDb();
    const now = Date.now();

    db.insert(schema.settings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value, updatedAt: now },
      })
      .run();
  }

  getAll(): Map<string, string> {
    const db = getDb();
    const rows = db.select().from(schema.settings).all();
    return new Map(rows.map((r) => [r.key, r.value]));
  }

  getByPrefix(prefix: string): Map<string, string> {
    const db = getDb();
    const rows = db
      .select()
      .from(schema.settings)
      .where(like(schema.settings.key, `${prefix}%`))
      .all();

    return new Map(rows.map((r) => [r.key, r.value]));
  }
}

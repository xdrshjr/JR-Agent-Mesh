import { eq, sql } from 'drizzle-orm';
import { getDb } from '../index.js';
import * as schema from '../schema.js';
import { encrypt, decrypt } from '../../utils/crypto.js';

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not set');
  }
  return key;
}

export interface CredentialInfo {
  key: string;
  displayName: string;
  provider: string | null;
  hasValue: boolean;
  updatedAt: number;
}

export class CredentialRepository {
  /**
   * List all credentials with masked values.
   */
  list(): CredentialInfo[] {
    const db = getDb();
    const rows = db.select().from(schema.credentials).all();

    return rows.map((row) => ({
      key: row.key,
      displayName: row.displayName,
      provider: row.provider,
      hasValue: !!row.encryptedValue,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * Get decrypted credential value.
   */
  get(key: string): string | null {
    const db = getDb();
    const row = db
      .select()
      .from(schema.credentials)
      .where(eq(schema.credentials.key, key))
      .get();

    if (!row || !row.encryptedValue) return null;

    try {
      return decrypt(
        {
          encrypted: row.encryptedValue,
          iv: row.iv,
          authTag: row.authTag,
        },
        getEncryptionKey(),
      );
    } catch {
      return null;
    }
  }

  /**
   * Set (encrypt and store) a credential.
   */
  set(key: string, displayName: string, value: string, provider?: string) {
    const db = getDb();
    const now = Date.now();
    const encryptionKey = getEncryptionKey();
    const encrypted = encrypt(value, encryptionKey);

    db.insert(schema.credentials)
      .values({
        key,
        displayName,
        encryptedValue: encrypted.encrypted,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        provider: provider ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.credentials.key,
        set: {
          displayName,
          encryptedValue: encrypted.encrypted,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          provider: provider ?? sql`provider`,
          updatedAt: now,
        },
      })
      .run();
  }

  /**
   * Delete a credential.
   */
  delete(key: string) {
    const db = getDb();
    db.delete(schema.credentials)
      .where(eq(schema.credentials.key, key))
      .run();
  }
}

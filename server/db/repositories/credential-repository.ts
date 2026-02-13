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
  maskedValue: string | null;
  updatedAt: number;
}

/**
 * Mask a credential value for display.
 * Keeps prefix (up to first dash + 5 chars, max 8) + "•••••" + last 3 chars.
 * Per spec: prefix = value.substring(0, min(indexOf("-") + 5, 8))
 * When no dash: indexOf("-") = -1, so -1 + 5 = 4 chars prefix.
 */
export function maskCredentialValue(value: string): string {
  if (value.length <= 8) {
    return '••••••••';
  }
  const dashIndex = value.indexOf('-');
  const prefixEnd = Math.min(dashIndex + 5, 8);
  // Ensure at least 1 char prefix
  const safeEnd = Math.max(prefixEnd, 1);
  const prefix = value.substring(0, safeEnd);
  const suffix = value.substring(value.length - 3);
  return `${prefix}•••••${suffix}`;
}

export class CredentialRepository {
  /**
   * List all credentials with masked values.
   */
  list(): CredentialInfo[] {
    const db = getDb();
    const rows = db.select().from(schema.credentials).all();

    return rows.map((row) => {
      let maskedValue: string | null = null;
      if (row.encryptedValue) {
        try {
          const plaintext = decrypt(
            { encrypted: row.encryptedValue, iv: row.iv, authTag: row.authTag },
            getEncryptionKey(),
          );
          maskedValue = maskCredentialValue(plaintext);
        } catch {
          maskedValue = '••••••••';
        }
      }

      return {
        key: row.key,
        displayName: row.displayName,
        provider: row.provider,
        hasValue: !!row.encryptedValue,
        maskedValue,
        updatedAt: row.updatedAt,
      };
    });
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

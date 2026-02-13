import { encrypt, decrypt, type EncryptedData } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

export class CredentialStore {
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
    logger.info('CredentialStore', 'Initialized');
  }

  encrypt(value: string): EncryptedData {
    return encrypt(value, this.encryptionKey);
  }

  decrypt(data: EncryptedData): string {
    return decrypt(data, this.encryptionKey);
  }
}

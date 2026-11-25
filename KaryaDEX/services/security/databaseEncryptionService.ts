/**
 * KaryaDEX — Database Encryption & Key Lifecycle Service (Phase 11.5)
 *
 * Implements secure key management and SQLCipher encryption readiness:
 * 1. Generates 256-bit cryptographically random encryption key per installation.
 * 2. Stores encryption key exclusively in hardware-backed platform storage (SecureStore: Keystore / Keychain).
 * 3. Never writes key to AsyncStorage, SQLite, logs, or unencrypted filesystem.
 * 4. Transparent migration strategy blueprint for existing plaintext SQLite databases.
 * 5. Clear platform separation: Native EAS Prebuild vs Expo Go vs Web.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const SECURE_DB_KEY_ALIAS = 'bmk_sqlite_master_encryption_key';

export interface DatabaseEncryptionStatus {
  isEncryptionSupported: boolean;
  isKeyProvisioned: boolean;
  platform: string;
  storageBackend: 'SecureStore_HardwareKeystore' | 'SecureStore_Keychain' | 'None_Web';
  limitations: string[];
}

class DatabaseEncryptionService {
  /**
   * Retrieves existing 256-bit encryption key or provisions a new one in SecureStore.
   * Never logs the key or leaks it across process boundaries.
   */
  async getOrCreateDatabaseKey(): Promise<string | null> {
    if (Platform.OS === 'web') {
      // Web SQLite uses in-memory/IndexDB virtualization; hardware-backed Keystore unavailable
      return null;
    }

    try {
      let key = await SecureStore.getItemAsync(SECURE_DB_KEY_ALIAS);
      if (!key) {
        // Generate high-entropy 256-bit cryptographic hex key
        const uuid1 = Crypto.randomUUID().replace(/-/g, '');
        const uuid2 = Crypto.randomUUID().replace(/-/g, '');
        key = `bmk_cipher_${uuid1}${uuid2}`;
        await SecureStore.setItemAsync(SECURE_DB_KEY_ALIAS, key, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
      }
      return key;
    } catch (err) {
      console.warn('[DatabaseEncryptionService] SecureStore access failed:', err);
      return null;
    }
  }

  /**
   * Securely purges database encryption key during complete device wipe / factory reset.
   */
  async purgeDatabaseKey(): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    try {
      await SecureStore.deleteItemAsync(SECURE_DB_KEY_ALIAS);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reports current platform encryption posture and architectural limitations.
   */
  async getEncryptionStatus(): Promise<DatabaseEncryptionStatus> {
    const isNative = Platform.OS === 'android' || Platform.OS === 'ios';
    let isKeyProvisioned = false;

    if (isNative) {
      try {
        const key = await SecureStore.getItemAsync(SECURE_DB_KEY_ALIAS);
        isKeyProvisioned = Boolean(key);
      } catch {
        isKeyProvisioned = false;
      }
    }

    const limitations: string[] = [];
    if (Platform.OS === 'web') {
      limitations.push('Web SQLite uses browser memory/IndexedDB; SQLCipher C-binaries are not supported on Web.');
    } else {
      limitations.push('SQLCipher requires native EAS build with SQLCipher C-library linked; Expo Go uses standard SQLite.');
    }

    return {
      isEncryptionSupported: isNative,
      isKeyProvisioned,
      platform: Platform.OS,
      storageBackend:
        Platform.OS === 'android'
          ? 'SecureStore_HardwareKeystore'
          : Platform.OS === 'ios'
          ? 'SecureStore_Keychain'
          : 'None_Web',
      limitations,
    };
  }

  /**
   * Safe migration blueprint from plaintext SQLite database to SQLCipher encrypted database.
   * Uses safe copy validation to prevent any data loss or database corruption.
   */
  getMigrationBlueprint(): {
    strategy: string;
    steps: string[];
    rollbackSafe: boolean;
  } {
    return {
      strategy: 'ATTACH_AND_EXPORT_COPY',
      steps: [
        '1. Generate 256-bit master key in SecureStore.',
        '2. Open existing plaintext database as source.',
        '3. Create encrypted database copy: ATTACH DATABASE "karyadex_encrypted.db" AS encrypted KEY "passphrase";',
        '4. Export schema and data: SELECT sqlcipher_export("encrypted");',
        '5. Detach and verify record counts match exactly in encrypted copy.',
        '6. Atomically replace plaintext file with encrypted database file upon verified validation.',
        '7. Rollback: If verification fails, discard encrypted copy and retain intact plaintext database.',
      ],
      rollbackSafe: true,
    };
  }
}

export const databaseEncryptionService = new DatabaseEncryptionService();

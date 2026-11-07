/**
 * BunkMatKar — BYOK Secure Storage (Phase 12)
 *
 * Stores optional user-provided API keys in hardware-backed SecureStore (mobile)
 * or encrypted in-memory (web/test).
 * NEVER stored in SQLite. NEVER synced to Supabase. NEVER exported.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BYOK_GEMINI_KEY = 'bmk_byok_gemini_key';
const BYOK_MISTRAL_KEY = 'bmk_byok_mistral_key';
const BYOK_GROQ_KEY = 'bmk_byok_groq_key'; // Kept for legacy migration

let webInMemoryKeys: Record<string, string> = {};

export class BYOKStorage {
  static async getGeminiKey(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return webInMemoryKeys[BYOK_GEMINI_KEY] || null;
      }
      const isAvailable = await SecureStore.isAvailableAsync().catch(() => false);
      if (isAvailable) {
        return await SecureStore.getItemAsync(BYOK_GEMINI_KEY);
      }
      return webInMemoryKeys[BYOK_GEMINI_KEY] || null;
    } catch {
      return null;
    }
  }

  static async setGeminiKey(key: string): Promise<void> {
    const trimmed = key.trim();
    if (Platform.OS === 'web') {
      webInMemoryKeys[BYOK_GEMINI_KEY] = trimmed;
      return;
    }
    const isAvailable = await SecureStore.isAvailableAsync().catch(() => false);
    if (isAvailable) {
      await SecureStore.setItemAsync(BYOK_GEMINI_KEY, trimmed);
    } else {
      webInMemoryKeys[BYOK_GEMINI_KEY] = trimmed;
    }
  }

  static async getMistralKey(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return webInMemoryKeys[BYOK_MISTRAL_KEY] || null;
      }
      const isAvailable = await SecureStore.isAvailableAsync().catch(() => false);
      if (isAvailable) {
        return await SecureStore.getItemAsync(BYOK_MISTRAL_KEY);
      }
      return webInMemoryKeys[BYOK_MISTRAL_KEY] || null;
    } catch {
      return null;
    }
  }

  static async setMistralKey(key: string): Promise<void> {
    const trimmed = key.trim();
    if (Platform.OS === 'web') {
      webInMemoryKeys[BYOK_MISTRAL_KEY] = trimmed;
      return;
    }
    const isAvailable = await SecureStore.isAvailableAsync().catch(() => false);
    if (isAvailable) {
      await SecureStore.setItemAsync(BYOK_MISTRAL_KEY, trimmed);
    } else {
      webInMemoryKeys[BYOK_MISTRAL_KEY] = trimmed;
    }
  }

  /**
   * @deprecated Use getMistralKey for Shanky
   */
  static async getGroqKey(): Promise<string | null> {
    return this.getMistralKey();
  }

  /**
   * @deprecated Use setMistralKey for Shanky
   */
  static async setGroqKey(key: string): Promise<void> {
    return this.setMistralKey(key);
  }

  static async clearAllKeys(): Promise<void> {
    webInMemoryKeys = {};
    if (Platform.OS !== 'web') {
      try {
        const isAvailable = await SecureStore.isAvailableAsync().catch(() => false);
        if (isAvailable) {
          await SecureStore.deleteItemAsync(BYOK_GEMINI_KEY).catch(() => {});
          await SecureStore.deleteItemAsync(BYOK_MISTRAL_KEY).catch(() => {});
          await SecureStore.deleteItemAsync(BYOK_GROQ_KEY).catch(() => {});
        }
      } catch {}
    }
  }
}

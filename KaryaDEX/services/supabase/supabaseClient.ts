// services/supabase/supabaseClient.ts
/**
 * Single Reusable Supabase Client (Phase 10.5)
 * Official Expo/React Native integration with cross-platform session persistence.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getSupabaseConfig } from './supabaseConfig';

const inMemoryStorage = new Map<string, string>();

function sanitizeSecureKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Hardened cross-platform storage adapter:
 * - Native (Android/iOS): Hardware-backed encrypted Expo SecureStore (Android Keystore / iOS Keychain)
 * - Web: Browser localStorage
 * - Node/Jest & Memory Fallback: in-memory store
 */
export const supabaseStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }

      const isSecureAvailable = await SecureStore.isAvailableAsync().catch(() => false);
      if (isSecureAvailable) {
        const safeKey = sanitizeSecureKey(key);
        const secureVal = await SecureStore.getItemAsync(safeKey);
        if (secureVal !== null) {
          return secureVal;
        }
      }

      const val = await AsyncStorage.getItem(key);
      return val ?? inMemoryStorage.get(key) ?? null;
    } catch {
      return inMemoryStorage.get(key) ?? null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    inMemoryStorage.set(key, value);
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }

      const isSecureAvailable = await SecureStore.isAvailableAsync().catch(() => false);
      if (isSecureAvailable && value.length < 2048) {
        const safeKey = sanitizeSecureKey(key);
        await SecureStore.setItemAsync(safeKey, value);
        await AsyncStorage.removeItem(key).catch(() => {});
        return;
      }

      await AsyncStorage.setItem(key, value);
    } catch {
      // In-memory fallback retained
    }
  },
  removeItem: async (key: string): Promise<void> => {
    inMemoryStorage.delete(key);
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }

      const isSecureAvailable = await SecureStore.isAvailableAsync().catch(() => false);
      if (isSecureAvailable) {
        const safeKey = sanitizeSecureKey(key);
        await SecureStore.deleteItemAsync(safeKey).catch(() => {});
      }

      await AsyncStorage.removeItem(key);
    } catch {
      // In-memory fallback retained
    }
  },
};

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (clientInstance) {
    return clientInstance;
  }

  const { supabaseUrl, supabaseAnonKey, isConfigured } = getSupabaseConfig();

  // If not configured, use safe fallback to avoid crashing at import
  const validUrl = isConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
  const validKey = isConfigured ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

  clientInstance = createClient(validUrl, validKey, {
    auth: {
      storage: supabaseStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });

  return clientInstance;
}

/**
 * Reset client instance for isolated test scenarios
 */
export function resetSupabaseClientForTesting(customClient?: SupabaseClient): void {
  clientInstance = customClient || null;
  inMemoryStorage.clear();
}

export const supabase = getSupabaseClient();

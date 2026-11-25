/**
 * KaryaDEX — Platform Database Loader (Web & Test Fallback)
 *
 * This file is resolved by Metro on Web and by Node/Jest in test environments.
 * It prevents Metro from statically analyzing and bundling `expo-sqlite` on Web,
 * avoiding the known SDK 57 Web Worker chunk serialization failure.
 */

import type { DatabaseConnection } from '../types';

export async function openNativeDatabase(): Promise<DatabaseConnection | null> {
  return null;
}

// services/supabase/supabaseConfig.ts
/**
 * Supabase Environment Configuration & Validation (Phase 10.5)
 * Safely resolves Expo environment variables without hardcoded secrets.
 * Extended with Cloudflare Worker AI Gateway config.
 */

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
}

export interface CloudflareConfig {
  workerUrl: string;
  isConfigured: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  let url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  // Strip any accidental trailing /rest/v1/ or trailing slashes
  url = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

  const anonKey = (
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const isConfigured = Boolean(
    url &&
    anonKey &&
    url.startsWith('https://') &&
    !url.includes('your-project-id') &&
    !url.includes('placeholder')
  );

  return {
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
    isConfigured,
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

export function getCloudflareConfig(): CloudflareConfig {
  const workerUrl = (process.env.EXPO_PUBLIC_CLOUDFLARE_WORKER_URL || '').trim();
  const isConfigured = Boolean(
    workerUrl &&
    workerUrl.startsWith('https://') &&
    !workerUrl.includes('your-worker') &&
    !workerUrl.includes('placeholder')
  );

  return {
    workerUrl,
    isConfigured,
  };
}

export function isCloudflareConfigured(): boolean {
  return getCloudflareConfig().isConfigured;
}

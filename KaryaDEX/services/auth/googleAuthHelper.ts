/**
 * BunkMatKar — Google Identity Services (GIS) & ID Token Authentication Helper
 *
 * Implements Option 2: Direct Google Identity Services with Cryptographic Nonce
 * Enables authentication directly against Google Web Client ID (displaying "BunkMatKar")
 * and exchanges the verified Google ID token with Supabase via `supabase.auth.signInWithIdToken`.
 */

import { Platform } from 'react-native';

export const GOOGLE_GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
export const GOOGLE_GSI_SCRIPT_ID = 'google-gsi-client';

export interface NoncePair {
  rawNonce: string;
  hashedNonce: string;
}

export interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
  clientId?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void | Promise<void>;
            nonce?: string;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            context?: 'signin' | 'signup' | 'use';
            itp_support?: boolean;
            ux_mode?: 'popup' | 'redirect';
          }) => void;
          prompt: (listener?: (notification: any) => void) => void;
          renderButton: (parent: HTMLElement, options: Record<string, any>) => void;
          cancel: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

/**
 * Generate a cryptographically random raw nonce string.
 */
export function generateRawNonce(length = 32): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
  }

  // Fallback for non-WebCrypto environments
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Compute SHA-256 hexadecimal digest of raw nonce string.
 * Supports Web Crypto API (`crypto.subtle`), `expo-crypto`, and Node.js `crypto`.
 */
export async function hashNonceSHA256(rawNonce: string): Promise<string> {
  // 1. Web standard Crypto API
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawNonce);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // 2. expo-crypto (native & react-native environments)
  try {
    const Crypto = require('expo-crypto');
    if (Crypto?.digestStringAsync) {
      return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    }
  } catch {}

  // 3. Node.js crypto (for Jest & test environments)
  try {
    const nodeCrypto = require('crypto');
    if (nodeCrypto?.createHash) {
      return nodeCrypto.createHash('sha256').update(rawNonce).digest('hex');
    }
  } catch {}

  // 4. @noble/hashes fallback
  try {
    const { sha256 } = require('@noble/hashes/sha256');
    const { bytesToHex } = require('@noble/hashes/utils');
    const encoder = new TextEncoder();
    return bytesToHex(sha256(encoder.encode(rawNonce)));
  } catch {}

  throw new Error('No cryptographic hashing provider available for SHA-256');
}

/**
 * Generate a fresh pair of raw and hashed nonces for Google Identity Services.
 */
export async function generateNoncePair(): Promise<NoncePair> {
  const rawNonce = generateRawNonce(32);
  const hashedNonce = await hashNonceSHA256(rawNonce);
  return { rawNonce, hashedNonce };
}

export const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '240868567707-39foq7bmpptai0707ml5sadrv4pb44d6.apps.googleusercontent.com';

/**
 * Retrieve the Google Web Client ID from environment variables with project fallback.
 */
export function getGoogleWebClientId(): string {
  let extraClientId: string | undefined;
  try {
    const Constants = require('expo-constants');
    extraClientId =
      Constants?.default?.expoConfig?.extra?.googleWebClientId ||
      Constants?.expoConfig?.extra?.googleWebClientId;
  } catch {}

  const envId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    extraClientId;

  if (envId && envId.trim().length > 0) {
    return envId.trim();
  }

  // In test environments where env variable is intentionally unset, return empty string
  if (process.env.NODE_ENV === 'test' && !envId) {
    return '';
  }

  return DEFAULT_GOOGLE_WEB_CLIENT_ID;
}

/**
 * Check if the official Google Identity Services SDK script is already loaded.
 */
export function isGoogleIdentityLoaded(): boolean {
  return typeof window !== 'undefined' && Boolean(window.google?.accounts?.id);
}

/**
 * Dynamically load the Google Identity Services SDK script on Web.
 */
export function loadGoogleIdentityScript(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  if (isGoogleIdentityLoaded()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const existing = document.getElementById(GOOGLE_GSI_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (isGoogleIdentityLoaded()) {
        return resolve(true);
      }
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_GSI_SCRIPT_ID;
    script.src = GOOGLE_GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('[GoogleAuth] Failed to load Google Identity Services SDK.');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * Initialize Google Identity Services with Client ID, hashed nonce, and credential callback.
 */
export function initializeGoogleIdentity(config: {
  clientId: string;
  hashedNonce: string;
  callback: (response: GoogleCredentialResponse) => void | Promise<void>;
  autoSelect?: boolean;
}): boolean {
  if (!isGoogleIdentityLoaded() || typeof window === 'undefined') {
    return false;
  }

  try {
    window.google!.accounts!.id!.initialize({
      client_id: config.clientId,
      nonce: config.hashedNonce,
      callback: config.callback,
      auto_select: config.autoSelect ?? false,
      cancel_on_tap_outside: true,
      ux_mode: 'popup',
    });
    return true;
  } catch (err) {
    console.warn('[GoogleAuth] Failed to initialize Google Identity Services:', err);
    return false;
  }
}

/**
 * Render standard Google Sign-In button into a DOM container element.
 */
export function renderGoogleButton(
  container: HTMLElement | string,
  options?: Record<string, any>
): boolean {
  if (!isGoogleIdentityLoaded() || typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const findAndRender = (retryCount = 0): boolean => {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) {
      if (retryCount < 5) {
        setTimeout(() => findAndRender(retryCount + 1), 100);
      }
      return false;
    }

    try {
      window.google!.accounts!.id!.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 340,
        ...options,
      });
      return true;
    } catch (err) {
      console.warn('[GoogleAuth] Failed to render Google button:', err);
      return false;
    }
  };

  return findAndRender(0);
}

/**
 * Trigger Google One Tap prompt.
 */
export function promptGoogleOneTap(listener?: (notification: any) => void): boolean {
  if (!isGoogleIdentityLoaded() || typeof window === 'undefined') {
    return false;
  }

  try {
    window.google!.accounts!.id!.prompt(listener);
    return true;
  } catch (err) {
    console.warn('[GoogleAuth] Failed to prompt Google One Tap:', err);
    return false;
  }
}

/**
 * Cancel any pending Google One Tap prompt.
 */
export function cancelGooglePrompt(): void {
  if (isGoogleIdentityLoaded() && typeof window !== 'undefined') {
    try {
      window.google!.accounts!.id!.cancel();
    } catch {}
  }
}

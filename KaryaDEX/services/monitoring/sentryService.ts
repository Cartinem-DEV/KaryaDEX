// services/monitoring/sentryService.ts
// Sentry initialization and error capture utilities for KaryaDEX

import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

let isInitialized = false;

/**
 * Sanitize Sentry event to remove sensitive data before sending
 */
function sanitizeEvent(event: any, hint: any): any | null {
  // Don't send events in development
  if (__DEV__) {
    return null;
  }

  try {
    // Clone the event to avoid mutating the original
    const sanitized = { ...event };

    // Sanitize exception values
    if (sanitized.exception?.values) {
      sanitized.exception.values = sanitized.exception.values.map((exception: any) => {
        const sanitizedException = { ...exception };

        // Remove sensitive data from exception value/message
        if (sanitizedException.value) {
          sanitizedException.value = sanitizeString(sanitizedException.value);
        }

        // Sanitize stacktrace frames
        if (sanitizedException.stacktrace?.frames) {
          sanitizedException.stacktrace.frames = sanitizedException.stacktrace.frames.map((frame: any) => {
            const sanitizedFrame = { ...frame };

            // Remove sensitive data from frame context
            if (sanitizedFrame.vars) {
              sanitizedFrame.vars = sanitizeVars(sanitizedFrame.vars);
            }

            return sanitizedFrame;
          });
        }

        return sanitizedException;
      });
    }

    // Sanitize breadcrumbs
    if (sanitized.breadcrumbs && Array.isArray(sanitized.breadcrumbs)) {
      sanitized.breadcrumbs = sanitized.breadcrumbs
        .map((breadcrumb: any) => {
          const sanitizedBreadcrumb = { ...breadcrumb };
          if (sanitizedBreadcrumb.data) {
            sanitizedBreadcrumb.data = sanitizeVars(sanitizedBreadcrumb.data);
          }
          // Remove sensitive breadcrumb categories
          if (sanitizedBreadcrumb.category?.includes('auth') ||
              sanitizedBreadcrumb.category?.includes('token')) {
            return null;
          }
          return sanitizedBreadcrumb;
        })
        .filter(Boolean);
    }

    // Sanitize user context (keep only id, not email/username unless explicitly set)
    if (sanitized.user) {
      sanitized.user = {
        id: sanitized.user.id,
        // email and username only if explicitly set via setUserContext
        ...(sanitized.user.email ? { email: sanitized.user.email } : {}),
        ...(sanitized.user.username ? { username: sanitized.user.username } : {}),
      };
    }

    // Sanitize contexts
    if (sanitized.contexts) {
      const sanitizedContexts: Record<string, any> = {};
      for (const [key, value] of Object.entries(sanitized.contexts)) {
        if (value && typeof value === 'object') {
          sanitizedContexts[key] = sanitizeVars(value);
        } else {
          sanitizedContexts[key] = value;
        }
      }
      sanitized.contexts = sanitizedContexts;
    }

    return sanitized;
  } catch (err) {
    console.warn('[Sentry] Failed to sanitize event:', err);
    // If sanitization fails, send the original event (better than dropping)
    return event;
  }
}

/**
 * Sanitize a string to remove sensitive patterns
 */
function sanitizeString(str: string): string {
  return str
    // Remove JWT tokens (Bearer or bare)
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT_REDACTED]')
    // Remove API keys (common patterns)
    .replace(/(api[_-]?key|apikey|secret[_-]?key|access[_-]?token)[\s:=]+[a-zA-Z0-9_-]{20,}/gi, '$1=[REDACTED]')
    // Remove Bearer tokens
    .replace(/Bearer\s+[a-zA-Z0-9_-]{20,}/gi, 'Bearer [REDACTED]')
    // Remove potential passwords in URLs
    .replace(/(password|passwd|pwd)[\s:=]+[^\s&]+/gi, '$1=[REDACTED]')
    // Remove email addresses from error messages (unless we want them)
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
}

/**
 * Sanitize variables object to remove sensitive keys
 */
function sanitizeVars(vars: Record<string, any>): Record<string, any> {
  const sensitiveKeys = [
    'password', 'passwd', 'pwd', 'secret', 'token', 'apikey', 'api_key',
    'access_token', 'refresh_token', 'id_token', 'authorization',
    'jwt', 'bearer', 'credential', 'private_key', 'privatekey',
    'email', 'phone', 'address', 'ssn', 'credit_card', 'creditcard',
  ];

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(vars)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeVars(value);
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Initialize Sentry with KaryaDEX configuration
 */
export function initSentry(): void {
  if (isInitialized) {
    console.log('[Sentry] Already initialized');
    return;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const environment = process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'development' : 'production');

  if (!dsn) {
    console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN not set. Sentry disabled.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      debug: __DEV__,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,

      // React Native specific
      enableNativeCrashHandling: true,
      enableNativeNagger: true,
      enableNdk: true,

      // Performance monitoring
      tracesSampleRate: __DEV__ ? 1.0 : 0.1,
      profilesSampleRate: __DEV__ ? 1.0 : 0.1,

      // Privacy
      sendDefaultPii: false,
      beforeSend: sanitizeEvent,

      // Integrations
      integrations: [
        typeof (Sentry as any).httpClientIntegration === 'function' && (Sentry as any).httpClientIntegration({
          failedRequestStatusCodes: [[400, 599]],
          failedRequestTargets: [/.*/],
        }),
        typeof Sentry.expoRouterIntegration === 'function' && Sentry.expoRouterIntegration({
          enableTimeToInitialDisplay: true,
        }),
        typeof Sentry.reactNativeTracingIntegration === 'function' && Sentry.reactNativeTracingIntegration(),
        typeof (Sentry as any).mobileReplayIntegration === 'function' && (Sentry as any).mobileReplayIntegration({
          maskAllImages: true,
          maskAllText: true,
          maskAllVectors: true,
        }),
      ].filter(Boolean),

      // Attachments
      attachStacktrace: true,
      attachScreenshot: true,
      attachViewHierarchy: true,

      // Release tracking
      release: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
      dist: process.env.EXPO_PUBLIC_APP_BUILD_NUMBER || '1',

      // Initial scope
      initialScope: {
        tags: {
          app: 'karyadex',
          platform: Platform.OS,
        },
      },
    });

    isInitialized = true;
    console.log(`[Sentry] Initialized for ${environment} environment`);
  } catch (err) {
    console.error('[Sentry] Initialization failed:', err);
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return isInitialized;
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, any>
): string | undefined {
  if (!isInitialized) return undefined;

  try {
    if (context) {
      Sentry.setContext('error_context', sanitizeVars(context));
    }
    return Sentry.captureException(error);
  } catch (err) {
    console.warn('[Sentry] captureException failed:', err);
    return undefined;
  }
}

/**
 * Capture a message with level
 */
export function captureMessage(
  message: string,
  level: any = 'info',
  context?: Record<string, any>
): string | undefined {
  if (!isInitialized) return undefined;

  try {
    if (context) {
      Sentry.setContext('message_context', sanitizeVars(context));
    }
    return Sentry.captureMessage(message, level);
  } catch (err) {
    console.warn('[Sentry] captureMessage failed:', err);
    return undefined;
  }
}

/**
 * Set user context in Sentry
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  name?: string;
  [key: string]: any;
} | null): void {
  if (!isInitialized) return;

  try {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.name,
        ...sanitizeVars(user),
      });
      Sentry.setTag('user_id', user.id);
    } else {
      Sentry.setUser(null);
      Sentry.setTag('user_id', 'anonymous');
    }
  } catch (err) {
    console.warn('[Sentry] setUserContext failed:', err);
  }
}

/**
 * Add a breadcrumb
 */
export function addBreadcrumb(breadcrumb: {
  category?: string;
  message: string;
  level?: any;
  data?: Record<string, any>;
  type?: string;
}): void {
  if (!isInitialized) return;

  try {
    Sentry.addBreadcrumb({
      category: breadcrumb.category || 'app',
      message: breadcrumb.message,
      level: breadcrumb.level || 'info',
      data: breadcrumb.data ? sanitizeVars(breadcrumb.data) : undefined,
      type: breadcrumb.type || 'default',
    });
  } catch (err) {
    console.warn('[Sentry] addBreadcrumb failed:', err);
  }
}

/**
 * Set a tag
 */
export function setTag(key: string, value: string): void {
  if (!isInitialized) return;

  try {
    Sentry.setTag(key, value);
  } catch (err) {
    console.warn('[Sentry] setTag failed:', err);
  }
}

/**
 * Set multiple tags
 */
export function setTags(tags: Record<string, string>): void {
  if (!isInitialized) return;

  try {
    Object.entries(tags).forEach(([key, value]) => {
      Sentry.setTag(key, value);
    });
  } catch (err) {
    console.warn('[Sentry] setTags failed:', err);
  }
}

/**
 * Set extra data
 */
export function setExtra(key: string, value: any): void {
  if (!isInitialized) return;

  try {
    Sentry.setExtra(key, sanitizeVars({ [key]: value })[key]);
  } catch (err) {
    console.warn('[Sentry] setExtra failed:', err);
  }
}

/**
 * Flush pending events (useful before app termination)
 */
export async function flush(): Promise<boolean> {
  if (!isInitialized) return true;

  try {
    await Sentry.flush();
    return true;
  } catch (err) {
    console.warn('[Sentry] flush failed:', err);
    return false;
  }
}

/**
 * Get the current Sentry scope
 */
export function getScope(): any {
  if (!isInitialized) return undefined;

  try {
    return Sentry.getCurrentScope();
  } catch (err) {
    console.warn('[Sentry] getScope failed:', err);
    return undefined;
  }
}

export { Sentry };

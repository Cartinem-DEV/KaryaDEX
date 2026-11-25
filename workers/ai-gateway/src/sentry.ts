// src/sentry.ts — Sentry setup for Cloudflare Workers

import * as Sentry from '@sentry/cloudflare';
import type { Env } from './types';

// Initialize Sentry with Cloudflare Workers integration
export function initSentry(env: Env): void {
  const dsn = env.SENTRY_DSN;
  const environment = env.ENVIRONMENT || 'production';

  if (!dsn) {
    console.warn('[Sentry] SENTRY_DSN not set. Sentry disabled for Worker.');
    return;
  }

  try {
    if (typeof (Sentry as any).init === 'function') {
      (Sentry as any).init({
        dsn,
        environment,
        debug: environment !== 'production',
        tracesSampleRate: environment === 'production' ? 0.2 : 1.0,
        profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
        traceLifecycle: 'stream',
        sendDefaultPii: false,
        beforeSend(event: any) {
          return sanitizeEvent(event);
        },
        initialScope: {
          tags: {
            service: 'karyadex-ai-gateway',
            runtime: 'cloudflare-workers',
          },
        },
      });
    } else {
      const scope = Sentry.getCurrentScope();
      scope.setTags({
        service: 'karyadex-ai-gateway',
        runtime: 'cloudflare-workers',
        environment,
      });
    }

    console.log(`[Sentry] Initialized for Worker (${environment})`);
  } catch (err) {
    console.error('[Sentry] Worker initialization failed:', err);
  }
}

// Sanitize Sentry event to remove sensitive data
function sanitizeEvent(event: any): any | null {
  // Don't send events with missing DSN in development-like environments
  try {
    // Sanitize exception values
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map((exception: any) => {
        const sanitized = { ...exception };

        if (sanitized.value) {
          sanitized.value = sanitizeString(sanitized.value);
        }

        if (sanitized.stacktrace?.frames) {
          sanitized.stacktrace.frames = sanitized.stacktrace.frames.map((frame: any) => {
            const sanitizedFrame = { ...frame };
            if (sanitizedFrame.vars) {
              sanitizedFrame.vars = sanitizeVars(sanitizedFrame.vars);
            }
            return sanitizedFrame;
          });
        }

        return sanitized;
      });
    }

    // Sanitize breadcrumbs
    if (event.breadcrumbs?.values) {
      event.breadcrumbs.values = event.breadcrumbs.values
        .map((breadcrumb: any) => {
          const sanitized = { ...breadcrumb };
          if (sanitized.data) {
            sanitized.data = sanitizeVars(sanitized.data);
          }
          return sanitized;
        })
        .filter(Boolean);
    }

    // Sanitize user context
    if (event.user) {
      event.user = {
        id: event.user.id,
        // Don't send email/username unless explicitly set
        ...(event.user.email ? { email: event.user.email } : {}),
        ...(event.user.username ? { username: event.user.username } : {}),
      };
    }

    // Sanitize contexts
    if (event.contexts) {
      const sanitizedContexts: Record<string, any> = {};
      for (const [key, value] of Object.entries(event.contexts)) {
        if (value && typeof value === 'object') {
          sanitizedContexts[key] = sanitizeVars(value);
        } else {
          sanitizedContexts[key] = value;
        }
      }
      event.contexts = sanitizedContexts;
    }

    return event;
  } catch (err) {
    console.warn('[Sentry] Failed to sanitize event:', err);
    return event;
  }
}

function sanitizeString(str: string): string {
  return str
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT_REDACTED]')
    .replace(/(api[_-]?key|apikey|secret[_-]?key|access[_-]?token)[\s:=]+[a-zA-Z0-9_-]{20,}/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_-]{20,}/gi, 'Bearer [REDACTED]')
    .replace(/(password|passwd|pwd)[\s:=]+[^\s&]+/gi, '$1=[REDACTED]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
}

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

// Wrapper to capture errors with request context
export async function captureWorkerError(
  error: Error,
  request: Request,
  userId?: string,
  additionalContext?: Record<string, any>
): Promise<string | undefined> {
  try {
    const scope = Sentry.getCurrentScope();

    // Add request context
    scope.setContext('request', {
      method: request.method,
      url: new URL(request.url).pathname,
      headers: sanitizeHeaders(request.headers),
    });

    // Add user context if available
    if (userId) {
      Sentry.setUser({ id: userId });
      scope.setTag('user_id', userId);
    }

    // Add additional context
    if (additionalContext) {
      scope.setContext('additional', sanitizeVars(additionalContext));
    }

    return Sentry.captureException(error);
  } catch (err) {
    console.warn('[Sentry] captureWorkerError failed:', err);
    return undefined;
  }
}

// Sanitize headers to remove sensitive ones
function sanitizeHeaders(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-email-api-key'];

  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (sensitiveHeaders.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

// Helper to add breadcrumbs in Worker context
export function addWorkerBreadcrumb(
  category: string,
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void {
  try {
    Sentry.addBreadcrumb({
      category,
      message,
      level,
      data: data ? sanitizeVars(data) : undefined,
      type: 'default',
    });
  } catch (err) {
    console.warn('[Sentry] addWorkerBreadcrumb failed:', err);
  }
}

export { Sentry };
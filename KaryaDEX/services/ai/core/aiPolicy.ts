/**
 * KaryaDEX — AI Privacy & Data Classification Policy (Phase 12)
 *
 * Classifies data, prevents accidental leakage of credentials or sensitive data,
 * and ensures minimum necessary context transmission.
 */

import type { AIDataClassification, BaseAIRequest } from './aiTypes';
import { AIPolicyRejectionError } from './aiTypes';

export class AIPolicy {
  /**
   * Sensitive patterns that must NEVER appear in AI prompts or payloads.
   */
  private static readonly SENSITIVE_PATTERNS = [
    /ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, // JWT / Tokens
    /sbp_[a-zA-Z0-9_-]+/g, // Supabase service tokens
    /AIza[0-9A-Za-z-_]{35}/g, // Google API keys
    /gsk_[a-zA-Z0-9]{32,}/g, // Groq API keys
    /bearer\s+[a-zA-Z0-9_\-.]+/gi,
    /password["']?\s*[:=]\s*["'][^"']+["']/gi,
    /BEGIN (?:RSA )?PRIVATE KEY/g,
  ];

  /**
   * Classifies a context field into one of four privacy categories.
   */
  static classifyData(key: string, _value: any): AIDataClassification {
    const lowerKey = key.toLowerCase();

    if (
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('hash') ||
      lowerKey.includes('auth') ||
      lowerKey.includes('key')
    ) {
      return 'SENSITIVE';
    }

    if (
      lowerKey.includes('name') ||
      lowerKey.includes('college') ||
      lowerKey.includes('email') ||
      lowerKey.includes('profile')
    ) {
      return 'PERSONAL';
    }

    if (
      lowerKey.includes('attendance') ||
      lowerKey.includes('subject') ||
      lowerKey.includes('slot') ||
      lowerKey.includes('timetable') ||
      lowerKey.includes('task') ||
      lowerKey.includes('exam')
    ) {
      return 'ACADEMIC';
    }

    return 'PUBLIC';
  }

  /**
   * Inspects and validates an AI request payload for privacy violations.
   * Throws AIPolicyRejectionError if any credential pattern or sensitive field is present.
   */
  static validateRequestPayload(request: BaseAIRequest & Record<string, any>): void {
    const jsonStr = JSON.stringify(request);

    // 1. Search for leaked sensitive tokens/secrets
    for (const pattern of this.SENSITIVE_PATTERNS) {
      if (pattern.test(jsonStr)) {
        throw new AIPolicyRejectionError(
          `Privacy policy violation: Request payload contains sensitive credentials or tokens.`
        );
      }
    }

    // 2. Disallow forbidden fields in payload
    const forbiddenKeys = ['password', 'accessToken', 'refreshToken', 'serviceKey', 'rawSession'];
    for (const key of forbiddenKeys) {
      if (key in request) {
        throw new AIPolicyRejectionError(
          `Privacy policy violation: Forbidden key '${key}' detected in AI request payload.`
        );
      }
    }
  }

  /**
   * Scrubs potential sensitive patterns from user input before sending to model.
   */
  static sanitizeText(text: string): string {
    if (!text) return text;
    let sanitized = text;
    for (const pattern of this.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_CREDENTIAL]');
    }
    return sanitized;
  }
}

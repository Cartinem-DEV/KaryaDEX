// src/__tests__/ai-gateway.test.ts — Unit tests for Cloudflare Worker AI Gateway

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifySupabaseJWT, AuthError } from '../auth';
import { checkAndIncrementQuota, getQuotaStatus, resetQuota } from '../quota';
import { callGemini } from '../providers/gemini';
import { callMistral } from '../providers/mistral';
import { normalizeGeminiParts, extractMediaFromRequest, cleanJsonResponse, isRetryableError } from '../utils';
import { EmailService } from '../emails/emailService';
import { WelcomeEmail, PasswordResetEmail, EmailVerificationEmail, AttendanceAlertEmail, ExamReminderEmail } from '../emails/templates';

// Mock environment
const mockEnv = {
  GEMINI_API_KEY: 'test-gemini-key',
  MISTRAL_API_KEY: 'test-mistral-key',
  RESEND_API_KEY: 're_test_key',
  EMAIL_API_KEY: 'test-email-key',
  SUPABASE_JWKS_URL: 'https://test.supabase.co/auth/v1/.well-known/jwks.json',
  MAX_DAILY_REQUESTS: '50',
  RESEND_FROM_EMAIL: 'noreply@test.app',
  RESEND_FROM_NAME: 'TestApp',
  APP_BASE_URL: 'https://test.app',
  QUOTA_KV: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as any,
};

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Auth - verifySupabaseJWT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws MISSING_TOKEN when no auth header', async () => {
    await expect(verifySupabaseJWT(null, mockEnv)).rejects.toThrow(AuthError);
    await expect(verifySupabaseJWT(null, mockEnv)).rejects.toMatchObject({ code: 'MISSING_TOKEN', status: 401 });
  });

  it('throws INVALID_TOKEN for malformed auth header', async () => {
    await expect(verifySupabaseJWT('Bearer', mockEnv)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    await expect(verifySupabaseJWT('Basic token', mockEnv)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('throws INVALID_TOKEN for missing bearer prefix', async () => {
    await expect(verifySupabaseJWT('just-a-token', mockEnv)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });
});

describe('Quota - checkAndIncrementQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows request when under quota', async () => {
    mockEnv.QUOTA_KV.get.mockResolvedValueOnce({ count: 5, tokens: 100, date: '2025-01-15' });
    mockEnv.QUOTA_KV.put.mockResolvedValueOnce(undefined);

    const result = await checkAndIncrementQuota('user123', mockEnv, 50);

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(6);
    expect(result.remaining).toBe(44);
    expect(mockEnv.QUOTA_KV.put).toHaveBeenCalled();
  });

  it('denies request when at quota limit', async () => {
    mockEnv.QUOTA_KV.get.mockResolvedValueOnce({ count: 50, tokens: 1000, date: '2025-01-15' });

    const result = await checkAndIncrementQuota('user123', mockEnv, 50);

    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(50);
    expect(result.remaining).toBe(0);
    expect(mockEnv.QUOTA_KV.put).not.toHaveBeenCalled();
  });

  it('allows first request when no existing quota', async () => {
    mockEnv.QUOTA_KV.get.mockResolvedValueOnce(null);
    mockEnv.QUOTA_KV.put.mockResolvedValueOnce(undefined);

    const result = await checkAndIncrementQuota('user123', mockEnv, 50);

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(1);
    expect(result.remaining).toBe(49);
  });

  it('fails open on KV error', async () => {
    mockEnv.QUOTA_KV.get.mockRejectedValueOnce(new Error('KV error'));

    const result = await checkAndIncrementQuota('user123', mockEnv, 50);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(50);
  });
});

describe('Utils - normalizeGeminiParts', () => {
  it('normalizes inlineData with data URL', () => {
    const parts = [{
      inlineData: {
        mimeType: 'application/pdf',
        data: 'data:application/pdf;base64,JVBERi0xLjQKJ...',
      },
    }];

    const result = normalizeGeminiParts(parts);
    expect(result[0].inlineData.data).not.toContain('data:');
    expect(result[0].inlineData.data).not.toContain(',');
    expect(result[0].inlineData.mimeType).toBe('application/pdf');
  });

  it('normalizes inline_data (snake_case)', () => {
    const parts = [{
      inline_data: {
        mime_type: 'image/png',
        data: 'data:image/png;base64,iVBORw0KGgo...',
      },
    }];

    const result = normalizeGeminiParts(parts);
    expect(result[0].inlineData.data).not.toContain('data:');
    expect(result[0].inlineData.mimeType).toBe('image/png');
  });

  it('strips whitespace from base64 data', () => {
    const parts = [{
      inlineData: {
        mimeType: 'application/pdf',
        data: 'JVBERi0xLjQK\nJVBERi0xLjQK\r\n',
      },
    }];

    const result = normalizeGeminiParts(parts);
    expect(result[0].inlineData.data).not.toMatch(/\s/);
  });

  it('passes through text parts unchanged', () => {
    const parts = [{ text: 'Hello world' }];
    const result = normalizeGeminiParts(parts);
    expect(result).toEqual(parts);
  });
});

describe('Utils - extractMediaFromRequest', () => {
  it('detects multimodal with mediaBase64 and mimeType', () => {
    const body = { mediaBase64: 'data:image/png;base64,abc', mimeType: 'image/png' };
    const result = extractMediaFromRequest(body);
    expect(result.isMultimodal).toBe(true);
    expect(result.mimeType).toBe('image/png');
  });

  it('auto-detects mimeType from data URL', () => {
    const body = { mediaBase64: 'data:application/pdf;base64,JVBERi0xLjQK' };
    const result = extractMediaFromRequest(body);
    expect(result.isMultimodal).toBe(true);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.mediaBase64).toBe('JVBERi0xLjQK');
  });

  it('returns non-multimodal when no media', () => {
    const body = { prompt: 'Hello' };
    const result = extractMediaFromRequest(body);
    expect(result.isMultimodal).toBe(false);
  });
});

describe('Utils - cleanJsonResponse', () => {
  it('strips markdown code fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(cleanJsonResponse(input)).toBe('{"key": "value"}');
  });

  it('handles code fences without json label', () => {
    const input = '```\n{"key": "value"}\n```';
    expect(cleanJsonResponse(input)).toBe('{"key": "value"}');
  });

  it('handles plain JSON', () => {
    const input = '{"key": "value"}';
    expect(cleanJsonResponse(input)).toBe('{"key": "value"}');
  });

  it('trims whitespace', () => {
    const input = '  \n{"key": "value"}\n  ';
    expect(cleanJsonResponse(input)).toBe('{"key": "value"}');
  });
});

describe('Utils - isRetryableError', () => {
  it('returns false for 401 errors', () => {
    expect(isRetryableError('401 Unauthorized')).toBe(false);
  });

  it('returns false for 403 errors', () => {
    expect(isRetryableError('403 Forbidden')).toBe(false);
  });

  it('returns false for API_KEY errors', () => {
    expect(isRetryableError('API_KEY invalid')).toBe(false);
  });

  it('returns false for INVALID_ARGUMENT', () => {
    expect(isRetryableError('INVALID_ARGUMENT: bad request')).toBe(false);
  });

  it('returns true for 429 rate limit', () => {
    expect(isRetryableError('429 Too Many Requests')).toBe(true);
  });

  it('returns true for 503 service unavailable', () => {
    expect(isRetryableError('503 Service Unavailable')).toBe(true);
  });

  it('returns true for generic 500', () => {
    expect(isRetryableError('500 Internal Server Error')).toBe(true);
  });
});

describe('Providers - callGemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('returns error when API key missing', async () => {
    const env = { ...mockEnv, GEMINI_API_KEY: '' };
    const result = await callGemini(env, {}, 'prompt', 'schema', Date.now());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Gemini API key missing');
    }
  });

  it('calls Gemini API with correct payload', async () => {
    const mockResponse = {
      candidates: [{ content: { parts: [{ text: '{"result": "ok"}' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const body = { request: { userId: 'user1', persona: 'banku', feature: 'test' }, prompt: 'test', schemaDescription: 'schema' };
    const result = await callGemini(mockEnv, body, 'test', 'schema', Date.now());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ result: 'ok' });
      expect(result.model).toBe('gemini-3.8-flash');
      expect(result.fallbackUsed).toBe(false);
    }
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-3.8-flash'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('falls back to 3.7-flash on retryable error', async () => {
    // Primary fails with 429
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '{"result": "fallback"}' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
        }),
      });

    const body = { request: { userId: 'user1', persona: 'banku', feature: 'test' }, prompt: 'test', schemaDescription: 'schema' };
    const result = await callGemini(mockEnv, body, 'test', 'schema', Date.now());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.model).toBe('gemini-3.7-flash');
      expect(result.fallbackUsed).toBe(true);
    }
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not fallback when primaryOnly is true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    });

    const body = { request: { userId: 'user1', persona: 'banku', feature: 'test', primaryOnly: true }, prompt: 'test', schemaDescription: 'schema' };
    const result = await callGemini(mockEnv, body, 'test', 'schema', Date.now());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Primary model');
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('Providers - callMistral', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('returns error when API key missing', async () => {
    const env = { ...mockEnv, MISTRAL_API_KEY: '' };
    const result = await callMistral(env, 'prompt', 'schema', Date.now());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Mistral API key missing');
    }
  });

  it('calls Mistral API correctly', async () => {
    const mockResponse = {
      choices: [{ message: { content: '{"result": "ok"}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await callMistral(mockEnv, 'test prompt', 'schema', Date.now());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ result: 'ok' });
      expect(result.model).toBe('ministral-8b-2512');
    }
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.mistral.ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-mistral-key' }),
      })
    );
  });

  it('handles 429 rate limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    });

    const result = await callMistral(mockEnv, 'test', 'schema', Date.now());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('rate-limited');
    }
  });
});

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService(mockEnv);
  });

  it('sends welcome email', async () => {
    const mockSend = vi.spyOn(emailService as any, 'sendEmail').mockResolvedValueOnce({
      success: true,
      messageId: 'msg_123',
    });

    const result = await emailService.sendWelcomeEmail({ type: 'welcome', email: 'test@example.com', firstName: 'John' });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg_123');
  });

  it('sends password reset email with custom URL', async () => {
    const mockSend = vi.spyOn(emailService as any, 'sendEmail').mockResolvedValueOnce({
      success: true,
      messageId: 'msg_456',
    });

    const result = await emailService.sendPasswordResetEmail({
      type: 'password_reset',
      email: 'test@example.com',
      firstName: 'Jane',
      resetUrl: 'https://test.app/reset?token=abc',
    });

    expect(result.success).toBe(true);
  });

  it('sends attendance alert email', async () => {
    const mockSend = vi.spyOn(emailService as any, 'sendEmail').mockResolvedValueOnce({
      success: true,
      messageId: 'msg_att',
    });

    const result = await emailService.sendAttendanceAlertEmail({
      type: 'attendance_alert',
      email: 'test@example.com',
      firstName: 'Alice',
      subjectName: 'Mathematics',
      subjectCode: 'MATH101',
      currentPercentage: 65,
      targetPercentage: 75,
      classesMissed: 5,
      classesNeeded: 3,
    });

    expect(result.success).toBe(true);
  });

  it('sends exam reminder email', async () => {
    const mockSend = vi.spyOn(emailService as any, 'sendEmail').mockResolvedValueOnce({
      success: true,
      messageId: 'msg_exam',
    });

    const result = await emailService.sendExamReminderEmail({
      type: 'exam_reminder',
      email: 'test@example.com',
      firstName: 'Bob',
      examName: 'Final Exam',
      subjectName: 'Physics',
      examDate: '2025-12-15',
      daysUntil: 1,
      unrevisedTopics: 2,
    });

    expect(result.success).toBe(true);
  });

  it('routes to correct handler based on type', async () => {
    const mockSend = vi.spyOn(emailService as any, 'sendEmail').mockResolvedValue({
      success: true,
      messageId: 'msg_123',
    });

    await emailService.sendEmail({ type: 'welcome', email: 'test@example.com' });
    await emailService.sendEmail({ type: 'password_reset', email: 'test@example.com' });
    await emailService.sendEmail({ type: 'email_verification', email: 'test@example.com' });
    await emailService.sendEmail({ type: 'attendance_alert', email: 'test@example.com', subjectName: 'Math', currentPercentage: 50, targetPercentage: 75, classesMissed: 2, classesNeeded: 1 });
    await emailService.sendEmail({ type: 'exam_reminder', email: 'test@example.com', examName: 'Exam', subjectName: 'Math', examDate: '2025-12-15', daysUntil: 5 });

    expect(mockSend).toHaveBeenCalledTimes(5);
  });
});

describe('Email Templates - render without errors', () => {
  const baseProps = {
    firstName: 'John',
    appName: 'TestApp',
    appUrl: 'https://test.app',
    supportEmail: 'support@test.app',
  };

  it('WelcomeEmail renders', () => {
    const element = WelcomeEmail({ ...baseProps });
    expect(element).toBeDefined();
    expect(element.type).toBeDefined();
  });

  it('PasswordResetEmail renders', () => {
    const element = PasswordResetEmail({ ...baseProps, resetUrl: 'https://test.app/reset' });
    expect(element).toBeDefined();
  });

  it('EmailVerificationEmail renders', () => {
    const element = EmailVerificationEmail({ ...baseProps, verificationUrl: 'https://test.app/verify' });
    expect(element).toBeDefined();
  });

  it('AttendanceAlertEmail renders', () => {
    const element = AttendanceAlertEmail({
      ...baseProps,
      subjectName: 'Math',
      subjectCode: 'MATH101',
      currentPercentage: 65,
      targetPercentage: 75,
      classesMissed: 5,
      classesNeeded: 3,
    });
    expect(element).toBeDefined();
  });

  it('ExamReminderEmail renders', () => {
    const element = ExamReminderEmail({
      ...baseProps,
      examName: 'Final',
      subjectName: 'Math',
      examDate: '2025-12-15',
      daysUntil: 1,
    });
    expect(element).toBeDefined();
  });
});
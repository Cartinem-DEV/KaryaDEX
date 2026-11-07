// src/types.ts — Shared types for AI Gateway

export interface AIGatewayRequest {
  request: {
    userId: string;
    persona: 'banku' | 'shanky';
    feature: string;
    primaryOnly?: boolean;
  };
  prompt: string;
  schemaDescription: string;
  mediaBase64?: string;
  mimeType?: string;
  contents?: Array<{ parts: any[] }>;
  parts?: any[];
}

export interface AIGatewaySuccess {
  success: true;
  persona: 'banku' | 'shanky';
  provider: 'gemini' | 'mistral';
  model: string;
  fallbackUsed: boolean;
  data: any;
  rawText: string;
  metrics: {
    latencyMs: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface AIGatewayError {
  success: false;
  error: string;
  code?: string;
  metrics: {
    latencyMs: number;
  };
}

export type AIGatewayResponse = AIGatewaySuccess | AIGatewayError;

// Email types
export interface EmailRequestBase {
  type: 'welcome' | 'password_reset' | 'email_verification' | 'attendance_alert' | 'exam_reminder';
  email: string;
  firstName?: string;
}

export interface WelcomeEmailRequest extends EmailRequestBase {
  type: 'welcome';
}

export interface PasswordResetEmailRequest extends EmailRequestBase {
  type: 'password_reset';
  resetUrl?: string;
}

export interface EmailVerificationRequest extends EmailRequestBase {
  type: 'email_verification';
  verificationUrl?: string;
}

export interface AttendanceAlertEmailRequest extends EmailRequestBase {
  type: 'attendance_alert';
  subjectName: string;
  subjectCode?: string;
  currentPercentage: number;
  targetPercentage: number;
  classesMissed: number;
  classesNeeded: number;
}

export interface ExamReminderEmailRequest extends EmailRequestBase {
  type: 'exam_reminder';
  examName: string;
  subjectName: string;
  examDate: string;
  examTime?: string;
  location?: string;
  daysUntil: number;
  unrevisedTopics?: number;
}

export type EmailRequest =
  | WelcomeEmailRequest
  | PasswordResetEmailRequest
  | EmailVerificationRequest
  | AttendanceAlertEmailRequest
  | ExamReminderEmailRequest;

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  message?: string;
  error?: string;
}

// Cloudflare Worker environment
export interface Env {
  GEMINI_API_KEY: string;
  MISTRAL_API_KEY: string;
  RESEND_API_KEY: string;
  EMAIL_API_KEY: string;
  SUPABASE_JWKS_URL: string;
  MAX_DAILY_REQUESTS: string;
  RESEND_FROM_EMAIL: string;
  RESEND_FROM_NAME: string;
  APP_BASE_URL: string;
  QUOTA_KV: KVNamespace;
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
}
// services/email/emailService.ts — Client-side email service
// Calls Cloudflare Worker email endpoints for transactional emails

import { isCloudflareConfigured, getCloudflareConfig } from '@/services/supabase/supabaseConfig';
import { supabase } from '@/services/supabase/supabaseClient';

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

export class EmailService {
  private static instance: EmailService;
  private workerUrl: string = '';
  private emailApiKey: string = '';

  private constructor() {}

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Initialize with Cloudflare Worker config
   */
  async initialize(): Promise<void> {
    const config = getCloudflareConfig();
    this.workerUrl = config.workerUrl;
    // Email API key should be stored securely or derived from user session
    // For now, we'll use a separate env var or derive from session
    this.emailApiKey = process.env.EXPO_PUBLIC_EMAIL_API_KEY || '';
  }

  /**
   * Check if email service is available
   */
  isAvailable(): boolean {
    return isCloudflareConfigured() && Boolean(this.emailApiKey);
  }

  /**
   * Send email via Cloudflare Worker
   */
  async sendEmail(request: EmailRequest): Promise<EmailResponse> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Email service not configured. Set EXPO_PUBLIC_CLOUDFLARE_WORKER_URL and EXPO_PUBLIC_EMAIL_API_KEY.',
      };
    }

    // Get auth token for user context
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token;

    try {
      const response = await fetch(`${this.workerUrl}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Email-API-Key': this.emailApiKey,
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || `HTTP ${response.status}: Failed to send email`,
        };
      }

      return {
        success: true,
        messageId: result.messageId,
        message: result.message,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network error sending email',
      };
    }
  }

  /**
   * Send welcome email after signup
   */
  async sendWelcomeEmail(email: string, firstName?: string): Promise<EmailResponse> {
    return this.sendEmail({
      type: 'welcome',
      email,
      firstName,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, firstName?: string, resetUrl?: string): Promise<EmailResponse> {
    return this.sendEmail({
      type: 'password_reset',
      email,
      firstName,
      resetUrl,
    });
  }

  /**
   * Send email verification email
   */
  async sendEmailVerificationEmail(email: string, firstName?: string, verificationUrl?: string): Promise<EmailResponse> {
    return this.sendEmail({
      type: 'email_verification',
      email,
      firstName,
      verificationUrl,
    });
  }

  /**
   * Send attendance alert email
   */
  async sendAttendanceAlertEmail(
    email: string,
    subjectName: string,
    currentPercentage: number,
    targetPercentage: number,
    classesMissed: number,
    classesNeeded: number,
    firstName?: string,
    subjectCode?: string
  ): Promise<EmailResponse> {
    return this.sendEmail({
      type: 'attendance_alert',
      email,
      firstName,
      subjectName,
      subjectCode,
      currentPercentage,
      targetPercentage,
      classesMissed,
      classesNeeded,
    });
  }

  /**
   * Send exam reminder email
   */
  async sendExamReminderEmail(
    email: string,
    examName: string,
    subjectName: string,
    examDate: string,
    daysUntil: number,
    firstName?: string,
    examTime?: string,
    location?: string,
    unrevisedTopics?: number
  ): Promise<EmailResponse> {
    return this.sendEmail({
      type: 'exam_reminder',
      email,
      firstName,
      examName,
      subjectName,
      examDate,
      examTime,
      location,
      daysUntil,
      unrevisedTopics,
    });
  }
}

export const emailService = EmailService.getInstance();
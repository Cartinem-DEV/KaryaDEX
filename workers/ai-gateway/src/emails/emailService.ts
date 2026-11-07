// src/emails/emailService.ts — Resend email service for Cloudflare Workers

import * as React from 'react';
import { Resend } from 'resend';
import type { EmailRequest, EmailResponse } from '../types';
import {
  WelcomeEmail,
  PasswordResetEmail,
  EmailVerificationEmail,
  AttendanceAlertEmail,
  ExamReminderEmail,
} from './templates';

export type EmailServiceConfig =
  | {
      RESEND_API_KEY: string;
      RESEND_FROM_EMAIL: string;
      RESEND_FROM_NAME: string;
      APP_BASE_URL: string;
    }
  | {
      apiKey: string;
      fromEmail: string;
      fromName: string;
      appBaseUrl: string;
    };

export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;
  private appBaseUrl: string;
  private supportEmail: string;

  constructor(env: EmailServiceConfig) {
    const apiKey = 'RESEND_API_KEY' in env ? env.RESEND_API_KEY : env.apiKey;
    this.fromEmail = 'RESEND_FROM_EMAIL' in env ? env.RESEND_FROM_EMAIL : env.fromEmail;
    this.fromName = 'RESEND_FROM_NAME' in env ? env.RESEND_FROM_NAME : env.fromName;
    this.appBaseUrl = 'APP_BASE_URL' in env ? env.APP_BASE_URL : env.appBaseUrl;
    this.supportEmail = this.fromEmail;
    this.resend = new Resend(apiKey);
  }

  private async dispatchEmail(
    to: string,
    subject: string,
    react: React.ReactElement
  ): Promise<EmailResponse> {
    try {
      const result = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [to],
        subject,
        react,
      });

      if (result.error) {
        return {
          success: false,
          error: result.error.message || 'Failed to send email',
        };
      }

      return {
        success: true,
        messageId: result.data?.id,
        message: 'Email sent successfully',
      };
    } catch (err: any) {
      console.error('Resend error:', err);
      return {
        success: false,
        error: err.message || 'Failed to send email',
      };
    }
  }

  async sendWelcomeEmail(
    requestOrEmail: (EmailRequest & { type: 'welcome' }) | string,
    options?: { firstName?: string; appName?: string }
  ): Promise<EmailResponse> {
    const email = typeof requestOrEmail === 'string' ? requestOrEmail : requestOrEmail.email;
    const firstName = typeof requestOrEmail === 'string' ? options?.firstName : requestOrEmail.firstName;
    const appName = (typeof requestOrEmail === 'string' ? options?.appName : undefined) || this.fromName || 'BunkMatKar';

    return this.sendEmail(
      email,
      `Welcome to ${appName}! 🎓`,
      React.createElement(WelcomeEmail, {
        firstName,
        appName,
        appUrl: this.appBaseUrl,
        supportEmail: this.supportEmail,
      })
    );
  }

  async sendPasswordResetEmail(
    requestOrEmail: (EmailRequest & { type: 'password_reset' }) | string,
    options?: { firstName?: string; resetUrl?: string; appName?: string }
  ): Promise<EmailResponse> {
    const email = typeof requestOrEmail === 'string' ? requestOrEmail : requestOrEmail.email;
    const firstName = typeof requestOrEmail === 'string' ? options?.firstName : requestOrEmail.firstName;
    const resetUrl =
      (typeof requestOrEmail === 'string' ? options?.resetUrl : requestOrEmail.resetUrl) ||
      `${this.appBaseUrl}/reset-password`;
    const appName = (typeof requestOrEmail === 'string' ? options?.appName : undefined) || this.fromName || 'BunkMatKar';

    return this.sendEmail(
      email,
      `Reset your ${appName} password`,
      React.createElement(PasswordResetEmail, {
        firstName,
        appName,
        appUrl: this.appBaseUrl,
        supportEmail: this.supportEmail,
        resetUrl,
      })
    );
  }

  async sendEmailVerificationEmail(
    requestOrEmail: (EmailRequest & { type: 'email_verification' }) | string,
    options?: { firstName?: string; verificationUrl?: string; appName?: string }
  ): Promise<EmailResponse> {
    const email = typeof requestOrEmail === 'string' ? requestOrEmail : requestOrEmail.email;
    const firstName = typeof requestOrEmail === 'string' ? options?.firstName : requestOrEmail.firstName;
    const verificationUrl =
      (typeof requestOrEmail === 'string' ? options?.verificationUrl : requestOrEmail.verificationUrl) ||
      `${this.appBaseUrl}/verify-email`;
    const appName = (typeof requestOrEmail === 'string' ? options?.appName : undefined) || this.fromName || 'BunkMatKar';

    return this.sendEmail(
      email,
      `Verify your ${appName} email ✅`,
      React.createElement(EmailVerificationEmail, {
        firstName,
        appName,
        appUrl: this.appBaseUrl,
        supportEmail: this.supportEmail,
        verificationUrl,
      })
    );
  }

  async sendAttendanceAlertEmail(
    requestOrEmail: (EmailRequest & { type: 'attendance_alert' }) | string,
    options?: {
      firstName?: string;
      subjectName: string;
      subjectCode?: string;
      currentPercentage: number;
      targetPercentage: number;
      classesMissed: number;
      classesNeeded: number;
      appName?: string;
    }
  ): Promise<EmailResponse> {
    const email = typeof requestOrEmail === 'string' ? requestOrEmail : requestOrEmail.email;
    const payload = typeof requestOrEmail === 'string' ? options! : requestOrEmail;
    const appName = (typeof requestOrEmail === 'string' ? options?.appName : undefined) || this.fromName || 'BunkMatKar';

    return this.sendEmail(
      email,
      `Attendance Alert: ${payload.subjectName} at ${payload.currentPercentage.toFixed(1)}%`,
      React.createElement(AttendanceAlertEmail, {
        firstName: payload.firstName,
        appName,
        appUrl: this.appBaseUrl,
        supportEmail: this.supportEmail,
        subjectName: payload.subjectName,
        subjectCode: payload.subjectCode,
        currentPercentage: payload.currentPercentage,
        targetPercentage: payload.targetPercentage,
        classesMissed: payload.classesMissed,
        classesNeeded: payload.classesNeeded,
      })
    );
  }

  async sendExamReminderEmail(
    requestOrEmail: (EmailRequest & { type: 'exam_reminder' }) | string,
    options?: {
      firstName?: string;
      examName: string;
      subjectName: string;
      examDate: string;
      examTime?: string;
      location?: string;
      daysUntil: number;
      unrevisedTopics?: number;
      appName?: string;
    }
  ): Promise<EmailResponse> {
    const email = typeof requestOrEmail === 'string' ? requestOrEmail : requestOrEmail.email;
    const payload = typeof requestOrEmail === 'string' ? options! : requestOrEmail;
    const appName = (typeof requestOrEmail === 'string' ? options?.appName : undefined) || this.fromName || 'BunkMatKar';

    const subject =
      payload.daysUntil === 0
        ? `Exam Today: ${payload.examName}`
        : payload.daysUntil === 1
          ? `Exam Tomorrow: ${payload.examName}`
          : `Exam in ${payload.daysUntil} Days: ${payload.examName}`;

    return this.sendEmail(
      email,
      subject,
      React.createElement(ExamReminderEmail, {
        firstName: payload.firstName,
        appName,
        appUrl: this.appBaseUrl,
        supportEmail: this.supportEmail,
        examName: payload.examName,
        subjectName: payload.subjectName,
        examDate: payload.examDate,
        examTime: payload.examTime,
        location: payload.location,
        daysUntil: payload.daysUntil,
        unrevisedTopics: payload.unrevisedTopics,
      })
    );
  }

  sendEmail(request: EmailRequest): Promise<EmailResponse>;
  sendEmail(to: string, subject: string, react: React.ReactElement): Promise<EmailResponse>;
  async sendEmail(
    requestOrTo: EmailRequest | string,
    subject?: string,
    react?: React.ReactElement
  ): Promise<EmailResponse> {
    if (typeof requestOrTo === 'string') {
      return this.dispatchEmail(requestOrTo, subject!, react!);
    }

    const request = requestOrTo;
    switch (request.type) {
      case 'welcome':
        return this.sendWelcomeEmail(request);
      case 'password_reset':
        return this.sendPasswordResetEmail(request);
      case 'email_verification':
        return this.sendEmailVerificationEmail(request);
      case 'attendance_alert':
        return this.sendAttendanceAlertEmail(request);
      case 'exam_reminder':
        return this.sendExamReminderEmail(request);
      default:
        return {
          success: false,
          error: `Unknown email type: ${(request as any).type}`,
        };
    }
  }
}

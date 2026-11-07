// emailService.test.ts — Unit tests for Resend email service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../emailService';
import {
  WelcomeEmail,
  PasswordResetEmail,
  EmailVerificationEmail,
  AttendanceAlertEmail,
  ExamReminderEmail,
} from '../templates';

// Mock Resend
const mockSend = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService({
      apiKey: 're_test_key',
      fromEmail: 'noreply@test.app',
      fromName: 'TestApp',
      appBaseUrl: 'https://test.app',
    });
  });

  describe('sendWelcomeEmail', () => {
    it('sends welcome email with correct parameters', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'msg_123' }, error: null });

      const result = await emailService.sendWelcomeEmail('user@example.com', {
        firstName: 'John',
        appName: 'TestApp',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_123');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'TestApp <noreply@test.app>',
          to: ['user@example.com'],
          subject: 'Welcome to TestApp! 🎓',
          react: expect.any(Object), // React element
        })
      );
    });

    it('handles send failure', async () => {
      mockSend.mockResolvedValueOnce({ data: null, error: { message: 'API error' } });

      const result = await emailService.sendWelcomeEmail('user@example.com', { firstName: 'John' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends password reset email with reset URL', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'msg_456' }, error: null });

      const result = await emailService.sendPasswordResetEmail('user@example.com', {
        firstName: 'Jane',
        resetUrl: 'https://test.app/reset?token=abc123',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_456');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Reset your TestApp password',
          react: expect.any(Object),
        })
      );
    });
  });

  describe('sendEmailVerificationEmail', () => {
    it('sends email verification email', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'msg_789' }, error: null });

      const result = await emailService.sendEmailVerificationEmail('user@example.com', {
        firstName: 'Bob',
        verificationUrl: 'https://test.app/verify?token=xyz789',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_789');
    });
  });

  describe('sendAttendanceAlertEmail', () => {
    it('sends attendance alert for below-target percentage', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'msg_att' }, error: null });

      const result = await emailService.sendAttendanceAlertEmail('user@example.com', {
        firstName: 'Alice',
        subjectName: 'Mathematics',
        subjectCode: 'MATH101',
        currentPercentage: 65,
        targetPercentage: 75,
        classesMissed: 5,
        classesNeeded: 3,
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Attendance Alert: Mathematics at 65.0%',
          react: expect.any(Object),
        })
      );
    });
  });

  describe('sendExamReminderEmail', () => {
    it('sends exam reminder with correct urgency', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'msg_exam' }, error: null });

      const result = await emailService.sendExamReminderEmail('user@example.com', {
        firstName: 'Charlie',
        examName: 'Final Calculus',
        subjectName: 'Mathematics',
        examDate: '2025-12-15',
        examTime: '10:00',
        location: 'Room 301',
        daysUntil: 1,
        unrevisedTopics: 3,
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Exam Tomorrow: Final Calculus',
          react: expect.any(Object),
        })
      );
    });

    it('handles "today" urgency correctly', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'msg_exam2' }, error: null });

      const result = await emailService.sendExamReminderEmail('user@example.com', {
        firstName: 'Dave',
        examName: 'Physics Midterm',
        subjectName: 'Physics',
        examDate: '2025-10-20',
        daysUntil: 0,
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Exam Today: Physics Midterm',
        })
      );
    });
  });
});
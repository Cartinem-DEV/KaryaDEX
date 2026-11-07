// src/emails/templates.tsx — React Email templates for transactional emails

import * as React from 'react';

const Html: React.FC<{ lang?: string; children?: React.ReactNode }> = ({ lang = 'en', children }) => (
  <html lang={lang}>{children}</html>
);
const Head: React.FC<{ children?: React.ReactNode }> = ({ children }) => <head>{children}</head>;
const Body: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <body style={style}>{children}</body>
);
const Container: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div style={style}>{children}</div>
);
const Section: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div style={style}>{children}</div>
);
const Text: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <p style={style}>{children}</p>
);
const Link: React.FC<{ href?: string; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  href,
  style,
  children,
}) => (
  <a href={href} style={style}>
    {children}
  </a>
);
const Hr: React.FC<{ style?: React.CSSProperties }> = ({ style }) => <hr style={style} />;

interface EmailProps {
  firstName?: string;
  appName: string;
  appUrl: string;
  supportEmail: string;
}

export function WelcomeEmail({ firstName, appName, appUrl, supportEmail }: EmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f5f5f5' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Section style={{ backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <Section style={{ backgroundColor: '#6366f1', padding: '32px', textAlign: 'center' }}>
              <Text style={{ color: '#ffffff', fontSize: '28px', fontWeight: '700', margin: 0 }}>{appName}</Text>
            </Section>
            <Section style={{ padding: '40px 32px' }}>
              <Text style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
                Welcome to {appName}, {firstName || 'there'}! 🎓
              </Text>
              <Text style={{ fontSize: '16px', color: '#4b5563', lineHeight: 1.6, marginBottom: '16px' }}>
                Thanks for joining {appName}! We're excited to help you stay on top of your college life — attendance, schedules, exams, and more.
              </Text>
              <Text style={{ fontSize: '16px', color: '#4b5563', lineHeight: 1.6, marginBottom: '24px' }}>
                Here's what you can do right now:
              </Text>
              <Section style={{ marginBottom: '24px' }}>
                <Text style={{ fontSize: '15px', color: '#4b5563', marginBottom: '8px' }}>
                  <strong>📅 Track attendance</strong> — Never miss the 75% threshold again
                </Text>
                <Text style={{ fontSize: '15px', color: '#4b5563', marginBottom: '8px' }}>
                  <strong>🤖 Ask Banku & Shanky</strong> — Your AI study companions
                </Text>
                <Text style={{ fontSize: '15px', color: '#4b5563', marginBottom: '8px' }}>
                  <strong>📚 Manage syllabus & timetable</strong> — All in one place
                </Text>
                <Text style={{ fontSize: '15px', color: '#4b5563', marginBottom: '8px' }}>
                  <strong>⏰ Smart reminders</strong> — Exams, classes, and revisions
                </Text>
              </Section>
              <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
                <Link href={appUrl} style={{ display: 'inline-block', backgroundColor: '#6366f1', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '16px' }}>
                  Open {appName}
                </Link>
              </Section>
              <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
              <Text style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center' }}>
                Questions? Reply to this email or contact us at {supportEmail}
              </Text>
            </Section>
          </Section>
          <Section style={{ textAlign: 'center', marginTop: '24px' }}>
            <Text style={{ fontSize: '12px', color: '#9ca3af' }}>
              © {new Date().getFullYear()} {appName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function PasswordResetEmail({ firstName, appName, appUrl, supportEmail, resetUrl }: EmailProps & { resetUrl: string }) {
  return (
    <Html lang="en">
      <Head />
      <Body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f5f5f5' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Section style={{ backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <Section style={{ backgroundColor: '#6366f1', padding: '32px', textAlign: 'center' }}>
              <Text style={{ color: '#ffffff', fontSize: '28px', fontWeight: '700', margin: 0 }}>{appName}</Text>
            </Section>
            <Section style={{ padding: '40px 32px' }}>
              <Text style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
                Reset your password, {firstName || 'there'}
              </Text>
              <Text style={{ fontSize: '16px', color: '#4b5563', lineHeight: 1.6, marginBottom: '16px' }}>
                We received a request to reset your {appName} password. If you didn't make this request, you can safely ignore this email.
              </Text>
              <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
                <Link href={resetUrl} style={{ display: 'inline-block', backgroundColor: '#6366f1', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '16px' }}>
                  Reset Password
                </Link>
              </Section>
              <Text style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', marginBottom: '24px' }}>
                This link expires in 1 hour for security.
              </Text>
              <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
              <Text style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center' }}>
                Didn't request this? Contact us at {supportEmail}
              </Text>
            </Section>
          </Section>
          <Section style={{ textAlign: 'center', marginTop: '24px' }}>
            <Text style={{ fontSize: '12px', color: '#9ca3af' }}>
              © {new Date().getFullYear()} {appName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailVerificationEmail({ firstName, appName, appUrl, supportEmail, verificationUrl }: EmailProps & { verificationUrl: string }) {
  return (
    <Html lang="en">
      <Head />
      <Body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f5f5f5' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Section style={{ backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <Section style={{ backgroundColor: '#10b981', padding: '32px', textAlign: 'center' }}>
              <Text style={{ color: '#ffffff', fontSize: '28px', fontWeight: '700', margin: 0 }}>{appName}</Text>
            </Section>
            <Section style={{ padding: '40px 32px' }}>
              <Text style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
                Verify your email, {firstName || 'there'} ✅
              </Text>
              <Text style={{ fontSize: '16px', color: '#4b5563', lineHeight: 1.6, marginBottom: '16px' }}>
                Thanks for signing up! Please verify your email address to unlock all {appName} features.
              </Text>
              <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
                <Link href={verificationUrl} style={{ display: 'inline-block', backgroundColor: '#10b981', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '16px' }}>
                  Verify Email
                </Link>
              </Section>
              <Text style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', marginBottom: '24px' }}>
                This link expires in 24 hours.
              </Text>
              <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
              <Text style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center' }}>
                Need help? Contact us at {supportEmail}
              </Text>
            </Section>
          </Section>
          <Section style={{ textAlign: 'center', marginTop: '24px' }}>
            <Text style={{ fontSize: '12px', color: '#9ca3af' }}>
              © {new Date().getFullYear()} {appName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function AttendanceAlertEmail({
  firstName,
  appName,
  appUrl,
  supportEmail,
  subjectName,
  subjectCode,
  currentPercentage,
  targetPercentage,
  classesMissed,
  classesNeeded,
}: EmailProps & {
  subjectName: string;
  subjectCode?: string;
  currentPercentage: number;
  targetPercentage: number;
  classesMissed: number;
  classesNeeded: number;
}) {
  const isCritical = currentPercentage < targetPercentage - 10;
  const percentageColor = currentPercentage >= targetPercentage ? '#10b981' : currentPercentage >= targetPercentage - 5 ? '#f59e0b' : '#ef4444';

  return (
    <Html lang="en">
      <Head />
      <Body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f5f5f5' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Section style={{ backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <Section style={{ backgroundColor: percentageColor, padding: '32px', textAlign: 'center' }}>
              <Text style={{ color: '#ffffff', fontSize: '28px', fontWeight: '700', margin: 0 }}>{appName}</Text>
              <Text style={{ color: '#ffffff', fontSize: '14px', marginTop: '8px', opacity: 0.9 }}>Attendance Alert</Text>
            </Section>
            <Section style={{ padding: '40px 32px' }}>
              <Text style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
                {firstName || 'Hey'}, your attendance needs attention
              </Text>
              <Section style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
                <Text style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                  {subjectName} {subjectCode ? `(${subjectCode})` : ''}
                </Text>
                <Section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <Text style={{ fontSize: '14px', color: '#6b7280' }}>Current Attendance</Text>
                  <Text style={{ fontSize: '32px', fontWeight: '700', color: percentageColor }}>{currentPercentage.toFixed(1)}%</Text>
                </Section>
                <Section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <Text style={{ fontSize: '14px', color: '#6b7280' }}>Target (Minimum)</Text>
                  <Text style={{ fontSize: '18px', fontWeight: '600', color: '#374151' }}>{targetPercentage}%</Text>
                </Section>
                <Hr style={{ borderColor: '#e5e7eb', margin: '16px 0' }} />
                <Section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <Text style={{ fontSize: '14px', color: '#6b7280' }}>Classes Missed</Text>
                  <Text style={{ fontSize: '18px', fontWeight: '600', color: '#ef4444' }}>{classesMissed}</Text>
                </Section>
                <Section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: '14px', color: '#6b7280' }}>Classes Needed to Recover</Text>
                  <Text style={{ fontSize: '18px', fontWeight: '600', color: '#10b981' }}>{classesNeeded}</Text>
                </Section>
              </Section>
              {isCritical && (
                <Section style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                  <Text style={{ fontSize: '14px', color: '#991b1b', fontWeight: '500' }}>
                    ⚠️ Critical: You're significantly below the required attendance. Attend the next {classesNeeded} classes to get back on track.
                  </Text>
                </Section>
              )}
              <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
                <Link href={`${appUrl}/attendance`} style={{ display: 'inline-block', backgroundColor: '#6366f1', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '16px' }}>
                  View Attendance Details
                </Link>
              </Section>
              <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
              <Text style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center' }}>
                Questions? Contact us at {supportEmail}
              </Text>
            </Section>
          </Section>
          <Section style={{ textAlign: 'center', marginTop: '24px' }}>
            <Text style={{ fontSize: '12px', color: '#9ca3af' }}>
              © {new Date().getFullYear()} {appName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function ExamReminderEmail({
  firstName,
  appName,
  appUrl,
  supportEmail,
  examName,
  subjectName,
  examDate,
  examTime,
  location,
  daysUntil,
  unrevisedTopics,
}: EmailProps & {
  examName: string;
  subjectName: string;
  examDate: string;
  examTime?: string;
  location?: string;
  daysUntil: number;
  unrevisedTopics?: number;
}) {
  const isUrgent = daysUntil <= 1;
  const accentColor = isUrgent ? '#ef4444' : '#f59e0b';

  return (
    <Html lang="en">
      <Head />
      <Body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f5f5f5' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Section style={{ backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <Section style={{ backgroundColor: accentColor, padding: '32px', textAlign: 'center' }}>
              <Text style={{ color: '#ffffff', fontSize: '28px', fontWeight: '700', margin: 0 }}>{appName}</Text>
              <Text style={{ color: '#ffffff', fontSize: '14px', marginTop: '8px', opacity: 0.9 }}>
                {daysUntil === 0 ? '📅 Exam Today!' : daysUntil === 1 ? '⏰ Exam Tomorrow!' : `📅 Exam in ${daysUntil} Days`}
              </Text>
            </Section>
            <Section style={{ padding: '40px 32px' }}>
              <Text style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
                {firstName || 'Hey'}, don't forget!
              </Text>
              <Section style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
                <Text style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937', marginBottom: '12px' }}>{examName}</Text>
                <Text style={{ fontSize: '16px', color: '#4b5563', marginBottom: '8px' }}>
                  <strong>Subject:</strong> {subjectName}
                </Text>
                <Text style={{ fontSize: '16px', color: '#4b5563', marginBottom: '8px' }}>
                  <strong>Date:</strong> {examDate}
                </Text>
                {examTime && (
                  <Text style={{ fontSize: '16px', color: '#4b5563', marginBottom: '8px' }}>
                    <strong>Time:</strong> {examTime}
                  </Text>
                )}
                {location && (
                  <Text style={{ fontSize: '16px', color: '#4b5563', marginBottom: '8px' }}>
                    <strong>Location:</strong> {location}
                  </Text>
                )}
                {unrevisedTopics && unrevisedTopics > 0 && (
                  <Text style={{ fontSize: '16px', color: '#ef4444', fontWeight: '500', marginBottom: '8px' }}>
                    📚 {unrevisedTopics} topic{unrevisedTopics > 1 ? 's' : ''} still to revise
                  </Text>
                )}
              </Section>
              <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
                <Link href={`${appUrl}/exams`} style={{ display: 'inline-block', backgroundColor: accentColor, color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '16px' }}>
                  View Exam Details
                </Link>
              </Section>
              <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
              <Text style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center' }}>
                Good luck! Need help? Contact us at {supportEmail}
              </Text>
            </Section>
          </Section>
          <Section style={{ textAlign: 'center', marginTop: '24px' }}>
            <Text style={{ fontSize: '12px', color: '#9ca3af' }}>
              © {new Date().getFullYear()} {appName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
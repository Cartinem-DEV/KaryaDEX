// src/emails/emailRoutes.ts — Email API endpoints

import type { Env, EmailRequest, EmailResponse } from '../types';
import { verifyEmailApiKey } from '../auth';
import { EmailService } from './emailService';
import { corsResponse, handleOptions } from '../utils';

export async function handleEmailRequest(request: Request, env: Env): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  if (request.method !== 'POST') {
    return corsResponse({ error: 'Method not allowed. Use POST.' }, 405);
  }

  // Verify email API key
  const emailApiKey = request.headers.get('X-Email-API-Key');
  if (!verifyEmailApiKey(emailApiKey, env)) {
    return corsResponse({ error: 'Invalid or missing X-Email-API-Key header' }, 401);
  }

  try {
    const body = await request.json() as EmailRequest;
    const emailService = new EmailService(env);

    // Validate required fields
    if (!body.type || !body.email) {
      return corsResponse({ error: 'Missing required fields: type, email' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return corsResponse({ error: 'Invalid email format' }, 400);
    }

    const result = await emailService.sendEmail(body);

    if (!result.success) {
      return corsResponse({ error: result.error }, 400);
    }

    return corsResponse({
      success: true,
      messageId: result.messageId,
      message: result.message,
    });
  } catch (err: any) {
    console.error('Email endpoint error:', err);
    return corsResponse({ error: 'Internal server error' }, 500);
  }
}

// Health check endpoint for email service
export async function handleEmailHealth(): Promise<Response> {
  return corsResponse({ status: 'ok', service: 'email' });
}
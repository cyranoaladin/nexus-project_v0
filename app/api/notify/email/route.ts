/**
 * POST /api/notify/email
 *
 * Server-side email notification endpoint.
 * Validates payload with zod, applies basic rate limiting, sends via centralized mailer.
 *
 * Supported types: 'bilan_ack' (accusé réception), 'internal' (notification support).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendMail } from '@/lib/email/mailer';
import { bilanAcknowledgement, internalNotification } from '@/lib/email/templates';

// ─── Rate Limiting (in-memory, per-IP, 5 req/min) ──────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const bilanAckSchema = z.object({
  type: z.literal('bilan_ack'),
  to: z.string().email(),
  parentName: z.string().min(1).max(200),
  studentName: z.string().min(1).max(200),
  formType: z.string().min(1).max(100).default('Bilan gratuit'),
});

const internalSchema = z.object({
  type: z.literal('internal'),
  eventType: z.string().min(1).max(200),
  fields: z.record(z.string().max(500)),
});

const payloadSchema = z.discriminatedUnion('type', [bilanAckSchema, internalSchema]);

// ─── Handler ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests' },
      { status: 429 }
    );
  }

  // Parse & validate
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    if (data.type === 'bilan_ack') {
      const template = bilanAcknowledgement({
        parentName: data.parentName,
        studentName: data.studentName,
        formType: data.formType,
      });

      const result = await sendMail({
        to: data.to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      return NextResponse.json({ ok: true, skipped: result.skipped ?? false }, { status: 200 });
    }

    if (data.type === 'internal') {
      const supportEmail = process.env.MAIL_REPLY_TO || process.env.EMAIL_REPLY_TO || 'contact@nexusreussite.academy';
      const template = internalNotification({
        eventType: data.eventType,
        fields: data.fields,
      });

      const result = await sendMail({
        to: supportEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      return NextResponse.json({ ok: true, skipped: result.skipped ?? false }, { status: 200 });
    }

    // Exhaustive check — should never reach here
    return NextResponse.json({ ok: false, error: 'Unknown type' }, { status: 400 });
  } catch (error) {
    console.error('[notify/email] Error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

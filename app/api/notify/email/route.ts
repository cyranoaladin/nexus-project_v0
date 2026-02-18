/**
 * POST /api/notify/email
 *
 * Server-side email notification endpoint.
 * Protected by CSRF validation (same-origin only) and distributed rate limiting.
 * Validates payload with zod, sends via centralized mailer.
 *
 * Supported types: 'bilan_ack' (accusé réception), 'internal' (notification support).
 *
 * Security:
 * - CSRF: checkCsrf rejects cross-origin requests in production.
 * - Rate limit: Upstash Redis (distributed) via checkRateLimit, falls back to open in dev.
 * - Body size: checkBodySize rejects payloads > 64KB.
 * - Internal emails: sent only to INTERNAL_NOTIFICATION_EMAIL (never caller-controlled).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkCsrf, checkBodySize } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendMail } from '@/lib/email/mailer';
import { bilanAcknowledgement, internalNotification } from '@/lib/email/templates';

// ─── Schemas ────────────────────────────────────────────────────────────────

const bilanAckSchema = z.object({
  type: z.literal('bilan_ack'),
  to: z.string().email().max(320),
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
  // 1. CSRF protection — reject cross-origin requests
  const csrfResponse = checkCsrf(request);
  if (csrfResponse) return csrfResponse;

  // 2. Body size guard (64KB max)
  const sizeResponse = checkBodySize(request, 64 * 1024);
  if (sizeResponse) return sizeResponse;

  // 3. Distributed rate limiting (Upstash Redis, falls back to open in dev)
  const rateLimitResponse = await checkRateLimit(request, 'api');
  if (rateLimitResponse) return rateLimitResponse;

  // 4. Parse & validate
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
    // 5a. Bilan acknowledgement — sends to the caller-provided email
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

    // 5b. Internal notification — always sent to INTERNAL_NOTIFICATION_EMAIL (never caller-controlled)
    if (data.type === 'internal') {
      const internalRecipient =
        process.env.INTERNAL_NOTIFICATION_EMAIL ||
        process.env.MAIL_REPLY_TO ||
        process.env.EMAIL_REPLY_TO ||
        'contact@nexusreussite.academy';

      const template = internalNotification({
        eventType: data.eventType,
        fields: data.fields,
      });

      const result = await sendMail({
        to: internalRecipient,
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

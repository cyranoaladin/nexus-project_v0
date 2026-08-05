import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
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
 * - Rate limit: dedicated distributed Redis policy with IP and identity dimensions.
 *   Fail-closed in production if Redis is not configured (503).
 * - Body size: enforced via stream reading (64KB max), not just Content-Length.
 * - Internal emails: sent only to INTERNAL_NOTIFICATION_EMAIL (never caller-controlled).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkCsrf } from '@/lib/csrf';
import { queueCommittedEmail } from '@/lib/email/queue';
import { isMailDisabled } from '@/lib/email/mailer';
import { bilanAcknowledgement, internalNotification } from '@/lib/email/templates';
import { LEGAL } from '@/lib/legal';

/** True when the outbox already has a matching, previously-enqueued job. */
function isDuplicateIdempotencyKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 64 * 1024; // 64KB

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalized error response — all errors from this route use this shape.
 */
function fail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/**
 * Read and parse JSON body with a hard byte limit enforced via stream reading.
 * Protects against chunked-encoding bypass of Content-Length checks.
 */
async function readJsonWithLimit(request: NextRequest, maxBytes: number): Promise<unknown> {
  // Short-circuit: reject if Content-Length already exceeds limit
  const cl = request.headers.get('content-length');
  if (cl && parseInt(cl, 10) > maxBytes) {
    throw new PayloadTooLargeError();
  }

  const body = request.body;
  if (!body) throw new InvalidJsonError();

  const reader = body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) throw new PayloadTooLargeError();
    chunks.push(value);
  }

  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  try {
    return JSON.parse(buf.toString('utf-8'));
  } catch {
    throw new InvalidJsonError();
  }
}

class PayloadTooLargeError extends Error { constructor() { super('PAYLOAD_TOO_LARGE'); } }
class InvalidJsonError extends Error { constructor() { super('INVALID_JSON'); } }

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

  // 2. Dedicated rate limiting — 5 req/hour/IP
  const blocked = await guardSensitiveRateLimit(request, {
      scope: 'notification-email',
      dimensions: ['ip'],
    });
  if (blocked) return blocked;

  // 3. Read & parse body with stream-enforced size limit (64KB)
  let body: unknown;
  try {
    body = await readJsonWithLimit(request, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof PayloadTooLargeError) {
      return fail(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds ${MAX_BODY_BYTES} bytes`);
    }
    return fail(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }

  // 4. Validate payload schema
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION_FAILED', 'Payload validation failed');
  }

  const data = parsed.data;

  // Internal notifications always go to a fixed, environment-configured
  // recipient — never to arbitrary caller data. `eventType` is request
  // payload, not an identity, so it must not be used as the rate-limit
  // identity (a caller could vary it per request to dodge the per-identity
  // budget and fall through to the coarser IP limit instead).
  const internalRecipient =
    process.env.INTERNAL_NOTIFICATION_EMAIL ||
    process.env.MAIL_REPLY_TO ||
    process.env.EMAIL_REPLY_TO ||
    LEGAL.contact.email;

  const identityBlocked = await guardSensitiveRateLimit(request, {
    scope: 'notification-email',
    identity: data.type === 'bilan_ack' ? data.to : internalRecipient,
    dimensions: ['identity'],
  });
  if (identityBlocked) return identityBlocked;

  try {
    // 5a. Bilan acknowledgement — sends to the caller-provided email
    if (data.type === 'bilan_ack') {
      // Disabled/test environments must short-circuit before creating a
      // durable outbox job: the outbox worker treats a disabled-mailer
      // delivery (sendMail's `{ skipped: true }`) as a non-delivery and
      // retries it forever, so we must never enqueue in that case.
      if (isMailDisabled()) {
        return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
      }

      const template = bilanAcknowledgement({
        parentName: data.parentName,
        studentName: data.studentName,
        formType: data.formType,
      });

      try {
        await queueCommittedEmail({
          aggregateType: 'BILAN_ACKNOWLEDGEMENT',
          aggregateKey: data.to,
          dedupeKey: JSON.stringify(data),
          to: data.to,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
      } catch (error) {
        // A retry with the exact same payload hits the outbox's permanent
        // unique idempotency key (derived from the full payload) — treat
        // that as an already-accepted no-op rather than a failure.
        if (!isDuplicateIdempotencyKey(error)) throw error;
      }

      return NextResponse.json({ ok: true, skipped: false }, { status: 200 });
    }

    // 5b. Internal notification — always sent to INTERNAL_NOTIFICATION_EMAIL (never caller-controlled)
    if (data.type === 'internal') {
      if (isMailDisabled()) {
        return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
      }

      const template = internalNotification({
        eventType: data.eventType,
        fields: data.fields,
      });

      try {
        await queueCommittedEmail({
          aggregateType: 'INTERNAL_NOTIFICATION',
          aggregateKey: data.eventType,
          dedupeKey: JSON.stringify(data),
          to: internalRecipient,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
      } catch (error) {
        if (!isDuplicateIdempotencyKey(error)) throw error;
      }

      return NextResponse.json({ ok: true, skipped: false }, { status: 200 });
    }

    // Exhaustive check — should never reach here
    return fail(400, 'UNKNOWN_TYPE', 'Unsupported notification type');
  } catch (error) {
    console.error('[notify/email] Error:', error instanceof Error ? error.message : 'unknown');
    return fail(500, 'INTERNAL_ERROR', 'Internal server error');
  }
}

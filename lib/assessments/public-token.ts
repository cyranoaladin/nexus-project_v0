import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { Subject } from '@/lib/assessments/core/types';

export const ASSESSMENT_PUBLIC_TOKEN_TTL_SECONDS = 15 * 60;
export const ASSESSMENT_FLOW_TOKEN_TTL_SECONDS = 30 * 60;
export const ASSESSMENT_FLOW_COOKIE_NAME = 'nexus_assessment_flow';

const emailHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

const assessmentPublicTokenPayloadSchema = z.object({
  v: z.literal(1),
  usage: z.literal('assessment_submit'),
  subject: z.nativeEnum(Subject),
  grade: z.enum(['PREMIERE', 'TERMINALE']),
  source: z.string().trim().min(1).max(80).optional(),
  campaignId: z.string().trim().min(1).max(80).optional(),
  binding: z.enum(['staff', 'lead']),
  leadEmailHash: emailHashSchema.optional(),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  nonce: z.string().min(16).max(64),
}).strict().superRefine((payload, ctx) => {
  if (payload.binding === 'lead' && !payload.leadEmailHash) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['leadEmailHash'],
      message: 'leadEmailHash is required for lead-bound assessment tokens',
    });
  }
});

const assessmentFlowTokenPayloadSchema = z.object({
  v: z.literal(1),
  usage: z.literal('assessment_flow'),
  subject: z.nativeEnum(Subject),
  grade: z.enum(['PREMIERE', 'TERMINALE']),
  source: z.string().trim().min(1).max(80),
  leadEmailHash: emailHashSchema,
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  nonce: z.string().min(16).max(64),
}).strict();

export type AssessmentPublicTokenPayload = z.infer<typeof assessmentPublicTokenPayloadSchema>;
export type AssessmentFlowTokenPayload = z.infer<typeof assessmentFlowTokenPayloadSchema>;

type AssessmentTokenFailureReason =
  | 'missing'
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'scope_mismatch'
  | 'secret_unavailable';

export type AssessmentPublicTokenExpectation = {
  usage: 'assessment_submit';
  subject: Subject;
  grade: 'PREMIERE' | 'TERMINALE';
  source?: string;
  campaignId?: string;
  binding?: 'staff' | 'lead';
  leadEmailHash?: string;
  studentEmail?: string;
};

export type AssessmentPublicTokenVerification =
  | { valid: true; payload: AssessmentPublicTokenPayload }
  | {
      valid: false;
      reason: AssessmentTokenFailureReason;
    };

export type AssessmentFlowTokenVerification =
  | { valid: true; payload: AssessmentFlowTokenPayload }
  | {
      valid: false;
      reason: AssessmentTokenFailureReason;
    };

function toBase64Url(value: Buffer | string): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return buffer.toString('base64url');
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function nowSeconds(now = Date.now()): number {
  return Math.floor(now / 1000);
}

function getSecret(): string {
  const secret =
    process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET;

  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ASSESSMENT_PUBLIC_TOKEN_SECRET_REQUIRED');
  }

  return 'test-assessment-public-token-secret';
}

function sign(payloadPart: string): string {
  return createHmac('sha256', getSecret()).update(payloadPart).digest('base64url');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashAssessmentLeadEmail(email: string): string {
  return createHmac('sha256', getSecret()).update(normalizeEmail(email)).digest('hex');
}

export function buildAssessmentAliasEmail(leadEmailHash: string): string {
  const parsed = emailHashSchema.parse(leadEmailHash);
  return `assessment+${parsed.slice(0, 24)}@nexusreussite.academy`;
}

export function createAssessmentPublicToken(
  input: {
    subject: Subject;
    grade: 'PREMIERE' | 'TERMINALE';
    source?: string;
    campaignId?: string;
    binding?: 'staff' | 'lead';
    leadEmailHash?: string;
  },
  options: {
    now?: number;
    ttlSeconds?: number;
  } = {},
): string {
  const issuedAt = nowSeconds(options.now);
  const ttlSeconds = options.ttlSeconds ?? ASSESSMENT_PUBLIC_TOKEN_TTL_SECONDS;
  const payload = assessmentPublicTokenPayloadSchema.parse({
    v: 1,
    usage: 'assessment_submit',
    subject: input.subject,
    grade: input.grade,
    source: input.source,
    campaignId: input.campaignId,
    binding: input.binding ?? (input.leadEmailHash ? 'lead' : 'staff'),
    leadEmailHash: input.leadEmailHash,
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
    nonce: randomBytes(16).toString('base64url'),
  });

  const payloadPart = toBase64Url(JSON.stringify(payload));
  return `v1.${payloadPart}.${sign(payloadPart)}`;
}

export function createAssessmentFlowToken(
  input: {
    subject: Subject;
    grade: 'PREMIERE' | 'TERMINALE';
    source: string;
    leadEmailHash: string;
  },
  options: {
    now?: number;
    ttlSeconds?: number;
  } = {},
): string {
  const issuedAt = nowSeconds(options.now);
  const ttlSeconds = options.ttlSeconds ?? ASSESSMENT_FLOW_TOKEN_TTL_SECONDS;
  const payload = assessmentFlowTokenPayloadSchema.parse({
    v: 1,
    usage: 'assessment_flow',
    subject: input.subject,
    grade: input.grade,
    source: input.source,
    leadEmailHash: input.leadEmailHash,
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
    nonce: randomBytes(16).toString('base64url'),
  });

  const payloadPart = toBase64Url(JSON.stringify(payload));
  return `v1.${payloadPart}.${sign(payloadPart)}`;
}

function verifySignatureAndParse<T>(
  token: string | null | undefined,
  schema: z.ZodType<T>,
  options: { now?: number } = {},
):
  | { ok: true; payload: T }
  | { ok: false; reason: AssessmentTokenFailureReason } {
  if (!token) return { ok: false, reason: 'missing' };

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    return { ok: false, reason: 'malformed' };
  }

  const [, payloadPart, signature] = parts;

  let expectedSignature: string;
  try {
    expectedSignature = sign(payloadPart);
  } catch {
    return { ok: false, reason: 'secret_unavailable' };
  }

  try {
    const signatureBuffer = Buffer.from(signature, 'base64url');
    const expectedBuffer = Buffer.from(expectedSignature, 'base64url');
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return { ok: false, reason: 'bad_signature' };
    }
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: T & { expiresAt?: unknown };
  try {
    payload = schema.parse(JSON.parse(fromBase64Url(payloadPart).toString('utf8'))) as T & {
      expiresAt?: unknown;
    };
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= nowSeconds(options.now)) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, payload: payload as T };
}

export function verifyAssessmentPublicToken(
  token: string | null | undefined,
  expected: AssessmentPublicTokenExpectation,
  options: { now?: number } = {},
): AssessmentPublicTokenVerification {
  const verification = verifySignatureAndParse(
    token,
    assessmentPublicTokenPayloadSchema,
    options,
  );
  if (!verification.ok) return { valid: false, reason: verification.reason };
  const payload = verification.payload;

  if (
    payload.usage !== expected.usage ||
    payload.subject !== expected.subject ||
    payload.grade !== expected.grade ||
    (expected.source !== undefined && payload.source !== expected.source) ||
    (expected.campaignId !== undefined && payload.campaignId !== expected.campaignId) ||
    (expected.binding !== undefined && payload.binding !== expected.binding) ||
    (expected.leadEmailHash !== undefined && payload.leadEmailHash !== expected.leadEmailHash) ||
    (expected.studentEmail !== undefined &&
      payload.binding === 'lead' &&
      payload.leadEmailHash !== undefined &&
      normalizeEmail(expected.studentEmail) !== buildAssessmentAliasEmail(payload.leadEmailHash))
  ) {
    return { valid: false, reason: 'scope_mismatch' };
  }

  return { valid: true, payload };
}

export function verifyAssessmentFlowToken(
  token: string | null | undefined,
  expected: { source?: string } = {},
  options: { now?: number } = {},
): AssessmentFlowTokenVerification {
  const verification = verifySignatureAndParse(
    token,
    assessmentFlowTokenPayloadSchema,
    options,
  );
  if (!verification.ok) return { valid: false, reason: verification.reason };
  const payload = verification.payload;

  if (expected.source !== undefined && payload.source !== expected.source) {
    return { valid: false, reason: 'scope_mismatch' };
  }

  return { valid: true, payload };
}

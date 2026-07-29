import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const BILAN_FLOW_COOKIE_NAME = 'nr_bf_s' as const;
export const BILAN_FLOW_SESSION_TTL_SECONDS = 30 * 60;
export const BILAN_MAGIC_LINK_TTL_SECONDS = 15 * 60;

type TokenCookieOptions = Readonly<{
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/bilan-gratuit';
  maxAge: number;
}>;

export type BilanFlowCookie = Readonly<{
  name: typeof BILAN_FLOW_COOKIE_NAME;
  value: string;
  options: TokenCookieOptions;
}>;

export type BilanTokenMaterial = Readonly<{
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}>;

export type BilanFlowSessionToken = BilanTokenMaterial & Readonly<{
  cookie: BilanFlowCookie;
}>;

type TokenCreationOptions = Readonly<{
  now?: Date;
}>;

type FlowTokenCreationOptions = TokenCreationOptions & Readonly<{
  production?: boolean;
}>;

type FlowSessionRecord = Readonly<{
  requestId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}>;

type FlowSessionValidation = Readonly<{
  rawToken: string;
  requestId: string;
  now?: Date;
}>;

type MagicLinkRecord = Readonly<{
  requestId: string;
  parentUserId: string | null;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
}>;

type MagicLinkValidation = Readonly<{
  rawToken: string;
  requestId: string;
  parentUserId?: string | null;
  now?: Date;
}>;

function createRawBilanToken(): string {
  return randomBytes(32).toString('base64url');
}

function expiresAfter(now: Date, ttlSeconds: number): Date {
  return new Date(now.getTime() + ttlSeconds * 1_000);
}

export function hashBilanToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function isBilanTokenHashEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function createBilanFlowSessionToken(
  options: FlowTokenCreationOptions = {},
): BilanFlowSessionToken {
  const now = options.now ?? new Date();
  const rawToken = createRawBilanToken();
  const production = options.production ?? process.env.NODE_ENV === 'production';

  return {
    rawToken,
    tokenHash: hashBilanToken(rawToken),
    expiresAt: expiresAfter(now, BILAN_FLOW_SESSION_TTL_SECONDS),
    cookie: {
      name: BILAN_FLOW_COOKIE_NAME,
      value: rawToken,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: production,
        path: '/bilan-gratuit',
        maxAge: BILAN_FLOW_SESSION_TTL_SECONDS,
      },
    },
  };
}

export function createBilanMagicLinkToken(
  options: TokenCreationOptions = {},
): BilanTokenMaterial {
  const now = options.now ?? new Date();
  const rawToken = createRawBilanToken();

  return {
    rawToken,
    tokenHash: hashBilanToken(rawToken),
    expiresAt: expiresAfter(now, BILAN_MAGIC_LINK_TTL_SECONDS),
  };
}

export function isValidBilanFlowSession(
  record: FlowSessionRecord,
  expected: FlowSessionValidation,
): boolean {
  const now = expected.now ?? new Date();

  return record.requestId === expected.requestId
    && record.revokedAt === null
    && record.expiresAt.getTime() > now.getTime()
    && isBilanTokenHashEqual(record.tokenHash, hashBilanToken(expected.rawToken));
}

export function isValidBilanMagicLink(
  record: MagicLinkRecord,
  expected: MagicLinkValidation,
): boolean {
  const now = expected.now ?? new Date();

  return record.requestId === expected.requestId
    && (expected.parentUserId === undefined || record.parentUserId === expected.parentUserId)
    && record.revokedAt === null
    && record.consumedAt === null
    && record.expiresAt.getTime() > now.getTime()
    && isBilanTokenHashEqual(record.tokenHash, hashBilanToken(expected.rawToken));
}

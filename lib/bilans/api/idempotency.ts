import { createHash } from 'node:crypto';
import { CanonicalApiError } from './errors';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function parseIdempotencyKey(value: string | null): string {
  if (value === null || value.trim() === '') throw CanonicalApiError.badRequest('IDEMPOTENCY_KEY_REQUIRED');
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) throw CanonicalApiError.badRequest('IDEMPOTENCY_KEY_INVALID');
  return value;
}

export function idempotencyExpiresAt(now: Date): Date {
  return new Date(now.getTime() + IDEMPOTENCY_TTL_MS);
}

/** Hash JSON semantics (including Date.toJSON): object order is irrelevant, array order is not. */
export function canonicalPayloadHash(payload: unknown): string {
  let json: string | undefined;
  try {
    json = JSON.stringify(payload);
  } catch {
    throw new TypeError('IDEMPOTENCY_PAYLOAD_NOT_JSON');
  }
  if (json === undefined) throw new TypeError('IDEMPOTENCY_PAYLOAD_NOT_JSON');
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, item]) => [key, canonical(item)]));
    }
    return value;
  }
  return createHash('sha256').update(JSON.stringify(canonical(JSON.parse(json)))).digest('hex');
}

type IdempotencyCoordinate = Readonly<{ userId: string; route: string; key: string }>;
type StoredIdempotency = Readonly<{
  payloadHash?: string | null;
  response: unknown;
  responseStatus: number | null;
  expiresAt: Date;
}>;

type IdempotencyDelegate = Readonly<{
  findUnique(args: unknown): Promise<StoredIdempotency | null>;
  deleteMany(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
}>;

export type CanonicalTransaction = Readonly<{
  canonicalApiIdempotencyKey: IdempotencyDelegate;
}> & Record<string, unknown>;

export type IdempotencyDatabase = Readonly<{
  canonicalApiIdempotencyKey: IdempotencyDelegate;
  $transaction<T>(operation: (transaction: CanonicalTransaction) => Promise<T>): Promise<T>;
}>;

export type IdempotentHttpResult<T> = Readonly<{
  status: number;
  body: T;
  replayed: boolean;
}>;

function coordinateWhere(coordinate: IdempotencyCoordinate) {
  return { userId_route_key: coordinate };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function replay<T>(stored: StoredIdempotency | null, now: Date, payloadHash?: string): IdempotentHttpResult<T> | null {
  // Pre-deployment rows retain key-only replay until their original TTL expires.
  if (stored && stored.expiresAt > now && stored.payloadHash != null && payloadHash !== undefined && stored.payloadHash !== payloadHash) {
    throw CanonicalApiError.conflict('IDEMPOTENCY_CONFLICT');
  }
  if (
    stored === null
    || stored.expiresAt <= now
    || stored.responseStatus === null
    || stored.response === null
  ) return null;
  return { status: stored.responseStatus, body: stored.response as T, replayed: true };
}

export async function executeIdempotently<T>(input: Readonly<{
  prisma: IdempotencyDatabase;
  userId: string;
  route: string;
  key: string;
  now: Date;
  payloadHash?: string;
  action(transaction: CanonicalTransaction): Promise<Readonly<{ status: number; body: T }>>;
}>): Promise<IdempotentHttpResult<T>> {
  const coordinate = { userId: input.userId, route: input.route, key: input.key };
  const existing = replay<T>(await input.prisma.canonicalApiIdempotencyKey.findUnique({
    where: coordinateWhere(coordinate),
    select: { response: true, responseStatus: true, expiresAt: true, payloadHash: true },
  }), input.now, input.payloadHash);
  if (existing !== null) return existing;

  try {
    return await input.prisma.$transaction(async (transaction) => {
      await transaction.canonicalApiIdempotencyKey.deleteMany({
        where: { ...coordinate, expiresAt: { lte: input.now } },
      });
      await transaction.canonicalApiIdempotencyKey.create({
        data: { ...coordinate, ...(input.payloadHash === undefined ? {} : { payloadHash: input.payloadHash }), expiresAt: idempotencyExpiresAt(input.now) },
      });
      const result = await input.action(transaction);
      await transaction.canonicalApiIdempotencyKey.update({
        where: coordinateWhere(coordinate),
        data: { response: result.body, responseStatus: result.status },
      });
      return { ...result, replayed: false };
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const committed = replay<T>(await input.prisma.canonicalApiIdempotencyKey.findUnique({
      where: coordinateWhere(coordinate),
      select: { response: true, responseStatus: true, expiresAt: true, payloadHash: true },
    }), input.now, input.payloadHash);
    if (committed !== null) return committed;
    throw error;
  }
}

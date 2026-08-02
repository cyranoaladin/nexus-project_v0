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

type IdempotencyCoordinate = Readonly<{ userId: string; route: string; key: string }>;
type StoredIdempotency = Readonly<{
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

function replay<T>(stored: StoredIdempotency | null, now: Date): IdempotentHttpResult<T> | null {
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
  action(transaction: CanonicalTransaction): Promise<Readonly<{ status: number; body: T }>>;
}>): Promise<IdempotentHttpResult<T>> {
  const coordinate = { userId: input.userId, route: input.route, key: input.key };
  const existing = replay<T>(await input.prisma.canonicalApiIdempotencyKey.findUnique({
    where: coordinateWhere(coordinate),
    select: { response: true, responseStatus: true, expiresAt: true },
  }), input.now);
  if (existing !== null) return existing;

  try {
    return await input.prisma.$transaction(async (transaction) => {
      await transaction.canonicalApiIdempotencyKey.deleteMany({
        where: { ...coordinate, expiresAt: { lte: input.now } },
      });
      await transaction.canonicalApiIdempotencyKey.create({
        data: { ...coordinate, expiresAt: idempotencyExpiresAt(input.now) },
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
      select: { response: true, responseStatus: true, expiresAt: true },
    }), input.now);
    if (committed !== null) return committed;
    throw error;
  }
}

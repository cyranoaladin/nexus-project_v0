import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '@/core-v2/generated/client';
import type { Actor } from '../rbac';
import type { PrivateV1Session } from '@/lib/auth/private-v1-session';

export interface ServiceContext {
  readonly actor: Actor;
  /** One id per staff action; every audit row and error of that action carries it. */
  readonly correlationId: string;
  readonly now: () => Date;
  /** HTTP V1 authority captured from the original encrypted request cookie.
   * Undefined is reserved for trusted non-HTTP commands; null refuses HTTP. */
  readonly v1RequestAuthority?: PrivateV1Session | null;
}

export function createServiceContext(actor: Actor, options: { correlationId?: string; now?: () => Date; v1RequestAuthority?: PrivateV1Session | null } = {}): ServiceContext {
  return {
    actor,
    correlationId: options.correlationId ?? randomUUID(),
    now: options.now ?? (() => new Date()),
    v1RequestAuthority: options.v1RequestAuthority,
  };
}

export type Tx = Prisma.TransactionClient;

export function inTransaction<T>(client: PrismaClient, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return client.$transaction(fn);
}

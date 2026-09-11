import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '@/core-v2/generated/client';
import type { Actor } from '../rbac';

export interface ServiceContext {
  readonly actor: Actor;
  /** One id per staff action; every audit row and error of that action carries it. */
  readonly correlationId: string;
  readonly now: () => Date;
}

export function createServiceContext(actor: Actor, options: { correlationId?: string; now?: () => Date } = {}): ServiceContext {
  return {
    actor,
    correlationId: options.correlationId ?? randomUUID(),
    now: options.now ?? (() => new Date()),
  };
}

export type Tx = Prisma.TransactionClient;

export function inTransaction<T>(client: PrismaClient, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return client.$transaction(fn);
}

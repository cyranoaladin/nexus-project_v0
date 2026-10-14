import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAccountActivationRequired } from './parent-activation';
import type { PrivateV1Session } from './private-v1-session';
import { AriaAuthorityRevokedError, AriaAuthorityUnavailableError, isAriaAuthorityLoss } from '@/lib/aria/kernel/errors';

/** Preserve the ORIGINAL encrypted cookie's version. No password or PIN hash is read. */
async function verify(tx: Prisma.TransactionClient, claims: PrivateV1Session): Promise<void> {
  if (!Number.isSafeInteger(claims.sessionVersion) || claims.sessionVersion < 0 || !Number.isFinite(claims.expiresAt)
    || claims.expiresAt <= Date.now()) throw new AriaAuthorityRevokedError();
  const rows = await tx.$queryRaw<Array<{ id: string; role: UserRole; sessionVersion: number; activatedAt: Date | null;
    disabledAt: Date | null; mergedIntoUserId: string | null; hasPersonalCode: boolean }>>`
    SELECT id, role, "sessionVersion", "activatedAt", "disabledAt", "mergedIntoUserId", ("pinHash" IS NOT NULL) AS "hasPersonalCode"
    FROM public.users WHERE id = ${claims.userId} FOR SHARE`;
  const row = rows[0];
  if (claims.expiresAt <= Date.now() || !row || row.role !== claims.role || row.sessionVersion !== claims.sessionVersion || row.disabledAt || row.mergedIntoUserId
    || (isAccountActivationRequired(row.role, row.activatedAt) && !(row.role === 'ELEVE' && row.hasPersonalCode))) throw new AriaAuthorityRevokedError();
}

/** Writes run in the authority transaction, so every error rolls them back.
 * Model/network work belongs outside this short transaction. */
export async function withV1SessionAuthority<T>(original: PrivateV1Session,
  operation: (tx: Prisma.TransactionClient) => Promise<T>, publish?: (value: T) => void): Promise<T> {
  const claims = Object.freeze({ ...original });
  return prisma.$transaction(async tx => {
    const check = async () => {
      try { await verify(tx, claims); }
      catch (error) { throw isAriaAuthorityLoss(error) ? error : new AriaAuthorityUnavailableError(); }
    };
    await check();
    const result = await operation(tx);
    await check();
    // A read stream publishes synchronously after the final verification,
    // while the identity and subject locks are still held.
    if (publish) {
      if (claims.expiresAt <= Date.now()) throw new AriaAuthorityRevokedError();
      publish(result);
    }
    return result;
  }, { timeout: 15_000 });
}
/** Core mutex must already be held. Keep this lease until Core's commit/rollback. */
export async function acquireV1SessionAuthority(claims: PrivateV1Session) {
  const bound = Object.freeze({ ...claims });
  let tx: Prisma.TransactionClient | undefined; let lost = false; let unlock!: () => void;
  let ready!: () => void; let rejectReady!: (error: unknown) => void;
  const gate = new Promise<void>(resolve => { unlock = resolve; });
  const acquired = new Promise<void>((resolve, reject) => { ready = resolve; rejectReady = reject; });
  const pending = prisma.$transaction(async current => {
    tx = current;
    await current.$executeRawUnsafe("SET LOCAL application_name = 'nexus-v1-aria-authority'");
    await verify(current, bound); ready(); await gate;
  }, { timeout: 15_000 });
  void pending.catch(error => { lost = true; rejectReady(isAriaAuthorityLoss(error) ? error : new AriaAuthorityUnavailableError()); });
  try { await acquired; } catch (error) { unlock(); await pending.catch(() => undefined); throw error; }
  return {
    async verify() {
      if (lost || !tx) throw new AriaAuthorityUnavailableError();
      try { await verify(tx, bound); } catch (error) { throw isAriaAuthorityLoss(error) ? error : new AriaAuthorityUnavailableError(); }
      if (lost) throw new AriaAuthorityUnavailableError();
    },
    async release() { unlock(); try { await pending; } catch { throw new AriaAuthorityUnavailableError(); } },
  };
}

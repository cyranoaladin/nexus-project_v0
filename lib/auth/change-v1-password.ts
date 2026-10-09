import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { PrismaClient, UserRole } from '@prisma/client';
import { ApiError } from '@/lib/api/errors';
import { isAccountActivationRequired } from '@/lib/auth/parent-activation';
import { newPasswordSchema } from '@/lib/security/password-policy';

export type V1PasswordActor = Readonly<{
  userId: string;
  role: UserRole;
  sessionVersion: number;
  authority: 'V1' | 'CORE_V2';
}>;

const inputSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: newPasswordSchema,
}).strict();

type AccountState = Readonly<{
  password: string | null; role: UserRole; sessionVersion: number;
  activatedAt: Date | null; mergedIntoUserId: string | null;
}>;

function assertEligible(user: AccountState | null, actor: V1PasswordActor): asserts user is AccountState {
  if (!user || !user.password || user.role !== actor.role || user.mergedIntoUserId
    || isAccountActivationRequired(user.role, user.activatedAt)) {
    throw ApiError.forbidden('Ce compte ne permet pas cette opération.');
  }
  if (user.sessionVersion !== actor.sessionVersion) {
    throw ApiError.conflict('Reconnectez-vous avant de réessayer.');
  }
}

/** The actor is a server-validated JWT snapshot, never a request-body identity. */
export async function changeV1Password(
  client: PrismaClient,
  actor: V1PasswordActor,
  rawInput: unknown,
  correlationId: string,
): Promise<void> {
  const input = inputSchema.safeParse(rawInput);
  if (!input.success || !z.string().uuid().safeParse(correlationId).success) {
    throw ApiError.badRequest('Données invalides.');
  }
  if (actor.authority !== 'V1' || !actor.userId || !Number.isSafeInteger(actor.sessionVersion)
    || actor.sessionVersion < 0) throw ApiError.forbidden('Session invalide.');

  const account = await client.user.findUnique({ where: { id: actor.userId } });
  assertEligible(account, actor);
  if (!await bcrypt.compare(input.data.currentPassword, account.password!)) {
    throw ApiError.forbidden('Vérifiez votre mot de passe actuel.');
  }
  // Expensive hashing happens outside the row lock; CAS rechecks the snapshot.
  const password = await bcrypt.hash(input.data.newPassword, 12);

  await client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${actor.userId} FOR UPDATE`;
    const locked = await tx.user.findUnique({ where: { id: actor.userId } });
    assertEligible(locked, actor);
    if (locked.password !== account.password) {
      throw ApiError.conflict('Reconnectez-vous avant de réessayer.');
    }
    const changed = await tx.user.updateMany({
      where: {
        id: actor.userId, role: actor.role, password: account.password,
        sessionVersion: actor.sessionVersion, mergedIntoUserId: null,
        ...(isAccountActivationRequired(actor.role, null) ? { activatedAt: { not: null } } : {}),
      },
      data: { password, sessionVersion: { increment: 1 }, activationToken: null, activationExpiry: null },
    });
    if (changed.count !== 1) throw ApiError.conflict('Reconnectez-vous avant de réessayer.');
    await tx.parentPhoneChallenge.updateMany({
      where: { userId: actor.userId, purpose: 'RECOVERY', consumedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.accountSecurityEvent.create({ data: {
      userId: actor.userId, kind: 'PASSWORD_CHANGED',
      sessionVersion: actor.sessionVersion + 1, correlationId,
    } });
  });
}

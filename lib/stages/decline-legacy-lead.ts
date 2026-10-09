import { z } from 'zod';
import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac/permissions';

export const legacyStageDecisionSchema = z.object({
  reservationId: z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  action: z.enum(['approve', 'reject']), requestId: z.string().uuid().transform(value => value.toLowerCase()),
}).strict();

export type LeadDeclineResult = 'DECLINED' | 'NOT_FOUND' | 'WORKFLOW_REQUIRED' | 'COMMAND_CONFLICT' | 'STATE_CONFLICT' | 'FORBIDDEN';

/** A lead decline cannot cancel a linked admission, refund or assert settlement. */
export async function declineLegacyStageLead(input: Readonly<{
  actorAuthority: 'V1'; actorUserId: string; reservationId: string; requestId: string;
}>): Promise<LeadDeclineResult> {
  if (input.actorAuthority !== 'V1') return 'FORBIDDEN';
  const actorUserId = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).parse(input.actorUserId);
  const { reservationId, requestId } = legacyStageDecisionSchema.parse({ reservationId: input.reservationId, requestId: input.requestId, action: 'reject' });
  const requestKey = `${actorUserId}:${requestId}`;
  try {
    return await prisma.$transaction(async tx => {
      if (!await lockAuthorizedActor(tx, actorUserId)) return 'FORBIDDEN';
      const previousCommand = await tx.stageReservationDecisionAudit.findUnique({ where: { requestKey }, select: { reservationId: true } });
      if (previousCommand) return previousCommand.reservationId === reservationId ? 'DECLINED' : 'COMMAND_CONFLICT';
      const lead = await tx.stageReservation.findUnique({ where: { id: reservationId },
        select: { id: true, status: true, stageId: true, studentId: true, paymentStatus: true, paymentRef: true, richStatus: true, confirmedAt: true, activationToken: true, activationTokenExpiresAt: true } });
      if (!lead) return 'NOT_FOUND';
      if (lead.status !== 'PENDING' && lead.status !== 'PENDING_BANK_TRANSFER') return observeWinningCommand(tx, requestKey, reservationId);
      if (lead.stageId || lead.studentId || lead.paymentRef || lead.confirmedAt || lead.activationToken || lead.activationTokenExpiresAt ||
        (lead.richStatus !== null && lead.richStatus !== 'PENDING') ||
        (lead.paymentStatus !== null && lead.paymentStatus !== 'PENDING' && lead.paymentStatus !== 'FAILED')) return 'WORKFLOW_REQUIRED';
      const changed = await tx.stageReservation.updateMany({
        where: { id: lead.id, status: lead.status, stageId: null, studentId: null,
          paymentStatus: lead.paymentStatus, paymentRef: null, richStatus: lead.richStatus,
          confirmedAt: null, activationToken: null, activationTokenExpiresAt: null },
        data: { status: 'CANCELLED', richStatus: 'CANCELLED', cancelledAt: new Date() },
    });
    if (changed.count !== 1) return observeWinningCommand(tx, requestKey, reservationId);
    await tx.stageReservationDecisionAudit.create({ data: {
      reservationId: lead.id, actorUserId: actorUserId, requestKey,
      action: 'LEAD_DECLINED', previousStatus: lead.status, nextStatus: 'CANCELLED',
      previousRichStatus: lead.richStatus, nextRichStatus: 'CANCELLED',
    } });
    return 'DECLINED';
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      // The failed transaction has rolled back before checking the winner.
      return prisma.$transaction(async tx => {
        if (!await lockAuthorizedActor(tx, actorUserId)) return 'FORBIDDEN';
        return observeWinningCommand(tx, requestKey, reservationId);
      });
    }
    throw error;
  }
}

/** V1-only boundary: a Core identity cannot borrow authority from a V1 mirror. */
async function lockAuthorizedActor(tx: Prisma.TransactionClient, actorUserId: string): Promise<boolean> {
  const actors = await tx.$queryRaw<Array<{ role: UserRole; mergedIntoUserId: string | null }>>`
    SELECT "role", "mergedIntoUserId" FROM "users" WHERE "id" = ${actorUserId} FOR SHARE`;
  const actor = actors[0];
  return Boolean(actor && !actor.mergedIntoUserId && can(actor.role, 'UPDATE', 'RESERVATION'));
}

async function observeWinningCommand(db: Pick<Prisma.TransactionClient, 'stageReservationDecisionAudit'>, requestKey: string, reservationId: string): Promise<LeadDeclineResult> {
  const winner = await db.stageReservationDecisionAudit.findUnique({ where: { requestKey }, select: { reservationId: true } });
  if (!winner) return 'STATE_CONFLICT';
  return winner.reservationId === reservationId ? 'DECLINED' : 'COMMAND_CONFLICT';
}

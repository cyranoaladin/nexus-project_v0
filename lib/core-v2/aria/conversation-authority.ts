import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@/core-v2/generated/client';
import { getAuthRolloutMode } from '@/lib/core-v2/auth/rollout';
import type { PrivateV1Session } from '@/lib/auth/private-v1-session';
import { acquireV1SessionAuthority } from '@/lib/auth/v1-session-authority';
import { AriaAuthorityRevokedError, AriaAuthorityUnavailableError, AriaError, isAriaAuthorityLoss } from '@/lib/aria/kernel/errors';
import { CoreV2DomainError, ForbiddenError } from '@/lib/core-v2/errors';
import { loadCoreV2AriaAccessGrants, buildCoreV2AriaEntitlements } from './access-grants';
import { isAriaCourseEntitled, resolveAriaCapabilities } from '@/lib/aria/kernel/entitlements';
import type { AriaConversationRepository } from '@/lib/aria/application/conversation/ports';
import type { ServiceContext } from '@/lib/core-v2/services/context';
import { resolveActor } from '@/lib/core-v2/http/actor';
import { buildCoreV2AriaConversationContext } from './conversation-context';
import { CoreV2AriaConversationRepository } from './conversation-repository';
import { getAriaCourse } from '@/lib/aria/curriculum/catalog';
import { assertSelfServiceRole } from '@/lib/core-v2/rbac';

type Tx = Prisma.TransactionClient;
type ContextInput = { readonly courseKey: string; readonly conversationId?: string; readonly skillId?: string };

/** Own metadata and stop-only operations do not depend on a CHAT grant. */
export async function withCoreV2AriaActor<T>(client: PrismaClient, original: PrivateV1Session,
  ctx: ServiceContext, operation: (tx: Tx, current: ServiceContext) => Promise<T>): Promise<T> {
  const claims = Object.freeze({ ...original });
  if (getAuthRolloutMode() !== 'V1_ONLY' || ctx.actor.userId !== claims.userId) throw new AriaAuthorityRevokedError();
  let lease: Awaited<ReturnType<typeof acquireV1SessionAuthority>> | undefined;
  let operationStarted = false;
  try {
    return await client.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242, 1026)`;
      lease = await acquireV1SessionAuthority(claims);
      const actor = await resolveActor(tx, claims.userId);
      assertSelfServiceRole(actor, 'ELEVE');
      const current = { ...ctx, actor, now: () => new Date() };
      await lease.verify();
      operationStarted = true;
      const value = await operation(tx, current);
      await lease.verify();
      return value;
    }, { timeout: 5_000 });
  } catch (error) {
    if (!operationStarted && !(error instanceof AriaError) && !(error instanceof CoreV2DomainError)) throw new AriaAuthorityUnavailableError();
    throw error;
  } finally { await lease?.release(); }
}
/** All underlying tables acquire the same statement lock, including direct writers. */
async function authorityStamp(tx: Tx, userId: string): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ stamp: string }>>`
    SELECT jsonb_build_object('user', u."invitationScopeVersion", 'student', s."invitationScopeVersion",
      'enrollment', e.id, 'enrollmentVersion', e."invitationScopeVersion", 'year', y."invitationScopeVersion",
      'courses', (SELECT jsonb_agg(jsonb_build_array(c.id, c."invitationScopeVersion") ORDER BY c.id)
        FROM public.student_course_enrollments c WHERE c."academicYearEnrollmentId" = e.id),
      'grants', (SELECT jsonb_agg(jsonb_build_array(g.id, g."invitationScopeVersion") ORDER BY g.id)
        FROM public.aria_access_grants_core_v2 g WHERE g."studentId" = s.id))::text AS stamp
    FROM public.users u JOIN public.students_v2 s ON s."userId" = u.id
    JOIN public.student_academic_year_enrollments e ON e."studentId" = s.id AND e.status = 'ACTIVE'
    JOIN public.academic_years y ON y.id = e."academicYearId" AND y.status = 'CURRENT'
    WHERE u.id = ${userId}`;
  if (rows.length !== 1) throw new AriaAuthorityRevokedError();
  return createHash('sha256').update(rows[0]!.stamp).digest('hex');
}

/** Request-local closure. Neither the cookie nor its claims are persisted in Core. */
export async function authorizeCoreV2AriaConversation(client: PrismaClient, original: PrivateV1Session,
  ctx: ServiceContext, input: ContextInput) {
  const claims = Object.freeze({ ...original }); const boundInput = Object.freeze({ ...input });
  if (getAuthRolloutMode() !== 'V1_ONLY' || ctx.actor.userId !== claims.userId) throw new AriaAuthorityRevokedError();
  let expectedStamp: string | undefined; let expectedSubject: string | undefined;
  let loss: AriaAuthorityRevokedError | AriaAuthorityUnavailableError | undefined;
  async function run<T>(operation: (tx: Tx, current: Awaited<ReturnType<typeof buildCoreV2AriaConversationContext>>) => Promise<T>): Promise<T> {
    if (loss) throw loss;
    let lease: Awaited<ReturnType<typeof acquireV1SessionAuthority>> | undefined;
    let operationStarted = false;
    try {
      return await client.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242, 1026)`;
        let current: Awaited<ReturnType<typeof buildCoreV2AriaConversationContext>>;
        let grants: Awaited<ReturnType<typeof loadCoreV2AriaAccessGrants>>;
        try {
          lease = await acquireV1SessionAuthority(claims);
          const actor = await resolveActor(tx, claims.userId);
          current = await buildCoreV2AriaConversationContext(tx, { ...ctx, actor, now: () => new Date() }, boundInput);
          const stamp = await authorityStamp(tx, claims.userId);
          if ((expectedStamp !== undefined && stamp !== expectedStamp)
            || (expectedSubject !== undefined && current.subject.studentId !== expectedSubject)) throw new AriaAuthorityRevokedError();
          expectedStamp ??= stamp; expectedSubject ??= current.subject.studentId;
          grants = await loadCoreV2AriaAccessGrants(tx, current.subject.studentId);
          await lease.verify();
        } catch (error) {
          if (expectedStamp === undefined && ((error instanceof AriaError && !isAriaAuthorityLoss(error)) || error instanceof CoreV2DomainError)) throw error;
          loss = isAriaAuthorityLoss(error) ? error : error instanceof ForbiddenError || error instanceof AriaError
            ? new AriaAuthorityRevokedError() : new AriaAuthorityUnavailableError();
          throw loss;
        }
        // Time-based rights are checked after the final awaited SELECT, just
        // before a synchronous emitter or an atomic database operation.
        function assertLiveNow() {
          const feature = getAriaCourse(boundInput.courseKey)?.requiredFeature;
          const validNow = feature ? buildCoreV2AriaEntitlements(grants, new Date()).byFeatureKey.get(feature) : undefined;
          if (claims.expiresAt <= Date.now() || !validNow || !isAriaCourseEntitled(validNow, boundInput.courseKey)
            || !resolveAriaCapabilities(validNow.tier).chat) { loss = new AriaAuthorityRevokedError(); throw loss; }
        }
        assertLiveNow();
        operationStarted = true;
        const value = await operation(tx, current);
        try { await lease.verify(); } catch (error) { loss = isAriaAuthorityLoss(error) ? error : new AriaAuthorityUnavailableError(); throw loss; }
        assertLiveNow();
        return value;
      }, { timeout: 5_000 });
    } catch (error) {
      if (!operationStarted && !(error instanceof AriaError) && !(error instanceof ForbiddenError)) {
        loss = new AriaAuthorityUnavailableError(); throw loss;
      }
      throw error;
    } finally { await lease?.release(); }
  }
  const context = await run(async (_tx, current) => current);
  async function invoke<T>(operation: (repository: CoreV2AriaConversationRepository) => Promise<T>): Promise<T> {
    return run(tx => operation(new CoreV2AriaConversationRepository(tx)));
  }
  function assertSubject(value: { actorUserId?: string; subjectStudentId?: string; courseKey?: string }) {
    if ((value.actorUserId !== undefined && value.actorUserId !== claims.userId)
      || (value.subjectStudentId !== undefined && value.subjectStudentId !== expectedSubject)
      || (value.courseKey !== undefined && value.courseKey !== boundInput.courseKey)) throw new AriaAuthorityRevokedError();
  }
  const repository: AriaConversationRepository = {
    findTurnReservation: value => { assertSubject(value); return invoke(repo => repo.findTurnReservation(value)); },
    reserveTurn: value => { assertSubject(value); return invoke(repo => repo.reserveTurn(value)); },
    claimTurn: value => { assertSubject(value); return invoke(repo => repo.claimTurn(value)); },
    loadRecentCompletedTurns: value => { assertSubject(value); return invoke(repo => repo.loadRecentCompletedTurns(value)); },
    checkpointRetrieval: value => invoke(repo => repo.checkpointRetrieval(value)),
    finalizeTurn: value => invoke(repo => repo.finalizeTurn(value)),
    loadTurnResult: value => { assertSubject(value); return invoke(repo => repo.loadTurnResult(value)); },
    requestCancellation: value => { assertSubject(value); return invoke(repo => repo.requestCancellation(value)); },
    heartbeatTurn: value => invoke(repo => repo.heartbeatTurn(value)),
    withAuthority: operation => run(async () => operation()),
    async retireRevokedTurn(value) {
      if (!loss) {
        try { await run(async () => undefined); return false; }
        catch (error) { if (!isAriaAuthorityLoss(error)) throw error; }
      }
      // Exact fenced terminalization only. No content is accepted as input.
      return client.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242, 1026)`;
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM public.aria_conversation_turns_core_v2 WHERE id = ${value.turnId}
          AND "conversationId" = ${value.conversationId} AND "actorUserId" = ${claims.userId}
          AND "subjectStudentId" = ${expectedSubject!}
          AND ((status = 'RUNNING' AND "executionToken" = ${value.executionToken})
            OR (status = 'PENDING' AND "executionToken" IS NULL AND ${value.executionToken}::text IS NULL)) FOR UPDATE`;
        if (rows.length !== 1) return false;
        const message = await tx.ariaMessageCoreV2.findFirst({ where: { id: value.assistantMessageId,
          turnId: value.turnId, conversationId: value.conversationId, role: 'ASSISTANT' }, select: { id: true } });
        if (!message) throw new AriaAuthorityRevokedError();
        const jobs = await tx.$queryRaw<Array<{ id: string; status: string }>>`
          SELECT id, status::text FROM public.core_v2_job_outbox WHERE "aggregateType" = 'AriaConversationTurnCoreV2'
          AND "aggregateId" = ${value.turnId} AND "jobType" = 'RECOVER_ARIA_TURN'
          AND "idempotencyKey" = ${`aria-turn-watchdog:${value.turnId}`} FOR UPDATE`;
        if (jobs.length !== 1 || !['PENDING', 'LEASED', 'RETRY_SCHEDULED'].includes(jobs[0]!.status)) throw new AriaAuthorityUnavailableError();
        const now = new Date();
        const reasonCode = loss instanceof AriaAuthorityUnavailableError ? 'ARIA_AUTHORITY_UNAVAILABLE' : 'ARIA_AUTHORITY_REVOKED';
        const failureCode = loss instanceof AriaAuthorityUnavailableError ? 'INTERNAL_ERROR' : 'NOT_ENTITLED';
        await tx.ariaConversationTurnCoreV2.update({ where: { id: value.turnId }, data: {
          status: 'ERROR', completedAt: now, heartbeatAt: now, leaseExpiresAt: null,
          executionMetadata: { failureCode, reasonCode },
        } });
        await tx.ariaMessageCitationCoreV2.deleteMany({ where: { messageId: message.id } });
        await tx.ariaMessageCoreV2.update({ where: { id: message.id }, data: { content: '', metadata: { failureCode, reasonCode } } });
        await tx.coreV2JobOutbox.update({ where: { id: jobs[0]!.id },
        data: { status: 'COMPLETED', completedAt: now, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
        return true;
      });
    },
  };
  return { context, repository };
}

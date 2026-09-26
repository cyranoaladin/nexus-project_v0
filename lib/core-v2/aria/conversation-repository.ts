import {
  AriaConversationMessageRole,
  AriaConversationTurnStatus,
  AriaConversationTurnUseCase,
  AriaVisibility,
  CoreV2JobStatus,
  CoreV2JobType,
  Prisma,
} from '@/lib/core-v2/client';
import type { PrismaClient } from '@/core-v2/generated/client';
import type {
  AriaConversationRepository,
  ClaimedTurnRecord,
  ClaimTurnRepositoryInput,
  CheckpointTurnRetrievalInput,
  FinalizeTurnInput,
  FindTurnReservationInput,
  HeartbeatTurnInput,
  HeartbeatTurnRecord,
  LoadTurnResultInput,
  PersistedTurnResult,
  RequestTurnCancellationInput,
  ReservedTurnRecord,
  ReserveTurnRepositoryInput,
  TurnCancellationRecord,
} from '@/lib/aria/application/conversation/ports';
import type { AriaHistoryTurn } from '@/lib/aria/domain/conversation/history-budget';
import { isTerminalAriaTurnStatus, type AriaTurnStatus } from '@/lib/aria/domain/conversation/turn-state';
import { isAriaRagStatus } from '@/lib/aria/domain/retrieval/policy';
import { assertAriaCitationsMatchRetrievalEvidence } from '@/lib/aria/application/conversation/retrieval-evidence';
import {
  canonicalizeAriaCitationForPersistence,
  projectPersistedAriaReplayCitation,
} from '@/lib/aria/infrastructure/prisma/persisted-citation';
import { AriaError } from '@/lib/aria/kernel/errors';
import type { AriaErrorCode } from '@/lib/aria/kernel/errors';
import { isKnownAriaCourseKey } from '@/lib/aria/curriculum/catalog';
import { toCanonicalAriaCourseKey } from '@/lib/aria/curriculum/course-key-aliases';

const reservationMessages = {
  messages: { select: { id: true, role: true } },
} satisfies Prisma.AriaConversationTurnCoreV2Include;

type ReservationTurn = Prisma.AriaConversationTurnCoreV2GetPayload<{
  include: typeof reservationMessages;
}>;

function classify(turn: ReservationTurn, fingerprint: string): ReservedTurnRecord {
  if (turn.requestFingerprint !== fingerprint) {
    throw new AriaError('IDEMPOTENCY_CONFLICT', 409, 'Cette clé de requête est déjà associée à un autre contenu.');
  }
  const user = turn.messages.find((message) => message.role === AriaConversationMessageRole.USER);
  const assistant = turn.messages.find((message) => message.role === AriaConversationMessageRole.ASSISTANT);
  if (!user || !assistant) {
    throw new AriaError('INTERNAL_ERROR', 500, 'Le Turn ARIA est incomplet.', { reasonCode: 'TURN_MESSAGES_MISSING' });
  }
  const status = turn.status as AriaTurnStatus;
  return {
    turnId: turn.id,
    conversationId: turn.conversationId,
    userMessageId: user.id,
    assistantMessageId: assistant.id,
    status,
    disposition: isTerminalAriaTurnStatus(status) ? 'REPLAY' : 'IN_PROGRESS',
  };
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalJson(entry)]));
  }
  return value;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

function jsonObject(value: unknown): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

const persistedFailureCodes = new Set<AriaErrorCode>([
  'BAD_REQUEST', 'COURSE_NOT_FOUND', 'NOT_ENROLLED', 'NOT_ENTITLED', 'UNSUPPORTED',
  'CONVERSATION_NOT_FOUND', 'CONVERSATION_BUSY', 'IDEMPOTENCY_CONFLICT', 'CROSS_COURSE_MISMATCH',
  'SKILL_MISMATCH', 'RESOURCE_MISMATCH', 'RAG_UNAVAILABLE', 'MODEL_TIMEOUT', 'MODEL_UNAVAILABLE',
  'USER_CANCELLED', 'INTERNAL_ERROR',
]);

function readFailureCode(metadata: unknown): AriaErrorCode | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const value = (metadata as Record<string, unknown>).failureCode;
  return typeof value === 'string' && persistedFailureCodes.has(value as AriaErrorCode)
    ? value as AriaErrorCode
    : undefined;
}

export class CoreV2AriaConversationRepository implements AriaConversationRepository {
  constructor(private readonly client: PrismaClient) {}

  private findExisting(client: Pick<Prisma.TransactionClient, 'ariaConversationTurnCoreV2'>, input: FindTurnReservationInput) {
    return client.ariaConversationTurnCoreV2.findFirst({
      where: {
        actorUserId: input.actorUserId,
        subjectStudentId: input.subjectStudentId,
        useCase: AriaConversationTurnUseCase.CONVERSATION,
        clientRequestId: input.clientRequestId,
      },
      include: reservationMessages,
    });
  }

  async findTurnReservation(input: FindTurnReservationInput): Promise<ReservedTurnRecord | null> {
    const existing = await this.findExisting(this.client, input);
    return existing ? classify(existing, input.requestFingerprint) : null;
  }

  async reserveTurn(input: ReserveTurnRepositoryInput): Promise<ReservedTurnRecord> {
    return this.client.$transaction(async (tx) => {
      const scope = [input.actorUserId, input.subjectStudentId, 'CONVERSATION', input.clientRequestId].join(':');
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))`);
      const existing = await this.findExisting(tx, input);
      if (existing) return classify(existing, input.requestFingerprint);

      let conversationId: string;
      if (input.requestedConversationId) {
        const rows = await tx.$queryRaw<Array<{ id: string; studentId: string; courseKey: string }>>(Prisma.sql`
          SELECT id, "studentId", "courseKey" FROM aria_conversations_core_v2
          WHERE id = ${input.requestedConversationId} FOR UPDATE
        `);
        const conversation = rows[0];
        if (!conversation || conversation.studentId !== input.subjectStudentId) {
          throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation ARIA introuvable.');
        }
        if (conversation.courseKey !== input.courseKey) {
          throw new AriaError('CROSS_COURSE_MISMATCH', 409, 'La conversation appartient à un autre cours.');
        }
        conversationId = conversation.id;
      } else {
        const conversation = await tx.ariaConversationCoreV2.create({
          data: {
            studentId: input.subjectStudentId,
            courseKey: input.courseKey,
            skillId: input.skillId,
            resourceId: input.resourceId,
          },
          select: { id: true },
        });
        conversationId = conversation.id;
        await tx.$queryRaw(Prisma.sql`SELECT id FROM aria_conversations_core_v2 WHERE id = ${conversationId} FOR UPDATE`);
      }

      const active = await tx.ariaConversationTurnCoreV2.findFirst({
        where: { conversationId, status: { in: [AriaConversationTurnStatus.PENDING, AriaConversationTurnStatus.RUNNING] } },
        select: { id: true },
      });
      if (active) throw new AriaError('CONVERSATION_BUSY', 409, 'Une réponse ARIA est déjà en cours dans cette conversation.');

      const latest = await tx.ariaConversationTurnCoreV2.aggregate({ where: { conversationId }, _max: { sequence: true } });
      const turn = await tx.ariaConversationTurnCoreV2.create({
        data: {
          conversationId,
          subjectStudentId: input.subjectStudentId,
          actorUserId: input.actorUserId,
          useCase: AriaConversationTurnUseCase.CONVERSATION,
          clientRequestId: input.clientRequestId,
          requestFingerprint: input.requestFingerprint,
          sequence: (latest._max.sequence ?? 0) + 1,
          academicSnapshot: jsonObject(input.academicSnapshot),
          pedagogicalMode: input.pedagogicalMode,
          agentRole: input.agentRole,
          modelPolicy: jsonObject(input.modelPolicy),
          visibility: AriaVisibility.STUDENT_PRIVATE,
        },
        select: { id: true },
      });
      const userMessage = await tx.ariaMessageCoreV2.create({
        data: { conversationId, turnId: turn.id, role: AriaConversationMessageRole.USER, content: input.message },
        select: { id: true },
      });
      const assistantMessage = await tx.ariaMessageCoreV2.create({
        data: { conversationId, turnId: turn.id, role: AriaConversationMessageRole.ASSISTANT, content: '' },
        select: { id: true },
      });
      await tx.coreV2JobOutbox.create({
        data: {
          jobType: CoreV2JobType.RECOVER_ARIA_TURN,
          aggregateType: 'AriaConversationTurnCoreV2',
          aggregateId: turn.id,
          idempotencyKey: `aria-turn-watchdog:${turn.id}`,
          payload: { schemaVersion: 1, turnId: turn.id },
          status: CoreV2JobStatus.PENDING,
          availableAt: input.pendingRecoveryAt,
        },
      });
      await tx.ariaConversationCoreV2.update({ where: { id: conversationId }, data: { updatedAt: input.now } });
      return {
        turnId: turn.id,
        conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        status: 'PENDING' as const,
        disposition: 'RESERVED' as const,
      };
    }).catch((error: unknown) => {
      if (error instanceof AriaError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AriaError('CONVERSATION_BUSY', 409, 'Une réservation ARIA concurrente est déjà active.');
      }
      throw error;
    });
  }

  async claimTurn(input: ClaimTurnRepositoryInput): Promise<ClaimedTurnRecord> {
    return this.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; conversationId: string; actorUserId: string; subjectStudentId: string; status: AriaTurnStatus; executionToken: string | null; leaseExpiresAt: Date | null }>>(Prisma.sql`
        SELECT id, "conversationId", "actorUserId", "subjectStudentId", status::text, "executionToken", "leaseExpiresAt"
        FROM aria_conversation_turns_core_v2
        WHERE id = ${input.turnId} AND "conversationId" = ${input.conversationId}
        FOR UPDATE
      `);
      const turn = rows[0];
      if (!turn || turn.actorUserId !== input.actorUserId || turn.subjectStudentId !== input.subjectStudentId) throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Turn ARIA introuvable.');
      if (turn.status !== 'PENDING') return { turnId: input.turnId, conversationId: input.conversationId, status: turn.status, executionToken: turn.executionToken ?? undefined, leaseExpiresAt: turn.leaseExpiresAt ?? undefined, disposition: 'NOT_CLAIMED' };
      await tx.ariaConversationTurnCoreV2.update({ where: { id: input.turnId }, data: { status: AriaConversationTurnStatus.RUNNING, executionToken: input.executionToken, heartbeatAt: input.now, leaseExpiresAt: input.leaseExpiresAt, startedAt: input.now } });
      const jobs = await tx.$queryRaw<Array<{ id: string; status: CoreV2JobStatus }>>(Prisma.sql`
        SELECT id, status::text FROM core_v2_job_outbox
        WHERE "aggregateType" = 'AriaConversationTurnCoreV2' AND "aggregateId" = ${input.turnId}
          AND "idempotencyKey" = ${`aria-turn-watchdog:${input.turnId}`}
        FOR UPDATE
      `);
      if (!jobs[0] || jobs[0].status === CoreV2JobStatus.COMPLETED || jobs[0].status === CoreV2JobStatus.FAILED_FINAL) throw new AriaError('INTERNAL_ERROR', 500, 'Le watchdog ARIA est introuvable.', { reasonCode: 'TURN_WATCHDOG_MISSING' });
      await tx.coreV2JobOutbox.update({ where: { id: jobs[0].id }, data: { status: CoreV2JobStatus.PENDING, availableAt: input.leaseExpiresAt, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
      return { turnId: input.turnId, conversationId: input.conversationId, status: 'RUNNING', executionToken: input.executionToken, leaseExpiresAt: input.leaseExpiresAt, disposition: 'CLAIMED' };
    });
  }

  async loadRecentCompletedTurns(input: { conversationId: string; subjectStudentId: string; maxTurns: number }): Promise<readonly AriaHistoryTurn[]> {
    if (!Number.isInteger(input.maxTurns) || input.maxTurns < 1 || input.maxTurns > 50) throw new AriaError('BAD_REQUEST', 400, 'Budget d’historique ARIA invalide.');
    const turns = await this.client.ariaConversationTurnCoreV2.findMany({
      where: { conversationId: input.conversationId, subjectStudentId: input.subjectStudentId, status: AriaConversationTurnStatus.COMPLETED },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: input.maxTurns,
      select: { id: true, createdAt: true, messages: { select: { id: true, role: true, content: true } } },
    });
    return turns.map((turn) => {
      const user = turn.messages.find((message) => message.role === AriaConversationMessageRole.USER);
      const assistant = turn.messages.find((message) => message.role === AriaConversationMessageRole.ASSISTANT);
      if (!user || !assistant) throw new AriaError('INTERNAL_ERROR', 500, 'L’historique ARIA est incomplet.');
      return { turnId: turn.id, createdAt: turn.createdAt, user: { id: user.id, role: 'user' as const, content: user.content }, assistant: { id: assistant.id, role: 'assistant' as const, content: assistant.content } };
    });
  }

  async checkpointRetrieval(input: CheckpointTurnRetrievalInput): Promise<void> {
    assertAriaCitationsMatchRetrievalEvidence([], input.retrievalEvidence);
    await this.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: AriaTurnStatus; executionToken: string | null; retrievalPolicy: unknown; retrievalEvidence: unknown; ragStatus: string | null; policyVersion: string | null }>>(Prisma.sql`
        SELECT status::text, "executionToken", "retrievalPolicy", "retrievalEvidence", "ragStatus", "policyVersion"
        FROM aria_conversation_turns_core_v2 WHERE id = ${input.turnId} AND "conversationId" = ${input.conversationId} FOR UPDATE
      `);
      const turn = rows[0];
      if (!turn || turn.status !== 'RUNNING' || turn.executionToken !== input.executionToken) throw new AriaError('INTERNAL_ERROR', 500, 'Le Turn ARIA ne peut plus être modifié.');
      if (turn.retrievalEvidence !== null || turn.retrievalPolicy !== null || turn.ragStatus !== null || turn.policyVersion !== null) {
        if (!sameJson(turn.retrievalEvidence, input.retrievalEvidence) || !sameJson(turn.retrievalPolicy, input.retrievalPolicy) || turn.ragStatus !== input.ragStatus || turn.policyVersion !== input.policyVersion) throw new AriaError('INTERNAL_ERROR', 500, 'La provenance RAG du Turn est immuable.');
        return;
      }
      await tx.ariaConversationTurnCoreV2.update({ where: { id: input.turnId }, data: { retrievalPolicy: jsonObject(input.retrievalPolicy), retrievalEvidence: jsonObject(input.retrievalEvidence), ragStatus: input.ragStatus, policyVersion: input.policyVersion } });
    });
  }

  async finalizeTurn(input: FinalizeTurnInput): Promise<void> {
    const now = input.now ?? new Date();
    await this.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: AriaTurnStatus; executionToken: string | null; cancellationRequestedAt: Date | null; retrievalEvidence: unknown; ragStatus: string | null; courseKey: string }>>(Prisma.sql`
        SELECT t.status::text, t."executionToken", t."cancellationRequestedAt", t."retrievalEvidence", t."ragStatus", c."courseKey"
        FROM aria_conversation_turns_core_v2 t JOIN aria_conversations_core_v2 c ON c.id = t."conversationId"
        WHERE t.id = ${input.turnId} AND t."conversationId" = ${input.conversationId} FOR UPDATE OF t
      `);
      const turn = rows[0];
      if (!turn || turn.status !== 'RUNNING' || turn.executionToken !== input.executionToken) throw new AriaError('INTERNAL_ERROR', 500, 'La finalisation ARIA a perdu son verrou.');
      if (input.status === 'CANCELLED' && !turn.cancellationRequestedAt) throw new AriaError('INTERNAL_ERROR', 500, 'Aucune annulation ARIA n’a été demandée.');
      const checkpoint = turn.retrievalEvidence !== null || turn.ragStatus !== null;
      const evidence = checkpoint ? turn.retrievalEvidence : input.retrievalEvidence;
      const retrieved = assertAriaCitationsMatchRetrievalEvidence(input.citations, evidence);
      if (checkpoint && (!sameJson(turn.retrievalEvidence, input.retrievalEvidence) || turn.ragStatus !== input.ragStatus)) throw new AriaError('INTERNAL_ERROR', 500, 'La provenance RAG finale est incohérente.');
      if (!checkpoint && (input.status === 'COMPLETED' || input.ragStatus !== 'NOT_CONFIGURED' || !sameJson(input.retrievalEvidence, { schemaVersion: 1, hits: [] }) || input.citations.length > 0)) throw new AriaError('INTERNAL_ERROR', 500, 'Aucun retrieval RAG checkpointé ne correspond.');
      const canonicalCourseKey = toCanonicalAriaCourseKey(turn.courseKey);
      if (retrieved.some((citation) => citation.courseKey !== canonicalCourseKey)) throw new AriaError('INTERNAL_ERROR', 500, 'La citation appartient à un autre cours.');
      const citations = retrieved.map((citation) => canonicalizeAriaCitationForPersistence(citation, canonicalCourseKey));
      const jobs = await tx.$queryRaw<Array<{ id: string; status: CoreV2JobStatus }>>(Prisma.sql`
        SELECT id, status::text FROM core_v2_job_outbox
        WHERE "aggregateType" = 'AriaConversationTurnCoreV2' AND "aggregateId" = ${input.turnId}
          AND "idempotencyKey" = ${`aria-turn-watchdog:${input.turnId}`}
        FOR UPDATE
      `);
      if (!jobs[0] || jobs[0].status === CoreV2JobStatus.COMPLETED || jobs[0].status === CoreV2JobStatus.FAILED_FINAL) throw new AriaError('INTERNAL_ERROR', 500, 'Le watchdog ARIA est introuvable.', { reasonCode: 'TURN_WATCHDOG_MISSING' });
      const updated = await tx.ariaConversationTurnCoreV2.updateMany({ where: { id: input.turnId, conversationId: input.conversationId, status: AriaConversationTurnStatus.RUNNING, executionToken: input.executionToken, ...(input.status === 'CANCELLED' ? {} : { cancellationRequestedAt: null }) }, data: { status: input.status, retrievalEvidence: jsonObject(evidence), ragStatus: checkpoint ? turn.ragStatus : input.ragStatus, executionMetadata: jsonObject(input.executionMetadata), completedAt: now, heartbeatAt: now, leaseExpiresAt: null } });
      if (updated.count !== 1) throw new AriaError('INTERNAL_ERROR', 500, 'La finalisation ARIA a perdu son verrou.');
      const assistant = await tx.ariaMessageCoreV2.updateMany({ where: { id: input.assistantMessageId, conversationId: input.conversationId, turnId: input.turnId, role: AriaConversationMessageRole.ASSISTANT }, data: { content: input.content, metadata: jsonObject({ ...input.executionMetadata, ragStatus: input.ragStatus, citationCount: citations.length }) } });
      if (assistant.count !== 1) throw new AriaError('INTERNAL_ERROR', 500, 'Le message assistant ARIA est introuvable.');
      if (citations.length > 0) await tx.ariaMessageCitationCoreV2.createMany({ data: citations.map((citation) => ({ messageId: input.assistantMessageId, sourceTitle: citation.sourceTitle, sourceDocument: citation.sourceDocument, sourceLocation: citation.sourceLocation ?? null, courseKey: citation.courseKey, provenance: citation.provenance, url: citation.url, resourceId: citation.resourceId, resourceVersionId: citation.resourceVersionId, contentSha256: citation.contentSha256, chunkId: citation.chunkId, locator: jsonObject(citation.locator), corpusId: citation.corpusId, corpusVersionId: citation.corpusVersionId, manifestSha256: citation.manifestSha256 })) });
      await tx.coreV2JobOutbox.update({ where: { id: jobs[0].id }, data: { status: CoreV2JobStatus.COMPLETED, completedAt: now, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
      await tx.ariaConversationCoreV2.update({ where: { id: input.conversationId }, data: { updatedAt: now } });
    });
  }

  async loadTurnResult(input: LoadTurnResultInput): Promise<PersistedTurnResult> {
    const turn = await this.client.ariaConversationTurnCoreV2.findFirst({
      where: { id: input.turnId, actorUserId: input.actorUserId, subjectStudentId: input.subjectStudentId, useCase: AriaConversationTurnUseCase.CONVERSATION, status: { in: [AriaConversationTurnStatus.COMPLETED, AriaConversationTurnStatus.CANCELLED, AriaConversationTurnStatus.ERROR] } },
      select: { id: true, conversationId: true, status: true, ragStatus: true, retrievalEvidence: true, executionMetadata: true, conversation: { select: { courseKey: true } }, messages: { where: { role: AriaConversationMessageRole.ASSISTANT }, select: { id: true, content: true, citations: { select: { id: true, sourceTitle: true, sourceDocument: true, sourceLocation: true, courseKey: true, provenance: true, url: true, resourceId: true, resourceVersionId: true, contentSha256: true, chunkId: true, locator: true, corpusId: true, corpusVersionId: true, manifestSha256: true } } } } },
    });
    if (!turn) throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Turn ARIA introuvable.');
    const assistant = turn.messages[0];
    if (!assistant || !isKnownAriaCourseKey(turn.conversation.courseKey)) throw new AriaError('INTERNAL_ERROR', 500, 'Le résultat du Turn ARIA est incomplet.');
    if (turn.ragStatus !== null && !isAriaRagStatus(turn.ragStatus)) throw new AriaError('INTERNAL_ERROR', 500, 'Le résultat du Turn ARIA est invalide.');
    return { turnId: turn.id, conversationId: turn.conversationId, assistantMessageId: assistant.id, status: turn.status as AriaTurnStatus, content: assistant.content, ragStatus: turn.ragStatus as PersistedTurnResult['ragStatus'], failureCode: readFailureCode(turn.executionMetadata), citations: assistant.citations.map((citation) => projectPersistedAriaReplayCitation({ row: citation, retrievalEvidence: turn.retrievalEvidence, expectedCourseKey: toCanonicalAriaCourseKey(turn.conversation.courseKey) })) };
  }

  async requestCancellation(input: RequestTurnCancellationInput): Promise<TurnCancellationRecord> {
    return this.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; conversationId: string; actorUserId: string; clientRequestId: string; status: AriaTurnStatus; executionToken: string | null; cancellationRequestedAt: Date | null }>>(Prisma.sql`
        SELECT id, "conversationId", "actorUserId", "clientRequestId", status::text, "executionToken", "cancellationRequestedAt"
        FROM aria_conversation_turns_core_v2 WHERE id = ${input.turnId} FOR UPDATE
      `);
      const turn = rows[0];
      if (!turn || turn.actorUserId !== input.actorUserId) throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Turn ARIA introuvable.');
      if (turn.clientRequestId !== input.clientRequestId) throw new AriaError('IDEMPOTENCY_CONFLICT', 409, 'La clé de requête ne correspond pas au Turn ARIA.');
      if (isTerminalAriaTurnStatus(turn.status as AriaTurnStatus)) return { turnId: turn.id, conversationId: turn.conversationId, status: turn.status as AriaTurnStatus, executionToken: turn.executionToken ?? undefined, disposition: 'TERMINAL_REPLAY' };
      const jobs = await tx.$queryRaw<Array<{ id: string; status: CoreV2JobStatus }>>(Prisma.sql`
        SELECT id, status::text FROM core_v2_job_outbox
        WHERE "aggregateType" = 'AriaConversationTurnCoreV2' AND "aggregateId" = ${turn.id}
          AND "idempotencyKey" = ${`aria-turn-watchdog:${turn.id}`}
        FOR UPDATE
      `);
      if (!jobs[0] || jobs[0].status === CoreV2JobStatus.COMPLETED || jobs[0].status === CoreV2JobStatus.FAILED_FINAL) throw new AriaError('INTERNAL_ERROR', 500, 'Le watchdog ARIA est indisponible.', { reasonCode: 'TURN_WATCHDOG_UNAVAILABLE' });
      if (turn.status === AriaConversationTurnStatus.PENDING) {
        await tx.ariaConversationTurnCoreV2.update({ where: { id: turn.id }, data: { status: AriaConversationTurnStatus.CANCELLED, cancellationRequestedAt: input.now, cancellationRequestedByActorId: input.actorUserId, completedAt: input.now, leaseExpiresAt: null } });
        await tx.coreV2JobOutbox.update({ where: { id: jobs[0].id }, data: { status: CoreV2JobStatus.COMPLETED, completedAt: input.now, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
        return { turnId: turn.id, conversationId: turn.conversationId, status: 'CANCELLED', disposition: 'CANCELLED' };
      }
      if (!turn.cancellationRequestedAt) await tx.ariaConversationTurnCoreV2.update({ where: { id: turn.id }, data: { cancellationRequestedAt: input.now, cancellationRequestedByActorId: input.actorUserId } });
      return { turnId: turn.id, conversationId: turn.conversationId, status: 'RUNNING', executionToken: turn.executionToken ?? undefined, disposition: 'CANCELLATION_REQUESTED' };
    });
  }

  async heartbeatTurn(input: HeartbeatTurnInput): Promise<HeartbeatTurnRecord> {
    return this.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: AriaTurnStatus; executionToken: string | null; cancellationRequestedAt: Date | null }>>(Prisma.sql`
        SELECT status::text, "executionToken", "cancellationRequestedAt"
        FROM aria_conversation_turns_core_v2
        WHERE id = ${input.turnId} AND "conversationId" = ${input.conversationId}
        FOR UPDATE
      `);
      const turn = rows[0];
      if (!turn || turn.status !== 'RUNNING' || turn.executionToken !== input.executionToken) return { disposition: 'LEASE_LOST' };
      if (turn.cancellationRequestedAt) return { disposition: 'CANCELLATION_REQUESTED' };
      const jobs = await tx.$queryRaw<Array<{ id: string; status: CoreV2JobStatus }>>(Prisma.sql`
        SELECT id, status::text FROM core_v2_job_outbox
        WHERE "aggregateType" = 'AriaConversationTurnCoreV2' AND "aggregateId" = ${input.turnId}
          AND "idempotencyKey" = ${`aria-turn-watchdog:${input.turnId}`}
        FOR UPDATE
      `);
      if (!jobs[0] || jobs[0].status === CoreV2JobStatus.COMPLETED || jobs[0].status === CoreV2JobStatus.FAILED_FINAL) throw new AriaError('INTERNAL_ERROR', 500, 'Le watchdog ARIA est indisponible.', { reasonCode: 'TURN_WATCHDOG_UNAVAILABLE' });
      await tx.ariaConversationTurnCoreV2.update({ where: { id: input.turnId }, data: { heartbeatAt: input.now, leaseExpiresAt: input.leaseExpiresAt } });
      await tx.coreV2JobOutbox.update({ where: { id: jobs[0].id }, data: { status: CoreV2JobStatus.PENDING, availableAt: input.leaseExpiresAt, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
      return { disposition: 'RENEWED' };
    });
  }
}

export async function getCoreV2AriaConversationRepository(): Promise<CoreV2AriaConversationRepository> {
  const { requireCoreV2Client } = await import('@/lib/core-v2/client');
  return new CoreV2AriaConversationRepository(await requireCoreV2Client());
}

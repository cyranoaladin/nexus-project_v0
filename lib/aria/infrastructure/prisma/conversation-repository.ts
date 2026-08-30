import {
  AriaConversationContextState,
  AriaConversationTurnMessageRole,
  AriaConversationTurnStatus,
  AriaConversationTurnUseCase,
  AriaVisibility,
  CanonicalJobType,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  AriaConversationRepository,
  ClaimedTurnRecord,
  ClaimTurnRepositoryInput,
  CheckpointTurnRetrievalInput,
  FinalizeTurnInput,
  HeartbeatTurnInput,
  HeartbeatTurnRecord,
  LoadTurnResultInput,
  PersistedTurnResult,
  RequestTurnCancellationInput,
  ReservedTurnRecord,
  ReserveTurnRepositoryInput,
  TurnCancellationRecord,
} from '../../application/conversation/ports';
import { isTerminalAriaTurnStatus, type AriaTurnStatus } from '../../domain/conversation/turn-state';
import type { AriaHistoryTurn } from '../../domain/conversation/history-budget';
import { AriaError } from '../../errors';
import { assertAriaCitationsMatchRetrievalEvidence } from '../../application/conversation/retrieval-evidence';
import type { AriaErrorCode } from '../../kernel/errors';
import {
  canonicalizeAriaCitationForPersistence,
  projectPersistedAriaReplayCitation,
} from './persisted-citation';

const ARIA_ERROR_CODES = new Set<AriaErrorCode>([
  'BAD_REQUEST', 'COURSE_NOT_FOUND', 'NOT_ENROLLED', 'NOT_ENTITLED', 'UNSUPPORTED',
  'CONVERSATION_NOT_FOUND', 'CONVERSATION_BUSY', 'IDEMPOTENCY_CONFLICT',
  'CROSS_COURSE_MISMATCH', 'SKILL_MISMATCH', 'RESOURCE_MISMATCH', 'RAG_UNAVAILABLE',
  'MODEL_TIMEOUT', 'MODEL_UNAVAILABLE', 'USER_CANCELLED', 'INTERNAL_ERROR',
]);

function readPersistedFailureCode(metadata: Prisma.JsonValue | null): AriaErrorCode | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const object = metadata as Prisma.JsonObject;
  const failureCode = object.failureCode ?? object.reasonCode;
  return typeof failureCode === 'string' && ARIA_ERROR_CODES.has(failureCode as AriaErrorCode)
    ? failureCode as AriaErrorCode
    : undefined;
}

const reservationInclude = {
  messages: { select: { id: true, turnRole: true } },
} satisfies Prisma.AriaConversationTurnInclude;

type ReservationTurn = Prisma.AriaConversationTurnGetPayload<{
  include: typeof reservationInclude;
}>;

function classifyExistingReservation(
  turn: ReservationTurn,
  requestFingerprint: string,
): ReservedTurnRecord {
  if (turn.requestFingerprint !== requestFingerprint) {
    throw new AriaError(
      'IDEMPOTENCY_CONFLICT',
      409,
      'Cette clé de requête est déjà associée à un autre contenu.',
    );
  }
  const userMessage = turn.messages.find((message) => message.turnRole === 'USER');
  const assistantMessage = turn.messages.find((message) => message.turnRole === 'ASSISTANT');
  if (!userMessage || !assistantMessage) {
    throw new AriaError(
      'INTERNAL_ERROR',
      500,
      'Une difficulté technique temporaire est survenue. Veuillez réessayer.',
      { operation: 'classifyTurnReservation', turnId: turn.id },
    );
  }
  const status = turn.status as AriaTurnStatus;
  return {
    turnId: turn.id,
    conversationId: turn.conversationId,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    status,
    disposition: isTerminalAriaTurnStatus(status) ? 'REPLAY' : 'IN_PROGRESS',
  };
}

async function findExistingReservation(
  client: Prisma.TransactionClient | PrismaClient,
  input: ReserveTurnRepositoryInput,
): Promise<ReservationTurn | null> {
  return client.ariaConversationTurn.findFirst({
    where: {
      actorUserId: input.actorUserId,
      subjectStudentId: input.subjectStudentId,
      useCase: AriaConversationTurnUseCase.CONVERSATION,
      clientRequestId: input.clientRequestId,
    },
    include: reservationInclude,
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

class PrismaAriaConversationRepository implements AriaConversationRepository {
  constructor(private readonly client: PrismaClient) {}

  async reserveTurn(input: ReserveTurnRepositoryInput): Promise<ReservedTurnRecord> {
    try {
      return await this.client.$transaction(async (tx) => {
        const idempotencyScope = [
          input.actorUserId,
          input.subjectStudentId,
          AriaConversationTurnUseCase.CONVERSATION,
          input.clientRequestId,
        ].join(':');
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyScope}, 0))`,
        );

        const existing = await findExistingReservation(tx, input);
        if (existing) return classifyExistingReservation(existing, input.requestFingerprint);

        let conversationId: string;
        if (input.requestedConversationId) {
          const locked = await tx.$queryRaw<Array<{
            id: string;
            studentId: string;
            courseKey: string | null;
            contextState: string;
          }>>(Prisma.sql`
            SELECT id, "studentId", "courseKey", "contextState"::text
            FROM aria_conversations
            WHERE id = ${input.requestedConversationId}
            FOR UPDATE
          `);
          const conversation = locked[0];
          if (!conversation || conversation.studentId !== input.subjectStudentId) {
            throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation ARIA introuvable.');
          }
          if (
            conversation.contextState !== AriaConversationContextState.ACTIVE
            || conversation.courseKey !== input.courseKey
          ) {
            throw new AriaError(
              'CROSS_COURSE_MISMATCH',
              409,
              'La conversation appartient à un autre cours.',
            );
          }
          conversationId = conversation.id;
        } else {
          const conversation = await tx.ariaConversation.create({
            data: {
              studentId: input.subjectStudentId,
              courseKey: input.courseKey,
              skillId: input.skillId,
              resourceId: input.resourceId,
              contextVersion: 'v1',
              contextState: AriaConversationContextState.ACTIVE,
            },
            select: { id: true },
          });
          conversationId = conversation.id;
        }

        const activeTurn = await tx.ariaConversationTurn.findFirst({
          where: {
            conversationId,
            status: {
              in: [AriaConversationTurnStatus.PENDING, AriaConversationTurnStatus.RUNNING],
            },
          },
          select: { id: true },
        });
        if (activeTurn) {
          throw new AriaError(
            'CONVERSATION_BUSY',
            409,
            'Une réponse ARIA est déjà en cours dans cette conversation.',
          );
        }

        const latest = await tx.ariaConversationTurn.aggregate({
          where: { conversationId },
          _max: { sequence: true },
        });
        const turn = await tx.ariaConversationTurn.create({
          data: {
            conversationId,
            subjectStudentId: input.subjectStudentId,
            actorUserId: input.actorUserId,
            useCase: AriaConversationTurnUseCase.CONVERSATION,
            clientRequestId: input.clientRequestId,
            requestFingerprint: input.requestFingerprint,
            sequence: (latest._max.sequence ?? 0) + 1,
            status: AriaConversationTurnStatus.PENDING,
            academicSnapshot: input.academicSnapshot as Prisma.InputJsonObject,
            pedagogicalMode: input.pedagogicalMode,
            agentRole: input.agentRole,
            modelPolicy: input.modelPolicy,
            visibility: AriaVisibility.STUDENT_PRIVATE,
          },
          select: { id: true },
        });
        const userMessage = await tx.ariaMessage.create({
          data: {
            conversationId,
            role: 'user',
            content: input.message,
            status: 'COMPLETED',
            turnId: turn.id,
            turnRole: AriaConversationTurnMessageRole.USER,
          },
          select: { id: true },
        });
        const assistantMessage = await tx.ariaMessage.create({
          data: {
            conversationId,
            role: 'assistant',
            content: '',
            status: 'PENDING',
            turnId: turn.id,
            turnRole: AriaConversationTurnMessageRole.ASSISTANT,
          },
          select: { id: true },
        });
        await tx.jobOutbox.create({
          data: {
            jobType: CanonicalJobType.RECOVER_ARIA_TURN,
            aggregateType: 'AriaConversationTurn',
            aggregateId: turn.id,
            sourceEventKey: `aria-turn-reserved:${turn.id}`,
            idempotencyKey: `aria-turn-watchdog:${turn.id}`,
            payload: { turnId: turn.id },
            availableAt: input.pendingRecoveryAt,
          },
        });
        await tx.ariaConversation.update({
          where: { id: conversationId },
          data: { updatedAt: input.now },
        });

        return {
          turnId: turn.id,
          conversationId,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
          status: 'PENDING',
          disposition: 'RESERVED',
        };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const exact = await findExistingReservation(this.client, input);
      if (exact) return classifyExistingReservation(exact, input.requestFingerprint);
      if (input.requestedConversationId) {
        const active = await this.client.ariaConversationTurn.findFirst({
          where: {
            conversationId: input.requestedConversationId,
            status: {
              in: [AriaConversationTurnStatus.PENDING, AriaConversationTurnStatus.RUNNING],
            },
          },
          select: { id: true },
        });
        if (active) {
          throw new AriaError(
            'CONVERSATION_BUSY',
            409,
            'Une réponse ARIA est déjà en cours dans cette conversation.',
          );
        }
      }
      throw error;
    }
  }

  async claimTurn(input: ClaimTurnRepositoryInput): Promise<ClaimedTurnRecord> {
    return this.client.$transaction(async (tx) => {
      const updated = await tx.ariaConversationTurn.updateMany({
        where: {
          id: input.turnId,
          conversationId: input.conversationId,
          actorUserId: input.actorUserId,
          subjectStudentId: input.subjectStudentId,
          status: AriaConversationTurnStatus.PENDING,
        },
        data: {
          status: AriaConversationTurnStatus.RUNNING,
          executionToken: input.executionToken,
          heartbeatAt: input.now,
          leaseExpiresAt: input.leaseExpiresAt,
          startedAt: input.now,
        },
      });
      if (updated.count === 1) {
        await tx.jobOutbox.updateMany({
          where: { idempotencyKey: `aria-turn-watchdog:${input.turnId}` },
          data: { availableAt: input.leaseExpiresAt },
        });
        return {
          turnId: input.turnId,
          conversationId: input.conversationId,
          status: 'RUNNING',
          executionToken: input.executionToken,
          leaseExpiresAt: input.leaseExpiresAt,
          disposition: 'CLAIMED',
        };
      }

      const turn = await tx.ariaConversationTurn.findFirst({
        where: {
          id: input.turnId,
          conversationId: input.conversationId,
          actorUserId: input.actorUserId,
          subjectStudentId: input.subjectStudentId,
        },
        select: { status: true, executionToken: true, leaseExpiresAt: true },
      });
      if (!turn) {
        throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Conversation ARIA introuvable.');
      }
      return {
        turnId: input.turnId,
        conversationId: input.conversationId,
        status: turn.status as AriaTurnStatus,
        executionToken: turn.executionToken ?? undefined,
        leaseExpiresAt: turn.leaseExpiresAt ?? undefined,
        disposition: 'NOT_CLAIMED',
      };
    });
  }

  async loadRecentCompletedTurns(input: {
    readonly conversationId: string;
    readonly subjectStudentId: string;
    readonly maxTurns: number;
  }): Promise<readonly AriaHistoryTurn[]> {
    if (!Number.isInteger(input.maxTurns) || input.maxTurns < 1 || input.maxTurns > 50) {
      throw new AriaError('BAD_REQUEST', 400, 'Budget d’historique ARIA invalide.');
    }
    const turns = await this.client.ariaConversationTurn.findMany({
      where: {
        conversationId: input.conversationId,
        subjectStudentId: input.subjectStudentId,
        status: AriaConversationTurnStatus.COMPLETED,
        AND: [
          { messages: { some: { turnRole: AriaConversationTurnMessageRole.USER } } },
          { messages: { some: { turnRole: AriaConversationTurnMessageRole.ASSISTANT } } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.maxTurns,
      select: {
        id: true,
        createdAt: true,
        messages: {
          where: {
            turnRole: {
              in: [AriaConversationTurnMessageRole.USER, AriaConversationTurnMessageRole.ASSISTANT],
            },
          },
          select: { id: true, role: true, content: true, turnRole: true },
        },
      },
    });

    return turns.map((turn) => {
      const user = turn.messages.find((message) => message.turnRole === 'USER');
      const assistant = turn.messages.find((message) => message.turnRole === 'ASSISTANT');
      if (!user || !assistant || user.role !== 'user' || assistant.role !== 'assistant') {
        throw new AriaError(
          'INTERNAL_ERROR',
          500,
          'Une difficulté technique temporaire est survenue. Veuillez réessayer.',
          { operation: 'loadPromptHistory', turnId: turn.id },
        );
      }
      return {
        turnId: turn.id,
        createdAt: turn.createdAt,
        user: { id: user.id, role: 'user' as const, content: user.content },
        assistant: { id: assistant.id, role: 'assistant' as const, content: assistant.content },
      };
    });
  }

  async checkpointRetrieval(input: CheckpointTurnRetrievalInput): Promise<void> {
    const updated = await this.client.ariaConversationTurn.updateMany({
      where: {
        id: input.turnId,
        conversationId: input.conversationId,
        status: AriaConversationTurnStatus.RUNNING,
        executionToken: input.executionToken,
      },
      data: {
        retrievalPolicy: input.retrievalPolicy as Prisma.InputJsonObject,
        retrievalEvidence: input.retrievalEvidence as unknown as Prisma.InputJsonObject,
        ragStatus: input.ragStatus,
        policyVersion: input.policyVersion,
      },
    });
    if (updated.count !== 1) {
      throw new AriaError('INTERNAL_ERROR', 500, 'Le Turn ARIA ne peut plus être modifié.', {
        reasonCode: 'TURN_RETRIEVAL_CHECKPOINT_FENCE_LOST',
      });
    }
  }

  async finalizeTurn(input: FinalizeTurnInput): Promise<void> {
    const retrievedCitations = assertAriaCitationsMatchRetrievalEvidence(
      input.citations,
      input.retrievalEvidence,
    );
    const now = input.now ?? new Date();
    await this.client.$transaction(async (tx) => {
      const conversation = await tx.ariaConversation.findUnique({
        where: { id: input.conversationId },
        select: { courseKey: true },
      });
      if (!conversation?.courseKey) {
        throw new AriaError('INTERNAL_ERROR', 500, 'Le contexte de conversation ARIA est invalide.', {
          reasonCode: 'TURN_CITATION_COURSE_MISMATCH',
        });
      }
      const expectedCourseKey = conversation.courseKey;
      if (retrievedCitations.some((citation) => citation.courseKey !== expectedCourseKey)) {
        throw new AriaError('INTERNAL_ERROR', 500, 'La citation appartient à un autre cours.', {
          reasonCode: 'TURN_CITATION_COURSE_MISMATCH',
        });
      }
      const citations = retrievedCitations.map((citation) => canonicalizeAriaCitationForPersistence(
        citation,
        expectedCourseKey,
      ));
      const updated = await tx.ariaConversationTurn.updateMany({
        where: {
          id: input.turnId,
          conversationId: input.conversationId,
          status: AriaConversationTurnStatus.RUNNING,
          executionToken: input.executionToken,
          ...(input.status === 'CANCELLED' ? {} : { cancellationRequestedAt: null }),
        },
        data: {
          status: input.status,
          retrievalEvidence: input.retrievalEvidence as unknown as Prisma.InputJsonObject,
          ragStatus: input.ragStatus,
          executionMetadata: input.executionMetadata as Prisma.InputJsonObject,
          completedAt: now,
          heartbeatAt: now,
          leaseExpiresAt: null,
        },
      });
      if (updated.count !== 1) {
        throw new AriaError('INTERNAL_ERROR', 500, 'La finalisation ARIA a perdu son verrou.', {
          reasonCode: 'TURN_FINALIZATION_FENCE_LOST',
        });
      }

      const assistant = await tx.ariaMessage.updateMany({
        where: {
          id: input.assistantMessageId,
          conversationId: input.conversationId,
          turnId: input.turnId,
          turnRole: AriaConversationTurnMessageRole.ASSISTANT,
        },
        data: {
          content: input.content,
          metadata: {
            ragStatus: input.ragStatus,
            citationCount: citations.length,
            ...input.executionMetadata,
          } as Prisma.InputJsonObject,
        },
      });
      if (assistant.count !== 1) {
        throw new AriaError('INTERNAL_ERROR', 500, 'Le message assistant ARIA est introuvable.', {
          reasonCode: 'TURN_ASSISTANT_MESSAGE_MISSING',
        });
      }

      if (citations.length > 0) {
        await tx.ariaMessageCitation.createMany({
          data: citations.map((citation) => ({
            messageId: input.assistantMessageId,
            sourceTitle: citation.sourceTitle,
            sourceDocument: citation.sourceDocument,
            sourceLocation: citation.sourceLocation ?? null,
            courseKey: citation.courseKey,
            provenance: citation.provenance,
            url: citation.url ?? null,
            resourceId: citation.resourceId,
            resourceVersionId: citation.resourceVersionId,
            contentSha256: citation.contentSha256,
            chunkId: citation.chunkId,
            locator: citation.locator as Prisma.InputJsonObject,
            corpusId: citation.corpusId,
            corpusVersionId: citation.corpusVersionId,
            manifestSha256: citation.manifestSha256,
          })),
        });
      }
      const watchdog = await tx.jobOutbox.updateMany({
        where: {
          jobType: CanonicalJobType.RECOVER_ARIA_TURN,
          aggregateId: input.turnId,
          idempotencyKey: `aria-turn-watchdog:${input.turnId}`,
        },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastError: null,
        },
      });
      if (watchdog.count !== 1) {
        throw new AriaError('INTERNAL_ERROR', 500, 'Le watchdog ARIA est introuvable.', {
          reasonCode: 'TURN_WATCHDOG_MISSING',
        });
      }
      await tx.ariaConversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: now },
      });
    });
  }

  async loadTurnResult(input: LoadTurnResultInput): Promise<PersistedTurnResult> {
    const turn = await this.client.ariaConversationTurn.findFirst({
      where: {
        id: input.turnId,
        actorUserId: input.actorUserId,
        subjectStudentId: input.subjectStudentId,
        useCase: AriaConversationTurnUseCase.CONVERSATION,
        status: {
          in: [
            AriaConversationTurnStatus.COMPLETED,
            AriaConversationTurnStatus.CANCELLED,
            AriaConversationTurnStatus.ERROR,
          ],
        },
      },
      select: {
        id: true,
        conversationId: true,
        conversation: { select: { courseKey: true } },
        status: true,
        ragStatus: true,
        retrievalEvidence: true,
        executionMetadata: true,
        messages: {
          where: { turnRole: AriaConversationTurnMessageRole.ASSISTANT },
          select: {
            id: true,
            content: true,
            citations: {
              select: {
                id: true, sourceTitle: true, sourceDocument: true, sourceLocation: true,
                courseKey: true, provenance: true, url: true, resourceId: true,
                resourceVersionId: true, contentSha256: true, chunkId: true, locator: true,
                corpusId: true, corpusVersionId: true, manifestSha256: true,
              },
            },
          },
        },
      },
    });
    const assistant = turn?.messages[0];
    if (!turn || !assistant) {
      throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Turn ARIA introuvable.');
    }
    if (!turn.conversation.courseKey) {
      throw new AriaError('INTERNAL_ERROR', 500, 'Le contexte du Turn ARIA est invalide.', {
        reasonCode: 'PERSISTED_CITATION_CONTRACT_INVALID',
      });
    }
    const citations = assistant.citations.map((citation) => projectPersistedAriaReplayCitation({
      row: citation,
      retrievalEvidence: turn.retrievalEvidence,
      expectedCourseKey: turn.conversation.courseKey as string,
    }));
    return {
      turnId: turn.id,
      conversationId: turn.conversationId,
      assistantMessageId: assistant.id,
      status: turn.status as AriaTurnStatus,
      content: assistant.content,
      ragStatus: turn.ragStatus as PersistedTurnResult['ragStatus'],
      failureCode: readPersistedFailureCode(turn.executionMetadata),
      citations,
    };
  }

  async requestCancellation(input: RequestTurnCancellationInput): Promise<TurnCancellationRecord> {
    return this.client.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{
        id: string;
        conversationId: string;
        actorUserId: string;
        clientRequestId: string;
        status: AriaTurnStatus;
        executionToken: string | null;
      }>>(Prisma.sql`
        SELECT id, "conversationId", "actorUserId", "clientRequestId",
               status::text, "executionToken"
        FROM aria_conversation_turns WHERE id = ${input.turnId} FOR UPDATE
      `);
      const turn = locked[0];
      if (!turn || turn.actorUserId !== input.actorUserId) {
        throw new AriaError('CONVERSATION_NOT_FOUND', 404, 'Turn ARIA introuvable.');
      }
      if (turn.clientRequestId !== input.clientRequestId) {
        throw new AriaError('IDEMPOTENCY_CONFLICT', 409, 'La clé de requête ne correspond pas au Turn ARIA.');
      }
      if (isTerminalAriaTurnStatus(turn.status)) {
        return {
          turnId: turn.id,
          conversationId: turn.conversationId,
          status: turn.status,
          executionToken: turn.executionToken ?? undefined,
          disposition: 'TERMINAL_REPLAY',
        };
      }
      if (turn.status === 'PENDING') {
        await tx.ariaConversationTurn.update({
          where: { id: turn.id },
          data: {
            status: AriaConversationTurnStatus.CANCELLED,
            cancellationRequestedAt: input.now,
            cancellationRequestedByActorId: input.actorUserId,
            completedAt: input.now,
            leaseExpiresAt: null,
          },
        });
        await tx.jobOutbox.updateMany({
          where: { idempotencyKey: `aria-turn-watchdog:${turn.id}` },
          data: { status: 'COMPLETED', completedAt: input.now, leaseOwner: null, leaseExpiresAt: null },
        });
        return {
          turnId: turn.id,
          conversationId: turn.conversationId,
          status: 'CANCELLED',
          disposition: 'CANCELLED',
        };
      }
      await tx.ariaConversationTurn.update({
        where: { id: turn.id },
        data: {
          cancellationRequestedAt: input.now,
          cancellationRequestedByActorId: input.actorUserId,
        },
      });
      return {
        turnId: turn.id,
        conversationId: turn.conversationId,
        status: 'RUNNING',
        executionToken: turn.executionToken ?? undefined,
        disposition: 'CANCELLATION_REQUESTED',
      };
    });
  }

  async heartbeatTurn(input: HeartbeatTurnInput): Promise<HeartbeatTurnRecord> {
    return this.client.$transaction(async (tx) => {
      const turns = await tx.$queryRaw<Array<{
        status: AriaTurnStatus;
        executionToken: string | null;
        cancellationRequestedAt: Date | null;
      }>>(Prisma.sql`
        SELECT status::text, "executionToken", "cancellationRequestedAt"
        FROM aria_conversation_turns
        WHERE id = ${input.turnId} AND "conversationId" = ${input.conversationId}
        FOR UPDATE
      `);
      const turn = turns[0];
      if (
        !turn
        || turn.status !== 'RUNNING'
        || turn.executionToken !== input.executionToken
      ) {
        return { disposition: 'LEASE_LOST' };
      }
      if (turn.cancellationRequestedAt) return { disposition: 'CANCELLATION_REQUESTED' };

      const jobs = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
        SELECT id, status::text
        FROM canonical_job_outbox
        WHERE "jobType" = 'RECOVER_ARIA_TURN'::"CanonicalJobType"
          AND "aggregateId" = ${input.turnId}
          AND "idempotencyKey" = ${`aria-turn-watchdog:${input.turnId}`}
        FOR UPDATE
      `);
      const job = jobs[0];
      if (!job || job.status === 'COMPLETED' || job.status === 'CANCELLED') {
        throw new AriaError('INTERNAL_ERROR', 500, 'Le watchdog ARIA est indisponible.', {
          reasonCode: 'TURN_WATCHDOG_UNAVAILABLE',
        });
      }
      await tx.ariaConversationTurn.update({
        where: { id: input.turnId },
        data: { heartbeatAt: input.now, leaseExpiresAt: input.leaseExpiresAt },
      });
      await tx.jobOutbox.update({
        where: { id: job.id },
        data: {
          status: 'PENDING',
          availableAt: input.leaseExpiresAt,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastError: null,
        },
      });
      return { disposition: 'RENEWED' };
    });
  }
}

export const prismaAriaConversationRepository = new PrismaAriaConversationRepository(prisma);

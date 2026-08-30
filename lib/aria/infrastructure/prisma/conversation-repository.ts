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
  ReservedTurnRecord,
  ReserveTurnRepositoryInput,
} from '../../application/conversation/ports';
import { isTerminalAriaTurnStatus, type AriaTurnStatus } from '../../domain/conversation/turn-state';
import { AriaError } from '../../errors';

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
}

export const prismaAriaConversationRepository = new PrismaAriaConversationRepository(prisma);

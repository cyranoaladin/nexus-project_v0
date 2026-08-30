import { createHash } from 'node:crypto';
import type { AriaConversationContext } from './build-context';
import type { AriaConversationRepository, ReservedTurnRecord } from './ports';
import { ARIA_PENDING_RECOVERY_MS } from '../../domain/conversation/lifecycle-policy';

export interface ReserveAriaConversationTurnInput {
  readonly context: AriaConversationContext;
  readonly clientRequestId: string;
  readonly message: string;
  readonly pedagogicalMode?: string;
  readonly agentRole?: string;
  readonly now?: Date;
}

export function fingerprintAriaTurnRequest(input: ReserveAriaConversationTurnInput): string {
  const canonicalRequest = {
    useCase: 'CONVERSATION',
    actorUserId: input.context.actor.userId,
    subjectStudentId: input.context.subject.studentId,
    courseKey: input.context.courseKey,
    conversationId: input.context.conversation?.id ?? null,
    skillId: input.context.skillId ?? null,
    resourceId: input.context.resourceId ?? null,
    pedagogicalMode: input.pedagogicalMode ?? 'DISCOVERY',
    agentRole: input.agentRole ?? 'TUTOR',
    visibility: 'STUDENT_PRIVATE',
    message: input.message,
  };
  return createHash('sha256').update(JSON.stringify(canonicalRequest)).digest('hex');
}

function buildAcademicSnapshot(
  context: AriaConversationContext,
): Readonly<Record<string, unknown>> {
  return {
    version: 1,
    courseKey: context.courseKey,
    gradeLevel: context.student.gradeLevel,
    academicTrack: context.student.academicTrack,
    stmgPathway: context.student.stmgPathway ?? null,
    academicEnrollments: (context.student.academicEnrollments ?? []).map((enrollment) => ({
      courseKey: enrollment.courseKey,
      kind: enrollment.kind,
      source: enrollment.source,
    })),
  };
}

export function makeReserveAriaConversationTurn(repository: AriaConversationRepository) {
  return async function reserveAriaConversationTurn(
    input: ReserveAriaConversationTurnInput,
  ): Promise<ReservedTurnRecord> {
    const now = input.now ?? new Date();
    return repository.reserveTurn({
      actorUserId: input.context.actor.userId,
      subjectStudentId: input.context.subject.studentId,
      clientRequestId: input.clientRequestId,
      requestFingerprint: fingerprintAriaTurnRequest(input),
      requestedConversationId: input.context.conversation?.id,
      courseKey: input.context.courseKey,
      skillId: input.context.skillId,
      resourceId: input.context.resourceId,
      message: input.message,
      academicSnapshot: buildAcademicSnapshot(input.context),
      pedagogicalMode: input.pedagogicalMode ?? 'DISCOVERY',
      agentRole: input.agentRole ?? 'TUTOR',
      now,
      pendingRecoveryAt: new Date(now.getTime() + ARIA_PENDING_RECOVERY_MS),
    });
  };
}

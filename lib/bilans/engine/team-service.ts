import 'server-only';

import {
  assertActorIdentity,
  type AssessmentEngineActor,
  type AssessmentEngineContext,
} from './workflow-service';

export async function listTeamBilanRequests(
  context: AssessmentEngineContext,
  input: Readonly<{ actor: AssessmentEngineActor }>,
) {
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(
      tx,
      input.actor,
      ['ASSISTANTE', 'COACH', 'ADMIN'],
    );
    return tx.bilanRequest.findMany({
      where: {
        status: {
          in: [
            'READY_FOR_ASSESSMENT',
            'ASSESSMENT_IN_PROGRESS',
            'ASSESSMENT_SUBMITTED',
            'SCORED',
            'REVIEW_PENDING',
          ],
        },
        ...(input.actor.role === 'COACH'
          ? { assignedCoach: { userId: input.actor.userId } }
          : {}),
      },
      select: {
        id: true,
        studentId: true,
        subject: true,
        gradeLevel: true,
        schoolYear: true,
        status: true,
        lastActivityAt: true,
      },
      orderBy: { lastActivityAt: 'desc' },
      take: 100,
    });
  });
}

export async function listTeamPedagogyDefinitions(
  context: AssessmentEngineContext,
  input: Readonly<{ actor: AssessmentEngineActor }>,
) {
  await context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(
      tx,
      input.actor,
      ['ASSISTANTE', 'COACH', 'ADMIN'],
    );
  });
  return context.catalog.assessments.map((assessment) => {
    const moduleDefinition = context.catalog.getModule(assessment.moduleId);
    return {
      definitionId: assessment.id,
      moduleId: assessment.moduleId,
      subject: assessment.subject,
      level: assessment.level,
      title: assessment.title,
      publicationStatus: assessment.publicationStatus,
      version: assessment.ref.version,
      sha256: assessment.ref.sha256,
      sessionCount: moduleDefinition.sessions.length,
      itemCount: assessment.items.length,
      manualResponseCount: assessment.items.filter(
        ({ responseMode }) => responseMode === 'MANUAL_SHORT_RESPONSE',
      ).length,
    };
  });
}

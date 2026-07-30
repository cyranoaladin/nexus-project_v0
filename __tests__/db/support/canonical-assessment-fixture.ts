import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import type {
  AssessmentDefinition,
  PedagogyCatalog,
} from '@/lib/pre-rentree/pedagogy/types';
import {
  autosaveAssessmentResponse,
  claimManualReviewTask,
  completeManualReviewTask,
  createAssessmentAssignment,
  scoreAssessmentAttempt,
  startAssessmentAttempt,
  submitAssessmentAttempt,
} from '@/lib/bilans/engine';
import {
  createTestParent,
  createTestStudent,
} from '../../setup/test-database';

export const publishedAssessmentFixture: AssessmentDefinition = {
  id: 'fixture-published-assessment',
  moduleId: 'fixture-published-module',
  level: 'TERMINALE',
  subject: 'MATHEMATIQUES',
  edition: 1,
  targetDurationMinutes: 20,
  title: 'Fixture publiée injectée',
  framing: 'Réservée au test du service.',
  publicationStatus: 'PUBLICATION_APPROVED',
  ref: {
    definitionId: 'fixture-published-assessment',
    moduleId: 'fixture-published-module',
    version: 'fixture-v1',
    sha256: `sha256:${'1'.repeat(64)}`,
  },
  nodes: [{
    id: 'node-1',
    order: 1,
    evaluated: true,
    priorKnowledge: 'Calcul.',
    targetUse: 'Résoudre.',
    obstacles: ['Erreur de calcul.'],
    masteryCriterion: 'Deux items.',
    sessionNumber: 1,
    itemIds: ['qcm', 'manual'],
  }],
  items: [
    {
      id: 'qcm',
      nodeId: 'node-1',
      tier: 'A',
      prompt: 'Choisir la bonne réponse.',
      rationale: 'Corrigé interne.',
      responseMode: 'AUTOMATIC_QCM',
      options: [
        { text: 'Faux', correct: false },
        { text: 'Vrai', correct: true },
      ],
    },
    {
      id: 'manual',
      nodeId: 'node-1',
      tier: 'B',
      prompt: 'Justifier.',
      rationale: 'Corrigé interne.',
      responseMode: 'MANUAL_SHORT_RESPONSE',
      maxCharacters: 200,
      gradingCriteria: ['Justification cohérente.'],
    },
  ],
};

export const publishedAssessmentCatalogFixture: PedagogyCatalog = {
  version: {
    campaignId: 'pre-rentree-2026',
    manifestVersion: 1,
    manifestSha256: `sha256:${'2'.repeat(64)}`,
    moduleCatalogVersion: 'fixture-modules-v1',
    moduleCatalogSha256: `sha256:${'3'.repeat(64)}`,
  },
  counts: {
    modules: 1,
    sessions: 1,
    cps: 1,
    nodes: 1,
    evaluatedNodes: 1,
    items: 2,
    manualResponses: 1,
    sessionUnitFiles: 4,
  },
  modules: [{
    id: publishedAssessmentFixture.moduleId,
    level: publishedAssessmentFixture.level,
    subject: publishedAssessmentFixture.subject,
    title: 'Fixture',
    subtitle: 'Tests seulement',
    catalogStatus: 'ACTIVE',
    publicationStatus: 'PUBLICATION_APPROVED',
    sessions: [],
    assessmentRef: publishedAssessmentFixture.ref,
  }],
  assessments: [publishedAssessmentFixture],
  getModule(id) {
    if (id !== publishedAssessmentFixture.moduleId) {
      throw new Error('unknown module');
    }
    return this.modules[0];
  },
  getAssessment(id) {
    if (id !== publishedAssessmentFixture.id) {
      throw new Error('unknown assessment');
    }
    return publishedAssessmentFixture;
  },
  assertAssessmentRef(ref) {
    if (
      ref.definitionId !== publishedAssessmentFixture.ref.definitionId
      || ref.version !== publishedAssessmentFixture.ref.version
      || ref.sha256 !== publishedAssessmentFixture.ref.sha256
    ) {
      throw new Error('invalid ref');
    }
    return publishedAssessmentFixture;
  },
};

export const engineKey = (prefix: string) => (
  `${prefix}_${randomUUID().replaceAll('-', '')}`
);

export async function createCanonicalWorkflowFixture(prisma: PrismaClient) {
  const { parentUser, parentProfile } = await createTestParent();
  const { student, studentUser } = await createTestStudent(parentProfile.id, {
    user: { activatedAt: new Date() },
  });
  await prisma.parentStudentLink.create({
    data: {
      parentUserId: parentUser.id,
      studentId: student.id,
      state: 'VERIFIED',
      consentedAt: new Date(),
      verifiedAt: new Date(),
    },
  });
  const admin = await prisma.user.create({
    data: {
      email: `engine.admin.${randomUUID()}@nexus-test.com`,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'Engine',
    },
  });
  const request = await prisma.bilanRequest.create({
    data: {
      parentUserId: parentUser.id,
      studentId: student.id,
      subject: 'MATHEMATIQUES',
      gradeLevel: 'TERMINALE',
      schoolYear: '2026-2027',
      mainNeed: 'Fixture de workflow.',
      consent: true,
      consentVersion: 'fixture-v1',
      consentedAt: new Date(),
      accountVerificationState: 'VERIFIED',
      status: 'READY_FOR_ASSESSMENT',
      submissionHash: `sha256:${randomUUID()}`,
    },
  });
  const context = {
    catalog: publishedAssessmentCatalogFixture,
    prisma,
  };
  const assignment = await createAssessmentAssignment(context, {
    actor: { role: 'ADMIN', userId: admin.id },
    command: {
      requestId: request.id,
      studentId: student.id,
      definitionId: publishedAssessmentFixture.id,
      definitionVersion: publishedAssessmentFixture.ref.version,
      definitionChecksum: publishedAssessmentFixture.ref.sha256,
      opensAt: new Date(Date.now() - 60_000).toISOString(),
      dueAt: new Date(Date.now() + 3_600_000).toISOString(),
      maxAttempts: 1,
    },
    idempotencyKey: engineKey('assignment'),
  });
  return {
    admin,
    assignment,
    context,
    parentUser,
    request,
    student,
    studentUser,
  };
}

export async function createFinalScoredWorkflowFixture(prisma: PrismaClient) {
  const fixture = await createCanonicalWorkflowFixture(prisma);
  const parentActor = {
    role: 'PARENT' as const,
    userId: fixture.parentUser.id,
  };
  const adminActor = {
    role: 'ADMIN' as const,
    userId: fixture.admin.id,
  };
  const attempt = await startAssessmentAttempt(fixture.context, {
    actor: parentActor,
    assignmentId: fixture.assignment.id,
    idempotencyKey: engineKey('start'),
  });
  await autosaveAssessmentResponse(fixture.context, {
    actor: parentActor,
    command: {
      attemptId: attempt.id,
      itemId: 'qcm',
      expectedVersion: 0,
      response: { selectedOptionIndex: 1 },
    },
    idempotencyKey: engineKey('save'),
  });
  await autosaveAssessmentResponse(fixture.context, {
    actor: parentActor,
    command: {
      attemptId: attempt.id,
      itemId: 'manual',
      expectedVersion: 0,
      response: { textValue: 'Une justification à corriger.' },
    },
    idempotencyKey: engineKey('save'),
  });
  await submitAssessmentAttempt(fixture.context, {
    actor: parentActor,
    command: { attemptId: attempt.id },
    idempotencyKey: engineKey('submit'),
  });
  const task = await prisma.canonicalManualReviewTask.findFirstOrThrow({
    where: { assessmentAttemptId: attempt.id },
  });
  const claimed = await claimManualReviewTask(fixture.context, {
    actor: adminActor,
    taskId: task.id,
    leaseSeconds: 300,
    idempotencyKey: engineKey('claim'),
  });
  await completeManualReviewTask(fixture.context, {
    actor: adminActor,
    command: {
      taskId: task.id,
      expectedClaimVersion: claimed.claimVersion,
      awardedPoints: 0.5,
      internalComment: 'Commentaire interne fixture.',
      publishableComment: 'La justification est à approfondir.',
      rubricVersion: 'raw-item-v1',
    },
    idempotencyKey: engineKey('complete'),
  });
  const score = await scoreAssessmentAttempt(fixture.context, {
    actor: adminActor,
    attemptId: attempt.id,
    resultKind: 'FINAL',
    provisionalResultsEnabled: false,
    idempotencyKey: engineKey('score'),
  });
  return {
    ...fixture,
    adminActor,
    attempt,
    parentActor,
    score,
    task,
  };
}

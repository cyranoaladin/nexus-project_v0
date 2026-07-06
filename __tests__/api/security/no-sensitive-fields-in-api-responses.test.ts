import { NextRequest } from 'next/server';
import * as BilanGratuitRoute from '@/app/api/bilan-gratuit/route';
import * as AdminInvoicesRoute from '@/app/api/admin/invoices/route';
import * as BilansGenerateRoute from '@/app/api/bilans/generate/route';
import * as CoachTrajectoryRoute from '@/app/api/coach/trajectory/route';
import * as CoachReportRegenerateRoute from '@/app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route';
import * as AssessmentsSubmitRoute from '@/app/api/assessments/submit/route';
import * as ClicToPayInitRoute from '@/app/api/payments/clictopay/init/route';
import * as ClicToPayWebhookRoute from '@/app/api/payments/clictopay/webhook/route';
import * as LamisTeacherReportRoute from '@/app/api/lamis/teacher-report/route';
import * as NpcDocumentsRoute from '@/app/api/npc/submissions/[submissionId]/documents/route';
import * as ParentChildrenRoute from '@/app/api/parent/children/route';
import * as StageInscrireRoute from '@/app/api/stages/[stageSlug]/inscrire/route';
import * as StageReservationConfirmRoute from '@/app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route';
import * as StudentActivateRoute from '@/app/api/student/activate/route';
import * as AdminConfigRoute from '@/app/api/admin/config/route';
import * as AdminConfigRollbackRoute from '@/app/api/admin/config/rollback/route';
import * as AdminDirecteurStatsRoute from '@/app/api/admin/directeur/stats/route';
import * as AdminRecomputeSsnRoute from '@/app/api/admin/recompute-ssn/route';
import * as AdminSubscriptionsRoute from '@/app/api/admin/subscriptions/route';
import * as AdminTestEmailRoute from '@/app/api/admin/test-email/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { sendWelcomeParentEmail } from '@/lib/email';
import { requireAnyRole, requireRole } from '@/lib/guards';
import {
  buildAssessmentAliasEmail,
  createAssessmentPublicToken,
  hashAssessmentLeadEmail,
} from '@/lib/assessments/public-token';
import { Subject } from '@/lib/assessments/core/types';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  requireRole: jest.fn(),
  isErrorResponse: jest.fn((result) => result && typeof result === 'object' && 'status' in result),
}));

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/csrf', () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
  checkBodySize: jest.fn().mockReturnValue(null),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn().mockReturnValue('test-cuid-123'),
}));

jest.mock('@/lib/email', () => ({
  sendWelcomeParentEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/email-service', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  testEmailConfiguration: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(null),
  }),
}));

jest.mock('@/lib/services/student-activation.service', () => ({
  verifyActivationToken: jest.fn(),
  completeStudentActivation: jest.fn(),
}));

jest.mock('@/lib/assessments/questions', () => ({
  QuestionBank: {
    loadByVersion: jest.fn().mockResolvedValue({
      questions: [
        {
          id: 'Q1',
          subject: 'MATHS',
          category: 'algebra',
          weight: 1,
          competencies: ['Calculer'],
          options: [
            { id: 'a', isCorrect: true },
            { id: 'b', isCorrect: false },
          ],
        },
      ],
      resolvedVersion: 'maths_terminale_safe_v1',
    }),
  },
}));

jest.mock('@/lib/assessments/scoring', () => ({
  ScoringFactory: {
    create: jest.fn().mockReturnValue({
      compute: jest.fn().mockReturnValue({
        globalScore: 100,
        confidenceIndex: 80,
        precisionIndex: 75,
        metrics: { categoryScores: { algebra: 100 }, competencyScores: {} },
        strengths: ['Algèbre'],
        weaknesses: [],
        recommendations: ['Continuer'],
      }),
    }),
  },
}));

jest.mock('@/lib/assessments/generators', () => ({
  BilanGenerator: {
    generate: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/core/ssn/computeSSN', () => ({
  computeAndPersistSSN: jest.fn().mockResolvedValue(undefined),
}));

const forbiddenFields = [
  'password',
  'activationToken',
  'activationUrl',
  'tokenHash',
  'totpSecret',
  'totpBackupCodes',
  'localPath',
  'pdfPath',
  'filePath',
  'originalFilePath',
  'contextJson',
  'llmJson',
  'validatedJson',
  'latexSource',
  'stack',
  'errorDetails',
  'metadata',
  'bankReference',
  'rawWebhook',
  'rawPayload',
];

const validBilanRequestData = {
  parentFirstName: 'Jean',
  parentLastName: 'Dupont',
  parentEmail: 'jean.dupont@test.com',
  parentPhone: '+216 99 19 28 29',
  studentFirstName: 'Marie',
  studentLastName: 'Dupont',
  studentGrade: 'Terminale',
  studentSchool: 'Lycée Victor Hugo',
  subjects: ['MATHEMATIQUES'],
  currentLevel: 'Moyen',
  objectives: 'Améliorer les notes en mathématiques pour le baccalauréat',
  preferredModality: 'hybride',
  acceptTerms: true,
  acceptNewsletter: false,
};

function request(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function expectNoForbiddenFields(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const field of forbiddenFields) {
    expect(serialized).not.toContain(field);
  }
}

function mockBilanTransaction() {
  (prisma.contactLead.create as jest.Mock).mockResolvedValue({
    id: 'lead-123',
    name: 'Jean Dupont',
    email: 'jean.dupont@test.com',
    phone: '+216 99 19 28 29',
    profile: 'Parent',
    interest: 'Bilan gratuit - Terminale',
    urgency: 'Moyen',
    source: 'bilan-gratuit',
    status: 'NEW',
    notes: 'Lead notes',
    createdAt: new Date('2026-07-03T08:00:00.000Z'),
    updatedAt: new Date('2026-07-03T08:00:00.000Z'),
  });
}

describe('sensitive API responses do not expose forbidden fields', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWebhookSecret = process.env.CLICTOPAY_WEBHOOK_SECRET;
  const originalAssessmentSecret = process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, { NODE_ENV: 'test' });
    delete process.env.CLICTOPAY_WEBHOOK_SECRET;
    process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = 'test-assessment-secret';
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });
    (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    (guardRateLimitAsync as jest.Mock).mockResolvedValue(null);
    (sendWelcomeParentEmail as jest.Mock).mockResolvedValue(undefined);
    (prisma.assessment.update as jest.Mock).mockResolvedValue({});
    (prisma.domainScore.createMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    if (originalWebhookSecret === undefined) {
      delete process.env.CLICTOPAY_WEBHOOK_SECRET;
    } else {
      process.env.CLICTOPAY_WEBHOOK_SECRET = originalWebhookSecret;
    }
    if (originalAssessmentSecret === undefined) {
      delete process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET;
    } else {
      process.env.ASSESSMENT_PUBLIC_TOKEN_SECRET = originalAssessmentSecret;
    }
  });

  it('covers the Lot 1-quinquies mockable response set', () => {
    expect([
      '/api/bilan-gratuit',
      '/api/admin/invoices',
      '/api/bilans/generate',
      '/api/assessments/submit',
      '/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate',
      '/api/npc/submissions/[submissionId]/documents',
      '/api/payments/clictopay/init',
      '/api/student/activate',
      '/api/payments/clictopay/webhook',
      '/api/lamis/teacher-report',
      '/api/stages/[stageSlug]/inscrire',
      '/api/parent/children',
      '/api/stages/[stageSlug]/reservations/[reservationId]/confirm',
      '/api/coach/trajectory',
      '/api/admin/config',
      '/api/admin/config/rollback',
      '/api/admin/directeur/stats',
      '/api/admin/recompute-ssn',
      '/api/admin/subscriptions',
      '/api/admin/test-email',
    ]).toHaveLength(20);
  });

  it('keeps bilan-gratuit success responses minimal', async () => {
    mockBilanTransaction();

    const response = await BilanGratuitRoute.POST(
      request('http://localhost:3000/api/bilan-gratuit', validBilanRequestData),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expectNoForbiddenFields(body);
  });

  it('keeps student activation validation responses minimal', async () => {
    const response = await StudentActivateRoute.POST(
      request('http://localhost:3000/api/student/activate', { token: 'tok', password: '123' }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps disabled ClicToPay webhook responses minimal', async () => {
    const response = await ClicToPayWebhookRoute.POST(
      new NextRequest('http://localhost:3000/api/payments/clictopay/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clictopay-signature': 'cannot-verify-without-runtime-secret',
        },
        body: JSON.stringify({
          orderId: 'ord-1',
          status: 'SUCCESS',
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expectNoForbiddenFields(body);
  });

  it('keeps assessment submit validation responses minimal', async () => {
    const response = await AssessmentsSubmitRoute.POST(
      request('http://localhost:3000/api/assessments/submit', {}),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps assessment submit success responses minimal', async () => {
    const leadEmailHash = hashAssessmentLeadEmail('parent@example.test');
    const assessmentEmail = buildAssessmentAliasEmail(leadEmailHash);
    (prisma.assessment.create as jest.Mock).mockResolvedValue({
      id: 'assessment-public-processing-id',
      subject: 'MATHS',
      grade: 'TERMINALE',
      status: 'SCORING',
      globalScore: 100,
    });

    const response = await AssessmentsSubmitRoute.POST(
      new NextRequest('http://localhost:3000/api/assessments/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-assessment-public-token': createAssessmentPublicToken({
            subject: Subject.MATHS,
            grade: 'TERMINALE',
            source: 'bilan-gratuit',
            binding: 'lead',
            leadEmailHash,
          }),
        },
        body: JSON.stringify({
          subject: 'MATHS',
          grade: 'TERMINALE',
          studentData: {
            email: assessmentEmail,
            name: 'Élève Nexus',
          },
          answers: { Q1: 'a' },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expectNoForbiddenFields(body);
  });

  it('keeps public stage inscription parameter validation responses minimal', async () => {
    const response = await StageInscrireRoute.POST(
      request('http://localhost:3000/api/stages/../secret/inscrire', {}),
      { params: Promise.resolve({ stageSlug: '../secret' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps public stage inscription success responses minimal', async () => {
    (prisma.stage.findUnique as jest.Mock).mockResolvedValue({
      id: 'stage-1',
      slug: 'prerentree-2026',
      title: 'Pré-rentrée 2026',
      capacity: 12,
      priceAmount: 650,
      isVisible: true,
      isOpen: true,
    });
    (prisma.stageReservation.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.stageReservation.count as jest.Mock).mockResolvedValue(0);
    (prisma.stageReservation.create as jest.Mock).mockResolvedValue({
      id: 'reservation-secret-id',
      richStatus: 'PENDING',
      activationToken: 'raw-token',
    });

    const response = await StageInscrireRoute.POST(
      request('http://localhost:3000/api/stages/prerentree-2026/inscrire', {
        firstName: 'Aya',
        lastName: 'Ben Ali',
        email: 'aya@example.test',
        phone: '+216 99 19 28 29',
        level: 'Terminale',
        stageTermsAccepted: true,
        dataProcessingAccepted: true,
      }),
      { params: Promise.resolve({ stageSlug: 'prerentree-2026' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expectNoForbiddenFields(body);
    expect(JSON.stringify(body)).not.toContain('reservation-secret-id');
  });

  it('keeps disabled ClicToPay init responses minimal', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });

    const response = await ClicToPayInitRoute.POST(
      request('http://localhost:3000/api/payments/clictopay/init', {
        amount: 450000,
        description: 'Abonnement',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expectNoForbiddenFields(body);
  });

  it('keeps admin invoice validation responses minimal', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });

    const response = await AdminInvoicesRoute.POST(
      request('http://localhost:3000/api/admin/invoices', {
        customer: { name: 'Parent Test' },
        items: [{ label: 'Formule', qty: 1, unitPrice: 450000 }],
        metadata: { raw: true },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps bilan generation validation responses minimal', async () => {
    const response = await BilansGenerateRoute.POST(
      request('http://localhost:3000/api/bilans/generate', { bilanId: '../secret' }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps NPC document validation responses minimal', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });

    const response = await NpcDocumentsRoute.GET(
      new NextRequest('http://localhost:3000/api/npc/submissions/../secret/documents'),
      { params: Promise.resolve({ submissionId: '../secret' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps coach generated report validation responses minimal', async () => {
    const response = await CoachReportRegenerateRoute.POST(
      request('http://localhost:3000/api/coach/students/../student/generated-reports/../report/regenerate', {}),
      { params: Promise.resolve({ studentId: '../student', reportId: '../report' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps Lamis teacher report validation responses minimal', async () => {
    const response = await LamisTeacherReportRoute.POST(
      request('http://localhost:3000/api/lamis/teacher-report', {
        attempts: [],
        studentEmail: 'student@example.test',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps Lamis teacher report success responses minimal', async () => {
    const response = await LamisTeacherReportRoute.GET(
      new NextRequest('http://localhost:3000/api/lamis/teacher-report', { method: 'GET' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expectNoForbiddenFields(body);
  });

  it('keeps student activation success responses minimal', async () => {
    const { completeStudentActivation } = jest.requireMock('@/lib/services/student-activation.service');
    completeStudentActivation.mockResolvedValue({
      success: true,
      redirectUrl: '/auth/signin?activated=true',
    });

    const response = await StudentActivateRoute.POST(
      request('http://localhost:3000/api/student/activate', {
        token: 'valid-token',
        password: 'securePass123',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expectNoForbiddenFields(body);
  });

  it('keeps parent child creation responses free of activation tokens', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) =>
      callback({
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'student-user-1',
            email: 'marie.dupont@nexus-student.local',
            firstName: 'Marie',
            lastName: 'Dupont',
          }),
        },
        student: {
          create: jest.fn().mockResolvedValue({
            id: 'student-1',
            grade: 'Terminale',
            school: 'Lycée',
            user: {
              firstName: 'Marie',
              lastName: 'Dupont',
              email: 'marie.dupont@nexus-student.local',
            },
          }),
        },
      }),
    );

    const response = await ParentChildrenRoute.POST(
      request('http://localhost:3000/api/parent/children', {
        firstName: 'Marie',
        lastName: 'Dupont',
        grade: 'Terminale',
        school: 'Lycée',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expectNoForbiddenFields(body);
    expect(JSON.stringify(body)).not.toContain('act_');
  });

  it('keeps stage reservation confirm validation responses minimal', async () => {
    const response = await StageReservationConfirmRoute.POST(
      new NextRequest('http://localhost:3000/api/stages/../secret/reservations/res-1/confirm', {
        method: 'POST',
      }),
      { params: Promise.resolve({ stageSlug: '../secret', reservationId: 'res-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps coach trajectory validation responses minimal', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });

    const response = await CoachTrajectoryRoute.POST(
      request('http://localhost:3000/api/coach/trajectory', {
        studentId: 'student-1',
        title: 'Trajectoire',
        horizon: '3_MONTHS',
        metadata: { rawPayload: true },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps admin config validation responses minimal', async () => {
    const response = await AdminConfigRoute.PATCH(
      request('http://localhost:3000/api/admin/config', {
        namespace: 'pricing.rules',
        key: 'group_max',
        value: 5,
        rawPayload: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps admin config rollback validation responses minimal', async () => {
    const response = await AdminConfigRollbackRoute.POST(
      request('http://localhost:3000/api/admin/config/rollback', {
        namespace: 'pricing.rules',
        key: 'group_max',
        force: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps admin directeur stats validation responses minimal', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });

    const response = await AdminDirecteurStatsRoute.GET(
      new NextRequest('http://localhost:3000/api/admin/directeur/stats?rawPayload=true'),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps admin recompute SSN validation responses minimal', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });

    const response = await AdminRecomputeSsnRoute.POST(
      request('http://localhost:3000/api/admin/recompute-ssn', {
        type: 'MATHS',
        rawPayload: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps admin subscriptions validation responses minimal', async () => {
    const response = await AdminSubscriptionsRoute.GET(
      new NextRequest('http://localhost:3000/api/admin/subscriptions?limit=500&rawPayload=true'),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });

  it('keeps admin test-email validation responses minimal', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });

    const response = await AdminTestEmailRoute.POST(
      request('http://localhost:3000/api/admin/test-email', {
        action: 'send_test',
        testEmail: 'not-an-email',
        rawPayload: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expectNoForbiddenFields(body);
  });
});

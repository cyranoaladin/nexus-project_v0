jest.unmock('@/lib/prisma');
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(async () => ({ user: { id: 'staff-integration', role: 'ASSISTANTE', email: 'staff@example.test' } })),
  isErrorResponse: () => false,
}));
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
jest.mock('@/lib/auth/activation-token', () => ({
  createActivationToken: jest.fn(() => ({ rawToken: 'sact_integration-only', tokenHash: 'integration-activation-hash', expiresAt: new Date('2026-09-02T00:00:00Z') })),
}));
jest.mock('@/lib/password-reset-token', () => ({ generateResetToken: jest.fn(() => 'reset-integration-only') }));
jest.mock('@/lib/auth/parent-activation', () => ({ getTrustedApplicationOrigin: jest.fn(() => 'http://localhost:3000') }));

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { POST as createProfil } from '@/app/api/assistante/candidat-individuel/profils/route';
import { POST as createParentAndStudent } from '@/app/api/assistante/students/route';
import { POST as searchPlanningStudents } from '@/app/api/assistante/stages/planning/students/search/route';
import { POST as resolveCandidateIdentity } from '@/app/api/assistante/candidat-individuel/identity/resolve/route';
import { POST as searchLeads } from '@/app/api/quotes/leads/search/route';
import { _resetForTest, _setForTest } from '@/lib/config/snapshot';
import { findOrCaptureResponsableLeadInTransaction } from '@/lib/crm/contact-leads';
import { decryptEmailIntent } from '@/lib/email/outbox';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

const PREFIX = 'ci-responsable-lock-';

function safeTestDatabase(): void {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
}

async function cleanup(): Promise<void> {
  const leads = await prisma.contactLead.findMany({
    where: { email: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = leads.map(({ id }) => id);
  const users = await prisma.user.findMany({
    where: { email: { startsWith: PREFIX } },
    include: { parentProfile: { include: { children: true } } },
  });
  const userIds = users.map(({ id }) => id);
  const parentProfileIds = users.flatMap(({ parentProfile }) => parentProfile ? [parentProfile.id] : []);
  const studentIds = users.flatMap(({ parentProfile }) => parentProfile?.children.map(({ id }) => id) ?? []);
  await prisma.profilCandidat.deleteMany({
    where: { OR: [{ contactLeadId: { in: ids } }, { studentId: { in: studentIds } }] },
  });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.parentProfile.deleteMany({ where: { id: { in: parentProfileIds } } });
  await prisma.jobOutbox.deleteMany({ where: { aggregateId: { in: [...ids, ...userIds] } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.contactLead.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

describe('responsible ContactLead — real PostgreSQL concurrency', () => {
  beforeAll(async () => {
    safeTestDatabase();
    await cleanup();
  });

  afterAll(async () => {
    _resetForTest();
    await cleanup();
    await prisma.$disconnect();
  });

  it('serializes concurrent normalized email capture and creates exactly one lead', async () => {
    const email = `${PREFIX}same@example.test`;
    const payload = { name: 'Responsable Synthétique', email, source: 'STAFF_STUDENT_CREATION' };

    const [first, second] = await Promise.all([
      prisma.$transaction((tx) => findOrCaptureResponsableLeadInTransaction(tx, payload)),
      prisma.$transaction((tx) => findOrCaptureResponsableLeadInTransaction(tx, { ...payload, email: email.toUpperCase() })),
    ]);

    expect(first.id).toBe(second.id);
    expect(await prisma.contactLead.count({ where: { email: { equals: email, mode: 'insensitive' } } })).toBe(1);
  });

  it('rolls the governed lead and its outbox intent back with the caller transaction', async () => {
    const email = `${PREFIX}rollback@example.test`;

    await expect(prisma.$transaction(async (tx) => {
      await findOrCaptureResponsableLeadInTransaction(tx, {
        name: 'Responsable Rollback', email, source: 'STAFF_STUDENT_CREATION',
      });
      throw new Error('EXPECTED_TEST_ROLLBACK');
    })).rejects.toThrow('EXPECTED_TEST_ROLLBACK');

    expect(await prisma.contactLead.count({ where: { email } })).toBe(0);
  });

  it('creates, finds both identities through staff APIs, then persists their profile IDs', async () => {
    const parentEmail = `${PREFIX}parent@example.test`;
    const studentEmail = `${PREFIX}student@example.test`;
    const creation = await createParentAndStudent(new NextRequest('http://localhost:3000/api/assistante/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentEmail,
        parentFirstName: 'Responsable',
        parentLastName: 'Synthétique',
        parentPhone: '+21699000001',
        studentFirstName: 'Élève',
        studentLastName: 'Synthétique',
        studentEmail,
        studentGrade: 'Terminale',
        studentSchool: 'Établissement de test',
      }),
    }));
    expect(creation.status).toBe(201);
    const created = await creation.json();
    expect(created).toEqual({
      success: true,
      message: 'Parent et élève créés avec succès',
      studentId: expect.any(String),
      contactLeadId: expect.any(String),
    });
    const createdUsers = await prisma.user.findMany({
      where: { email: { in: [parentEmail, studentEmail] } },
      select: { id: true },
    });
    const intents = await prisma.jobOutbox.findMany({
      where: {
        aggregateId: { in: [...createdUsers.map(({ id }) => id), created.contactLeadId] },
        jobType: 'SEND_EMAIL',
      },
      select: { payload: true },
    });
    expect(intents.map(({ payload }) => decryptEmailIntent(payload).messageType).sort()).toEqual([
      'PASSWORD_RESET',
      'STUDENT_ACTIVATION',
      'TRANSACTIONAL_NOTIFICATION',
    ]);
    const storedPayloads = JSON.stringify(intents.map(({ payload }) => payload));
    expect(storedPayloads).not.toContain(parentEmail);
    expect(storedPayloads).not.toContain(studentEmail);
    expect(storedPayloads).not.toContain('reset-integration-only');
    expect(storedPayloads).not.toContain('sact_integration-only');

    _setForTest([{
      namespace: 'pricing.candidatIndividuelPipeline', key: 'state', value: 'ACTIVE_INTERNAL',
      schemaVersion: '1.0', version: 1, updatedBy: 'test', updatedAt: new Date(),
    }]);
    const identityResponse = await resolveCandidateIdentity(new NextRequest(
      'http://localhost:3000/api/assistante/candidat-individuel/identity/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: created.studentId }),
      },
    ));
    expect(identityResponse.status).toBe(200);
    expect(await identityResponse.json()).toMatchObject({
      success: true,
      contactLead: { id: created.contactLeadId },
      student: { studentId: created.studentId },
    });

    const leadResponse = await searchLeads(new NextRequest('http://localhost:3000/api/quotes/leads/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: parentEmail, limit: 10 }),
    }));
    expect(leadResponse.status).toBe(200);
    const leadBody = await leadResponse.json();
    expect(leadBody.items).toEqual([expect.objectContaining({ id: created.contactLeadId, email: parentEmail })]);

    const studentResponse = await searchPlanningStudents(new NextRequest('http://localhost:3000/api/assistante/stages/planning/students/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: studentEmail, page: 1, limit: 10 }),
    }));
    expect(studentResponse.status).toBe(200);
    const studentBody = await studentResponse.json();
    expect(studentBody.items).toEqual([expect.objectContaining({ email: studentEmail })]);

    const profileResponse = await createProfil(new NextRequest('http://localhost:3000/api/assistante/candidat-individuel/profils', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactLeadId: created.contactLeadId,
        studentId: created.studentId,
        publicInput: {
          level: 'TERMINALE', examSession: 2027, modalite: 'A',
          specialite1: 'MATHEMATIQUES', specialite2: 'PHYSIQUE_CHIMIE',
        },
      }),
    }));
    expect(profileResponse.status).toBe(201);
    const profileBody = await profileResponse.json();
    expect(await prisma.profilCandidat.findUnique({ where: { id: profileBody.profil.id } })).toEqual(expect.objectContaining({
      contactLeadId: created.contactLeadId,
      studentId: created.studentId,
    }));
  });

  it('rolls back parent, student, lead and outbox when encrypted enqueue fails', async () => {
    const parentEmail = `${PREFIX}forced-rollback-parent@example.test`;
    const studentEmail = `${PREFIX}forced-rollback-student@example.test`;
    const previousKey = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
    const outboxCountBefore = await prisma.jobOutbox.count();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
    try {
      const response = await createParentAndStudent(new NextRequest('http://localhost:3000/api/assistante/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentEmail,
          parentFirstName: 'Responsable',
          parentLastName: 'Rollback',
          studentFirstName: 'Élève',
          studentLastName: 'Rollback',
          studentEmail,
          studentGrade: 'Terminale',
        }),
      }));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        error: 'CREATE_FAILED',
        message: 'Création momentanément indisponible.',
      });
      expect(await prisma.user.count({ where: { email: { in: [parentEmail, studentEmail] } } })).toBe(0);
      expect(await prisma.student.count({ where: { user: { email: studentEmail } } })).toBe(0);
      expect(await prisma.contactLead.count({ where: { email: parentEmail } })).toBe(0);
      expect(await prisma.jobOutbox.count()).toBe(outboxCountBefore);
      expect(consoleError.mock.calls).toEqual([[{ operation: 'staff-student-create', code: 'CREATE_FAILED', status: 500 }]]);
    } finally {
      if (previousKey === undefined) delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
      else process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = previousKey;
      consoleError.mockRestore();
    }
  });

  it('creates one shared parent/lead and two students for concurrent distinct student requests', async () => {
    const parentEmail = `${PREFIX}shared-parent@example.test`;
    const makeRequest = (suffix: string) => new NextRequest('http://localhost:3000/api/assistante/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentEmail,
        parentFirstName: 'Parent',
        parentLastName: 'Partagé',
        studentFirstName: 'Élève',
        studentLastName: suffix,
        studentEmail: `${PREFIX}distinct-${suffix.toLowerCase()}@example.test`,
        studentGrade: 'Terminale',
      }),
    });

    const responses = await Promise.all([
      createParentAndStudent(makeRequest('Alpha')),
      createParentAndStudent(makeRequest('Beta')),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    const parentUsers = await prisma.user.findMany({ where: { email: parentEmail }, include: { parentProfile: true } });
    expect(parentUsers).toHaveLength(1);
    expect(parentUsers[0].parentProfile).not.toBeNull();
    expect(await prisma.parentProfile.count({ where: { userId: parentUsers[0].id } })).toBe(1);
    expect(await prisma.contactLead.count({ where: { email: parentEmail } })).toBe(1);
    expect(await prisma.student.count({ where: { parentId: parentUsers[0].parentProfile!.id } })).toBe(2);
  });

  it('returns one 201 and one governed 409 for concurrent identical student requests', async () => {
    const parentEmail = `${PREFIX}same-student-parent@example.test`;
    const studentEmail = `${PREFIX}same-student@example.test`;
    const makeRequest = () => new NextRequest('http://localhost:3000/api/assistante/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentEmail,
        parentFirstName: 'Parent',
        parentLastName: 'Concurrent',
        studentFirstName: 'Élève',
        studentLastName: 'Unique',
        studentEmail,
        studentGrade: 'Terminale',
      }),
    });

    const responses = await Promise.all([
      createParentAndStudent(makeRequest()),
      createParentAndStudent(makeRequest()),
    ]);
    const statuses = responses.map(({ status }) => status).sort((a, b) => a - b);

    expect(statuses).toEqual([201, 409]);
    expect(statuses).not.toContain(500);
    expect(await prisma.user.count({ where: { email: studentEmail } })).toBe(1);
    expect(await prisma.student.count({ where: { user: { email: studentEmail } } })).toBe(1);
    expect(await prisma.user.count({ where: { email: parentEmail } })).toBe(1);
    expect(await prisma.contactLead.count({ where: { email: parentEmail } })).toBe(1);
  });
});

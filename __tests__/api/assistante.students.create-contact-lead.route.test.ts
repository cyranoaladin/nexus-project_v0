import { NextRequest, NextResponse } from 'next/server';

import { POST } from '@/app/api/assistante/students/route';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { prisma } from '@/lib/prisma';

let role: 'ADMIN' | 'ASSISTANTE' = 'ASSISTANTE';

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(async () => ({ user: { id: `staff-${role.toLowerCase()}`, role, email: `${role.toLowerCase()}@example.test` } })),
  isErrorResponse: (value: unknown) => value instanceof NextResponse,
}));
jest.mock('@/lib/rbac', () => ({ can: jest.fn(() => true) }));
jest.mock('@/lib/auth/activation-token', () => ({
  createActivationToken: jest.fn(() => ({ rawToken: 'sact_test-only', tokenHash: 'activation-hash', expiresAt: new Date('2026-09-02T00:00:00Z') })),
}));
jest.mock('@/lib/password-reset-token', () => ({ generateResetToken: jest.fn(() => 'reset-test-only') }));
jest.mock('@/lib/auth/parent-activation', () => ({ getTrustedApplicationOrigin: jest.fn(() => 'http://localhost:3000') }));
jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: jest.fn() }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));

const mockTransaction = prisma.$transaction as jest.Mock;
const mockEnqueue = enqueueEmailIntent as jest.Mock;
const mockDrain = kickEmailOutboxDrain as jest.Mock;

const validBody = {
  parentEmail: ' SONIA@Example.Test ', parentFirstName: 'Sonia', parentLastName: 'Ben Salah', parentPhone: '+21699111222',
  studentFirstName: 'Yasmine', studentLastName: 'Ben Salah', studentEmail: 'yasmine@example.test', studentGrade: 'Terminale', studentSchool: 'PMF',
};

function request(body: unknown) {
  return new NextRequest('http://localhost:3000/api/assistante/students', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

function arrangeSuccessfulTransaction(existingLead: Record<string, unknown> | null = null) {
  (prisma.user.findUnique as jest.Mock)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null);
  (prisma.user.create as jest.Mock)
    .mockResolvedValueOnce({ id: 'parent-user-1', email: 'sonia@example.test', firstName: 'Sonia', password: null })
    .mockResolvedValueOnce({ id: 'student-user-1', email: 'yasmine@example.test', firstName: 'Yasmine', lastName: 'Ben Salah' });
  (prisma.parentProfile.create as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
  (prisma.student.create as jest.Mock).mockResolvedValue({ id: 'student-1' });
  (prisma.contactLead.findFirst as jest.Mock).mockResolvedValue(existingLead);
  (prisma.contactLead.create as jest.Mock).mockResolvedValue({
    id: 'lead-new', name: 'Sonia Ben Salah', email: 'sonia@example.test', phone: '+21699111222', profile: null,
    interest: null, urgency: null, source: 'STAFF_STUDENT_CREATION', status: 'NEW', notes: null,
    createdAt: new Date('2026-08-30T00:00:00Z'), updatedAt: new Date('2026-08-30T00:00:00Z'),
  });
}

function arrangeExistingParent(active: boolean) {
  (prisma.user.findUnique as jest.Mock)
    .mockResolvedValueOnce({
      id: 'parent-user-existing', role: 'PARENT', email: 'sonia@example.test',
      firstName: 'Sonia', lastName: 'Ben Salah', phone: null,
      password: active ? '$2b$12$existing-password-hash' : null,
      activatedAt: active ? new Date('2026-08-01T00:00:00Z') : null,
      parentProfile: { id: 'parent-profile-existing' },
    })
    .mockResolvedValueOnce(null);
  (prisma.user.create as jest.Mock).mockResolvedValueOnce({
    id: 'student-user-1', email: 'yasmine@example.test', firstName: 'Yasmine', lastName: 'Ben Salah',
  });
  (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'parent-user-existing' });
  (prisma.student.create as jest.Mock).mockResolvedValue({ id: 'student-1' });
  (prisma.contactLead.findFirst as jest.Mock).mockResolvedValue({
    id: 'lead-existing', name: 'Sonia Ben Salah', email: 'sonia@example.test', phone: null, status: 'NEW',
  });
}

describe('POST /api/assistante/students — governed responsible lead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    role = 'ASSISTANTE';
    mockTransaction.mockImplementation(async (operation: (tx: typeof prisma) => unknown) => operation(prisma));
    (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(0);
    mockEnqueue.mockResolvedValue(undefined);
  });

  it.each(['ADMIN', 'ASSISTANTE'] as const)('creates ParentProfile + Student + ContactLead atomically for %s', async (staffRole) => {
    role = staffRole;
    arrangeSuccessfulTransaction();

    const response = await POST(request(validBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      success: true,
      message: 'Parent et élève créés avec succès',
      studentId: 'student-1',
      contactLeadId: 'lead-new',
    });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(prisma.parentProfile.create).toHaveBeenCalledTimes(1);
    expect(prisma.student.create).toHaveBeenCalledTimes(1);
    expect(prisma.contactLead.create).toHaveBeenCalledTimes(1);
    expect(mockEnqueue.mock.calls.map(([, intent]) => intent.messageType)).toEqual([
      'TRANSACTIONAL_NOTIFICATION',
      'PASSWORD_RESET',
      'STUDENT_ACTIVATION',
    ]);
    expect(mockDrain).toHaveBeenCalledTimes(1);
  });

  it('enqueues only student activation for an existing active parent', async () => {
    arrangeExistingParent(true);

    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    expect(mockEnqueue.mock.calls.map(([, intent]) => intent.messageType)).toEqual(['STUDENT_ACTIVATION']);
  });

  it('enqueues password definition plus student activation for an existing inactive parent', async () => {
    arrangeExistingParent(false);

    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    expect(mockEnqueue.mock.calls.map(([, intent]) => intent.messageType)).toEqual([
      'PASSWORD_RESET',
      'STUDENT_ACTIVATION',
    ]);
  });

  it('escapes staff-provided names in both HTML messages', async () => {
    arrangeSuccessfulTransaction();
    const malicious = {
      ...validBody,
      parentFirstName: '<img src=x onerror=alert(1)>',
      studentFirstName: '<script>alert(2)</script>',
    };
    (prisma.user.create as jest.Mock).mockReset()
      .mockResolvedValueOnce({
        id: 'parent-user-1', email: 'sonia@example.test', firstName: malicious.parentFirstName, password: null,
      })
      .mockResolvedValueOnce({
        id: 'student-user-1', email: 'yasmine@example.test', firstName: malicious.studentFirstName, lastName: 'Ben Salah',
      });
    (prisma.contactLead.create as jest.Mock).mockResolvedValue({
      id: 'lead-new', name: `${malicious.parentFirstName} Ben Salah`, email: 'sonia@example.test', phone: '+21699111222', profile: null,
      interest: null, urgency: null, source: 'STAFF_STUDENT_CREATION', status: 'NEW', notes: null,
      createdAt: new Date('2026-08-30T00:00:00Z'), updatedAt: new Date('2026-08-30T00:00:00Z'),
    });

    const response = await POST(request(malicious));
    const htmlMessages = mockEnqueue.mock.calls.map(([, intent]) => intent.html).join('\n');

    expect(response.status).toBe(201);
    expect(htmlMessages).not.toContain('<img src=x onerror=alert(1)>');
    expect(htmlMessages).not.toContain('<script>alert(2)</script>');
    expect(htmlMessages).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(htmlMessages).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
  });

  it('reuses an existing normalized lead and never creates a duplicate', async () => {
    const existingLead = { id: 'lead-existing', name: 'Sonia Ben Salah', email: 'sonia@example.test', phone: null, status: 'NEW' };
    arrangeSuccessfulTransaction(existingLead);

    const response = await POST(request(validBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.contactLeadId).toBe('lead-existing');
    expect(prisma.contactLead.create).not.toHaveBeenCalled();
  });

  it('locks normalized parent + student identities in global order before every read', async () => {
    arrangeSuccessfulTransaction();

    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(3);
    expect((prisma.$executeRawUnsafe as jest.Mock).mock.calls).toEqual([
      ['SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', 'nexus:contact-lead:sonia@example.test'],
      ['SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', 'nexus:user-email:sonia@example.test'],
      ['SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', 'nexus:user-email:yasmine@example.test'],
    ]);
    const lastLockOrder = (prisma.$executeRawUnsafe as jest.Mock).mock.invocationCallOrder.at(-1)!;
    const firstIdentityReadOrder = (prisma.user.findUnique as jest.Mock).mock.invocationCallOrder[0];
    const leadReadOrder = (prisma.contactLead.findFirst as jest.Mock).mock.invocationCallOrder[0];
    expect(lastLockOrder).toBeLessThan(firstIdentityReadOrder);
    expect(lastLockOrder).toBeLessThan(leadReadOrder);
  });

  it('detects an existing student before any write, leaving the transaction rollback-safe', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'student-existing', role: 'ELEVE' });

    const response = await POST(request(validBody));

    expect(response.status).toBe(409);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.parentProfile.create).not.toHaveBeenCalled();
    expect(prisma.student.create).not.toHaveBeenCalled();
    expect(prisma.contactLead.create).not.toHaveBeenCalled();
    expect(enqueueEmailIntent).not.toHaveBeenCalled();
  });

  it('fails closed before a transaction when the responsible email is absent', async () => {
    const response = await POST(request({ ...validBody, parentEmail: '' }));

    expect(response.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ success: false, error: 'INVALID_REQUEST', message: 'Données invalides.' });
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockDrain).not.toHaveBeenCalled();
  });

  it('rejects unknown input keys before the transaction', async () => {
    const response = await POST(request({ ...validBody, passwordHash: 'must-never-be-accepted' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'INVALID_REQUEST', message: 'Données invalides.' });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON before the transaction', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/assistante/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'INVALID_REQUEST', message: 'Données invalides.' });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('rejects an existing responsible identity with an incompatible role without side effects', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'coach-existing', role: 'COACH', email: 'private-coach@example.test' })
      .mockResolvedValueOnce(null);

    const response = await POST(request(validBody));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      success: false,
      error: 'IDENTITY_CONFLICT',
      message: 'Le compte du responsable est incompatible avec cette opération.',
    });
    expect(JSON.stringify(body)).not.toContain('private-coach@example.test');
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockDrain).not.toHaveBeenCalled();
  });

  it('returns a stable conflict without leaking the existing identity', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'student-existing', role: 'ELEVE', email: 'private-student@example.test' });

    const response = await POST(request(validBody));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ success: false, error: 'IDENTITY_CONFLICT', message: 'Un compte élève existe déjà.' });
    expect(JSON.stringify(body)).not.toContain('private-student@example.test');
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockDrain).not.toHaveBeenCalled();
  });

  it('returns and logs only a stable PII-free error when the transaction fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockTransaction.mockRejectedValueOnce(new Error('sonia@example.test reset-test-only $2b$12$password-hash'));

    const response = await POST(request(validBody));
    const body = await response.json();
    const logged = JSON.stringify(consoleError.mock.calls);

    expect(response.status).toBe(500);
    expect(body).toEqual({ success: false, error: 'CREATE_FAILED', message: 'Création momentanément indisponible.' });
    expect(logged).toBe(JSON.stringify([[{ operation: 'staff-student-create', code: 'CREATE_FAILED', status: 500 }]]));
    expect(logged).not.toContain('sonia@example.test');
    expect(logged).not.toContain('reset-test-only');
    expect(logged).not.toContain('password-hash');
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockDrain).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

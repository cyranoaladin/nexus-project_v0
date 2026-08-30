import { NextRequest, NextResponse } from 'next/server';

import { POST } from '@/app/api/assistante/students/route';
import { enqueueEmailIntent } from '@/lib/email/outbox';
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
    expect(body).toEqual(expect.objectContaining({ success: true, studentId: 'student-1', contactLeadId: 'lead-new' }));
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(prisma.parentProfile.create).toHaveBeenCalledTimes(1);
    expect(prisma.student.create).toHaveBeenCalledTimes(1);
    expect(prisma.contactLead.create).toHaveBeenCalledTimes(1);
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
  });
});

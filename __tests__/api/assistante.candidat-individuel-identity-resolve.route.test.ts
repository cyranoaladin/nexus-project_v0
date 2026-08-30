import { NextRequest, NextResponse } from 'next/server';

type TestRole = 'ADMIN' | 'ASSISTANTE' | 'PARENT' | 'ELEVE' | 'COACH' | 'ANONYMOUS';

let role: TestRole = 'ASSISTANTE';
let pipelineActive = true;
const mockRequireInternalPipelineAccess = jest.fn(async () => {
  if (!pipelineActive) {
    return NextResponse.json({ error: 'Pipeline not active for internal staff' }, { status: 403 });
  }
  if (role === 'ANONYMOUS') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!['ADMIN', 'ASSISTANTE'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { user: { id: `staff-${role.toLowerCase()}`, role, email: `${role.toLowerCase()}@example.test` } };
});

jest.mock('@/lib/guards', () => ({
  isErrorResponse: (value: unknown) => value instanceof NextResponse,
}));

jest.mock('@/lib/quotes/candidat-individuel-guard.server', () => ({
  requireInternalPipelineAccess: () => mockRequireInternalPipelineAccess(),
}));

const mockStudentFindUnique = jest.fn();
const mockTransaction = jest.fn();
const mockQueryRaw = jest.fn();
const mockExecuteRawUnsafe = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: (...args: unknown[]) => mockStudentFindUnique(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const mockFindOrCaptureResponsableLead = jest.fn();
const mockNotifyContactLeadCaptureCommitted = jest.fn();

jest.mock('@/lib/crm/contact-leads', () => ({
  findOrCaptureResponsableLeadInTransaction: (...args: unknown[]) => mockFindOrCaptureResponsableLead(...args),
  getContactLeadEmailLockKey: (email: string) => `nexus:contact-lead:${email.trim().toLowerCase()}`,
  notifyContactLeadCaptureCommitted: () => mockNotifyContactLeadCaptureCommitted(),
}));

import { POST } from '@/app/api/assistante/candidat-individuel/identity/resolve/route';

const ROUTE = 'http://localhost:3000/api/assistante/candidat-individuel/identity/resolve';

const student = {
  id: 'student-profile-1',
  user: {
    id: 'student-user-1',
    firstName: 'Yasmine',
    lastName: 'Ben Salah',
    email: 'yasmine@example.test',
    mergedIntoUserId: null,
  },
  parent: {
    id: 'parent-profile-1',
    user: {
      id: 'parent-user-1',
      firstName: 'Sonia',
      lastName: 'Ben Salah',
      email: ' SONIA@Example.Test ',
      phone: '+21699111222',
      mergedIntoUserId: null,
    },
  },
};

const canonicalLead = {
  id: 'lead-canonical-1',
  name: 'Sonia Ben Salah',
  email: 'sonia@example.test',
  phone: '+21699111222',
  status: 'NEW',
};

function request(body: unknown = { studentId: 'student-profile-1' }) {
  return new NextRequest(ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function arrangeSuccess(lead = canonicalLead) {
  mockStudentFindUnique.mockResolvedValue(student);
  mockFindOrCaptureResponsableLead.mockResolvedValue(lead);
}

describe('POST /api/assistante/candidat-individuel/identity/resolve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    role = 'ASSISTANTE';
    pipelineActive = true;
    mockQueryRaw.mockResolvedValue([]);
    mockExecuteRawUnsafe.mockResolvedValue(0);
    mockTransaction.mockImplementation(async (operation: (tx: unknown) => unknown) => operation({
      student: { findUnique: mockStudentFindUnique },
      contactLead: {},
      jobOutbox: {},
      $queryRaw: mockQueryRaw,
      $executeRawUnsafe: mockExecuteRawUnsafe,
    }));
  });

  it.each(['ADMIN', 'ASSISTANTE'] as const)('allows %s through the exact staff guard', async (staffRole) => {
    role = staffRole;
    arrangeSuccess();

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mockRequireInternalPipelineAccess).toHaveBeenCalledTimes(1);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ANONYMOUS', 401],
    ['PARENT', 403],
    ['ELEVE', 403],
    ['COACH', 403],
  ] as const)('refuses %s through the role guard', async (rejectedRole, expectedStatus) => {
    role = rejectedRole;

    const response = await POST(request());

    expect(response.status).toBe(expectedStatus);
    expect(mockRequireInternalPipelineAccess).toHaveBeenCalledTimes(1);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 403 before any work when the internal pipeline is OFF', async () => {
    role = 'ADMIN';
    pipelineActive = false;

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mockRequireInternalPipelineAccess).toHaveBeenCalledTimes(1);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { studentId: '' },
    { studentId: 'student-profile-1', unexpected: true },
  ])('rejects a non-strict identity payload: %p', async (body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 404 and performs no lead capture when the Student row does not exist', async () => {
    mockStudentFindUnique.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: 'STUDENT_NOT_FOUND' });
    expect(mockStudentFindUnique).toHaveBeenCalledTimes(1);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockFindOrCaptureResponsableLead).not.toHaveBeenCalled();
  });

  it('fails closed on identity drift between the provisional and authoritative reads', async () => {
    mockStudentFindUnique
      .mockResolvedValueOnce(student)
      .mockResolvedValueOnce({
        ...student,
        parent: { ...student.parent, user: { ...student.parent.user, email: 'other-parent@example.test' } },
      });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
    expect(mockFindOrCaptureResponsableLead).not.toHaveBeenCalled();
  });

  it('fails closed when the nullable student email appears after the advisory locks', async () => {
    const studentWithoutEmail = { ...student, user: { ...student.user, email: null } };
    mockStudentFindUnique
      .mockResolvedValueOnce(studentWithoutEmail)
      .mockResolvedValueOnce(student);

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(2);
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
    expect(mockFindOrCaptureResponsableLead).not.toHaveBeenCalled();
  });

  it('fails closed when the responsible email is missing', async () => {
    mockStudentFindUnique.mockResolvedValue({
      ...student,
      parent: { ...student.parent, user: { ...student.parent.user, email: null } },
    });

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: 'RESPONSIBLE_UNAVAILABLE' });
    expect(mockFindOrCaptureResponsableLead).not.toHaveBeenCalled();
  });

  it('fails closed when the responsible account was merged', async () => {
    mockStudentFindUnique.mockResolvedValue({
      ...student,
      parent: { ...student.parent, user: { ...student.parent.user, mergedIntoUserId: 'parent-canonical' } },
    });

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: 'RESPONSIBLE_UNAVAILABLE' });
    expect(mockFindOrCaptureResponsableLead).not.toHaveBeenCalled();
  });

  it('fails closed when the student account was merged', async () => {
    mockStudentFindUnique.mockResolvedValue({
      ...student,
      user: { ...student.user, mergedIntoUserId: 'student-canonical' },
    });

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: 'STUDENT_UNAVAILABLE' });
    expect(mockFindOrCaptureResponsableLead).not.toHaveBeenCalled();
  });

  it('resolves a student without an email using only the remaining two advisory locks', async () => {
    const studentWithoutEmail = { ...student, user: { ...student.user, email: null } };
    mockStudentFindUnique.mockResolvedValue(studentWithoutEmail);
    mockFindOrCaptureResponsableLead.mockResolvedValue(canonicalLead);

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockStudentFindUnique).toHaveBeenCalledTimes(2);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(2);
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
    expect(mockFindOrCaptureResponsableLead).toHaveBeenCalledTimes(1);
    expect(body.student).toMatchObject({
      studentId: 'student-profile-1',
      userId: 'student-user-1',
      user: { email: null },
    });
  });

  it('reuses or creates the canonical lead and returns a curated, unambiguous identity contract', async () => {
    arrangeSuccess();

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockStudentFindUnique).toHaveBeenCalledTimes(2);
    expect(mockExecuteRawUnsafe).toHaveBeenCalled();
    const provisionalReadOrder = mockStudentFindUnique.mock.invocationCallOrder[0];
    const advisoryOrders = mockExecuteRawUnsafe.mock.invocationCallOrder;
    expect(provisionalReadOrder).toBeLessThan(advisoryOrders[0]);
    const advisoryKeys = mockExecuteRawUnsafe.mock.calls.map((call) => String(call[1]));
    expect(advisoryKeys).toEqual([...advisoryKeys].sort());
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
    expect(advisoryOrders.at(-1)).toBeLessThan(mockQueryRaw.mock.invocationCallOrder[0]);
    const lastLockOrder = mockQueryRaw.mock.invocationCallOrder.at(-1)!;
    const studentRereadOrder = mockStudentFindUnique.mock.invocationCallOrder[1];
    const leadCaptureOrder = mockFindOrCaptureResponsableLead.mock.invocationCallOrder[0];
    expect(lastLockOrder).toBeLessThan(studentRereadOrder);
    expect(studentRereadOrder).toBeLessThan(leadCaptureOrder);
    expect(mockFindOrCaptureResponsableLead).toHaveBeenCalledWith(expect.any(Object), {
      name: 'Sonia Ben Salah',
      email: ' SONIA@Example.Test ',
      phone: '+21699111222',
      source: 'STAFF_CANDIDAT_INDIVIDUEL_IDENTITY',
    }, { emailLockAlreadyHeld: true });
    expect(body).toEqual({
      success: true,
      contactLead: canonicalLead,
      student: {
        studentId: 'student-profile-1',
        userId: 'student-user-1',
        user: {
          firstName: 'Yasmine',
          lastName: 'Ben Salah',
          email: 'yasmine@example.test',
          mergedIntoUserId: null,
        },
        responsible: {
          parentProfileId: 'parent-profile-1',
          userId: 'parent-user-1',
          firstName: 'Sonia',
          lastName: 'Ben Salah',
          email: ' SONIA@Example.Test ',
          mergedIntoUserId: null,
        },
      },
    });
    expect(body.student.studentId).not.toBe(body.student.userId);
  });
});

import { GET, POST } from '@/app/api/npc/submissions/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn(), findFirst: jest.fn() },
    parentProfile: { findUnique: jest.fn() },
    coachProfile: { findUnique: jest.fn(), findFirst: jest.fn() },
    coachStudentAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
    copySubmission: { create: jest.fn(), findMany: jest.fn() },
    npcAuditLog: { create: jest.fn() },
  },
}));

function postRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/npc/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/npc/submissions security validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'coach-user-1', role: 'COACH' },
    });
  });

  it('rejects unsafe student ids before checking student ownership', async () => {
    const response = await POST(postRequest({
      studentId: '../student',
      title: 'Copie',
      subject: 'MATHEMATIQUES',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
    expect(prisma.copySubmission.create).not.toHaveBeenCalled();
  });

  it('rejects unsafe list filters before querying submissions', async () => {
    const response = await GET(
      new NextRequest('http://localhost:3000/api/npc/submissions?studentId=../student'),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(prisma.copySubmission.findMany).not.toHaveBeenCalled();
  });
});

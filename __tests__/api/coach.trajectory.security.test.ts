import { NextRequest } from 'next/server';

import { POST } from '@/app/api/coach/trajectory/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isCoachRattachedToStudent } from '@/lib/rbac/coach-student-access';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/rbac/coach-student-access', () => ({
  isCoachRattachedToStudent: jest.fn(),
}));

function request(body: unknown) {
  return new NextRequest('http://localhost:3000/api/coach/trajectory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/coach/trajectory — security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unexpected payload fields before any mutation', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });

    const response = await POST(request({
      studentId: 'student-1',
      title: 'Trajectoire',
      horizon: '3_MONTHS',
      metadata: { rawPayload: true },
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid trajectory payload');
    expect(prisma.trajectory.updateMany).not.toHaveBeenCalled();
    expect(prisma.trajectory.create).not.toHaveBeenCalled();
  });

  it('prevents a coach from creating a trajectory for an unassigned student', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    (isCoachRattachedToStudent as jest.Mock).mockResolvedValue(false);

    const response = await POST(request({
      studentId: 'student-b',
      title: 'Trajectoire hors scope',
      horizon: '6_MONTHS',
      targetScore: 15,
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
    expect(isCoachRattachedToStudent).toHaveBeenCalledWith('coach-1', 'student-b');
    expect(prisma.trajectory.updateMany).not.toHaveBeenCalled();
    expect(prisma.trajectory.create).not.toHaveBeenCalled();
  });

  it('allows an assigned coach and persists a projected trajectory', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    (isCoachRattachedToStudent as jest.Mock).mockResolvedValue(true);
    (prisma.trajectory.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.trajectory.create as jest.Mock).mockResolvedValue({
      id: 'traj-1',
      studentId: 'student-1',
      title: 'Trajectoire',
      targetScore: 16,
      horizon: '3_MONTHS',
      createdBy: 'coach-1',
      status: 'ACTIVE',
    });

    const response = await POST(request({
      studentId: 'student-1',
      title: 'Trajectoire',
      horizon: '3_MONTHS',
      targetScore: 16,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe('traj-1');
    expect(prisma.trajectory.updateMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1', status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
    });
    expect(prisma.trajectory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: 'student-1',
        createdBy: 'coach-1',
      }),
    }));
  });
});

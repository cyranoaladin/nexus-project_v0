jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import { NextRequest } from 'next/server';

import {
  DELETE,
  GET,
  POST,
} from '@/app/api/admin/stages/[stageId]/coaches/route';

const mockAuth = auth as jest.Mock;
let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

function session(role = 'ADMIN') {
  return {
    user: { id: `user-${role}`, email: `${role}@nexus.test`, role },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

const params = Promise.resolve({ stageId: 'stage-1' });

describe('P0 Lot 2F-bis admin stage coaches access', () => {
  it('refuse les utilisateurs non authentifiés', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(makeRequest('http://localhost/api/admin/stages/stage-1/coaches'), { params });

    expect(res.status).toBe(401);
  });

  it('refuse les non-admin', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));

    const res = await POST(makeRequest('http://localhost/api/admin/stages/stage-1/coaches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: 'coach-1' }),
    }), { params });

    expect(res.status).toBe(403);
  });

  it('retourne 404 si le stage de listing n’existe pas', async () => {
    mockAuth.mockResolvedValue(session('ADMIN'));
    prisma.stage.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest('http://localhost/api/admin/stages/stage-1/coaches'), { params });

    expect(res.status).toBe(404);
    expect(prisma.stageCoach.findMany).not.toHaveBeenCalled();
  });

  it('refuse un coach inexistant', async () => {
    mockAuth.mockResolvedValue(session('ADMIN'));
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1' });
    prisma.coachProfile.findUnique.mockResolvedValue(null);
    prisma.stageCoach.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest('http://localhost/api/admin/stages/stage-1/coaches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: 'coach-unknown' }),
    }), { params });

    expect(res.status).toBe(400);
    expect(prisma.stageCoach.create).not.toHaveBeenCalled();
  });

  it('refuse de supprimer une association coach appartenant à un autre stage', async () => {
    mockAuth.mockResolvedValue(session('ADMIN'));
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1' });
    prisma.stageCoach.deleteMany.mockResolvedValue({ count: 0 });

    const res = await DELETE(makeRequest('http://localhost/api/admin/stages/stage-1/coaches', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: 'coach-other-stage' }),
    }), { params });

    expect(res.status).toBe(404);
  });

  it('projette les coachs sans User complet ni PII', async () => {
    mockAuth.mockResolvedValue(session('ADMIN'));
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1' });
    prisma.stageCoach.findMany.mockResolvedValue([{
      id: 'assignment-1',
      coachId: 'coach-1',
      coach: {
        id: 'coach-1',
        pseudonym: 'Coach A',
        subjects: ['MATHEMATIQUES'],
        description: 'Description',
      },
    }]);

    const res = await GET(makeRequest('http://localhost/api/admin/stages/stage-1/coaches'), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain('password');
    expect(JSON.stringify(body)).not.toContain('phone');
    expect(JSON.stringify(body)).not.toContain('@');
  });
});

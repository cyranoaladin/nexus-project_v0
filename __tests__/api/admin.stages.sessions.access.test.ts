jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import { NextRequest } from 'next/server';

import {
  GET,
  POST,
} from '@/app/api/admin/stages/[stageId]/sessions/route';

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

const validSessionBody = {
  title: 'Séance 1',
  subject: 'MATHEMATIQUES',
  startAt: '2026-04-21T08:00:00.000Z',
  endAt: '2026-04-21T10:00:00.000Z',
  coachId: 'coach-1',
};

describe('P0 Lot 2F-bis admin stage sessions collection access', () => {
  it('refuse les utilisateurs non authentifiés', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(makeRequest('http://localhost/api/admin/stages/stage-1/sessions'), { params });

    expect(res.status).toBe(401);
  });

  it('refuse les rôles non staff', async () => {
    mockAuth.mockResolvedValue(session('COACH'));

    const res = await POST(makeRequest('http://localhost/api/admin/stages/stage-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSessionBody),
    }), { params });

    expect(res.status).toBe(403);
  });

  it('retourne 404 si le stage de listing n’existe pas', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));
    prisma.stage.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest('http://localhost/api/admin/stages/stage-1/sessions'), { params });

    expect(res.status).toBe(404);
    expect(prisma.stageSession.findMany).not.toHaveBeenCalled();
  });

  it('refuse une chronologie invalide', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));

    const res = await POST(makeRequest('http://localhost/api/admin/stages/stage-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validSessionBody,
        startAt: '2026-04-21T10:00:00.000Z',
        endAt: '2026-04-21T09:00:00.000Z',
      }),
    }), { params });

    expect(res.status).toBe(400);
  });

  it('refuse de créer une séance pour un coach non assigné au stage', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1' });
    prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
    prisma.stageCoach.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest('http://localhost/api/admin/stages/stage-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSessionBody),
    }), { params });

    expect(res.status).toBe(400);
    expect(prisma.stageSession.create).not.toHaveBeenCalled();
  });

  it('crée une séance avec le stageId du chemin, pas celui du body', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1' });
    prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
    prisma.stageCoach.findFirst.mockResolvedValue({ id: 'assignment-1' });
    prisma.stageSession.create.mockResolvedValue({ id: 'session-1', stageId: 'stage-1' });

    const res = await POST(makeRequest('http://localhost/api/admin/stages/stage-1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validSessionBody, stageId: 'stage-other' }),
    }), { params });

    expect(res.status).toBe(201);
    expect(prisma.stageSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stageId: 'stage-1' }),
    }));
    expect(prisma.stageSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ stageId: 'stage-other' }),
    }));
  });
});

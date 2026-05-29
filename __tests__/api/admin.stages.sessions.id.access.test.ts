jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import { NextRequest } from 'next/server';

import {
  DELETE,
  PATCH,
} from '@/app/api/admin/stages/[stageId]/sessions/[sessionId]/route';

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

const params = Promise.resolve({ stageId: 'stage-1', sessionId: 'session-1' });

describe('P0 Lot 2F-bis admin stage session item access', () => {
  it('refuse les utilisateurs non authentifiés', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await PATCH(makeRequest('http://localhost/api/admin/stages/stage-1/sessions/session-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Séance' }),
    }), { params });

    expect(res.status).toBe(401);
  });

  it('refuse les rôles non staff', async () => {
    mockAuth.mockResolvedValue(session('PARENT'));

    const res = await DELETE(makeRequest('http://localhost/api/admin/stages/stage-1/sessions/session-1', {
      method: 'DELETE',
    }), { params });

    expect(res.status).toBe(403);
  });

  it('refuse de patcher une séance appartenant à un autre stage', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));
    prisma.stageSession.findFirst.mockResolvedValue(null);

    const res = await PATCH(makeRequest('http://localhost/api/admin/stages/stage-1/sessions/session-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Séance déplacée' }),
    }), { params });

    expect(res.status).toBe(404);
    expect(prisma.stageSession.update).not.toHaveBeenCalled();
  });

  it('refuse de supprimer une séance appartenant à un autre stage', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));
    prisma.stageSession.findFirst.mockResolvedValue(null);

    const res = await DELETE(makeRequest('http://localhost/api/admin/stages/stage-1/sessions/session-1', {
      method: 'DELETE',
    }), { params });

    expect(res.status).toBe(404);
    expect(prisma.stageSession.delete).not.toHaveBeenCalled();
  });

  it('refuse une mise à jour qui rend endAt antérieur au startAt existant', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));
    prisma.stageSession.findFirst.mockResolvedValue({
      id: 'session-1',
      stageId: 'stage-1',
      startAt: new Date('2026-04-21T10:00:00.000Z'),
      endAt: new Date('2026-04-21T12:00:00.000Z'),
    });

    const res = await PATCH(makeRequest('http://localhost/api/admin/stages/stage-1/sessions/session-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endAt: '2026-04-21T09:00:00.000Z' }),
    }), { params });

    expect(res.status).toBe(400);
    expect(prisma.stageSession.update).not.toHaveBeenCalled();
  });

  it('refuse d’assigner un coach non rattaché au stage', async () => {
    mockAuth.mockResolvedValue(session('ASSISTANTE'));
    prisma.stageSession.findFirst.mockResolvedValue({
      id: 'session-1',
      stageId: 'stage-1',
      startAt: new Date('2026-04-21T10:00:00.000Z'),
      endAt: new Date('2026-04-21T12:00:00.000Z'),
    });
    prisma.coachProfile.findUnique.mockResolvedValue({ id: 'coach-1' });
    prisma.stageCoach.findFirst.mockResolvedValue(null);

    const res = await PATCH(makeRequest('http://localhost/api/admin/stages/stage-1/sessions/session-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: 'coach-1' }),
    }), { params });

    expect(res.status).toBe(400);
    expect(prisma.stageSession.update).not.toHaveBeenCalled();
  });
});

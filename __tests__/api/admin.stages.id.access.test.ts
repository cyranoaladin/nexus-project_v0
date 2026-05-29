jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import { NextRequest } from 'next/server';

import {
  DELETE,
  GET,
  PATCH,
} from '@/app/api/admin/stages/[stageId]/route';

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

describe('P0 Lot 2F-bis admin stage detail/mutation access', () => {
  it('refuse les utilisateurs non authentifiés', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(makeRequest('http://localhost/api/admin/stages/stage-1'), { params });

    expect(res.status).toBe(401);
  });

  it('refuse les rôles non admin sur PATCH', async () => {
    mockAuth.mockResolvedValue(session('COACH'));

    const res = await PATCH(makeRequest('http://localhost/api/admin/stages/stage-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Titre' }),
    }), { params });

    expect(res.status).toBe(403);
  });

  it('retourne 404 quand le stage à supprimer n’existe pas', async () => {
    mockAuth.mockResolvedValue(session('ADMIN'));
    prisma.stage.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest('http://localhost/api/admin/stages/stage-1', {
      method: 'DELETE',
    }), { params });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('Stage introuvable');
    expect(prisma.stage.update).not.toHaveBeenCalled();
  });

  it('ne transmet pas les champs extra sensibles au PATCH', async () => {
    mockAuth.mockResolvedValue(session('ADMIN'));
    prisma.stage.findUnique.mockResolvedValue({ id: 'stage-1', slug: 'stage-printemps' });
    prisma.stage.update.mockResolvedValue({ id: 'stage-1', slug: 'stage-printemps', title: 'Nouveau titre' });

    const res = await PATCH(makeRequest('http://localhost/api/admin/stages/stage-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Nouveau titre',
        activationToken: 'raw-token',
        reservations: [{ email: 'parent@example.com' }],
      }),
    }), { params });

    expect(res.status).toBe(200);
    expect(prisma.stage.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({
        activationToken: expect.anything(),
        reservations: expect.anything(),
      }),
    }));
  });
});

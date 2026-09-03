/**
 * Planning Studio — matrice de rôles des routes API (garde serveur réelle,
 * auth simulée, service simulé). La barrière est le serveur : même une
 * requête forgée par un COACH doit être refusée en écriture.
 */
import { NextRequest } from 'next/server';
import { auth } from '@/auth';

jest.mock('@/auth');
jest.mock('@/lib/prisma', () => ({ prisma: {} }));

jest.mock('@/app/api/planning-studio/_shared', () => {
  const actual = jest.requireActual('@/app/api/planning-studio/_shared');
  return {
    ...actual,
    planningService: {
      getOrInitDocument: jest.fn(),
      saveDocument: jest.fn(),
      listRevisions: jest.fn(),
      getRevision: jest.fn(),
      restoreRevision: jest.fn(),
      resetToBootstrap: jest.fn(),
      academicYear: '2026-2027',
    },
  };
});
import { planningService } from '@/app/api/planning-studio/_shared';
const mockService = planningService as unknown as Record<'getOrInitDocument' | 'saveDocument' | 'listRevisions' | 'getRevision' | 'restoreRevision' | 'resetToBootstrap', jest.Mock>;

import { GET, PUT } from '@/app/api/planning-studio/route';
import { GET as listRevisions } from '@/app/api/planning-studio/revisions/route';
import { GET as getRevision } from '@/app/api/planning-studio/revisions/[revision]/route';
import { POST as restore } from '@/app/api/planning-studio/restore/route';
import { PlanningConflictError, PlanningValidationError } from '@/lib/planning-studio/service';

type Role = 'ADMIN' | 'ASSISTANTE' | 'COACH' | 'PARENT' | 'ELEVE' | null;
type UserRole = Exclude<Role, null>;

function session(role: Role) {
  if (!role) (auth as jest.Mock).mockResolvedValue(null);
  else (auth as jest.Mock).mockResolvedValue({ user: { id: `user-${role.toLowerCase()}`, role, email: `${role.toLowerCase()}@example.test`, name: role } });
}

const doc = {
  id: 'doc-1', academicYear: '2026-2027', schemaVersion: 2, revision: 3, payload: { sessions: [] }, payloadHash: 'abc',
  createdAt: new Date('2026-09-03T10:00:00Z'), updatedAt: new Date('2026-09-03T11:00:00Z'), updatedById: 'user-admin',
  updatedBy: { id: 'user-admin', firstName: 'A', lastName: 'B', email: 'a@b', role: 'ADMIN' }, initialized: false,
};

const jsonReq = (method: string, body: unknown, path = 'http://localhost/api/planning-studio') =>
  new NextRequest(path, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  jest.clearAllMocks();
  mockService.getOrInitDocument.mockResolvedValue(doc);
  mockService.saveDocument.mockResolvedValue({ revision: 4, payloadHash: 'def', updatedAt: new Date(), stats: {}, warnings: 0 });
  mockService.listRevisions.mockResolvedValue([{ revision: 3 }]);
  mockService.getRevision.mockResolvedValue({ revision: 2, action: 'SAVE', summary: 's', createdAt: new Date(), payloadHash: 'h', payload: { sessions: [] } });
  mockService.restoreRevision.mockResolvedValue({ revision: 4 });
  mockService.resetToBootstrap.mockResolvedValue({ revision: 4 });
});

describe('GET /api/planning-studio', () => {
  it.each<UserRole>(['ADMIN', 'ASSISTANTE', 'COACH'])('%s lit le planning avec ses permissions', async (role) => {
    session(role);
    const res = await GET(new NextRequest('http://localhost/api/planning-studio'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.document.revision).toBe(3);
    expect(body.permissions.canEdit).toBe(role !== 'COACH');
    expect(body.permissions.canRestore).toBe(role === 'ADMIN');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it.each<UserRole>(['PARENT', 'ELEVE'])('%s est refusé (403)', async (role) => {
    session(role);
    const res = await GET(new NextRequest('http://localhost/api/planning-studio'));
    expect(res.status).toBe(403);
    expect(mockService.getOrInitDocument).not.toHaveBeenCalled();
  });

  it('anonyme est refusé (401)', async () => {
    session(null);
    const res = await GET(new NextRequest('http://localhost/api/planning-studio'));
    expect(res.status).toBe(401);
  });

  it('?meta=1 ne renvoie que la révision', async () => {
    session('COACH');
    const res = await GET(new NextRequest('http://localhost/api/planning-studio?meta=1'));
    const body = await res.json();
    expect(body.document.revision).toBe(3);
    expect(body.payload).toBeUndefined();
  });
});

describe('PUT /api/planning-studio', () => {
  it.each<UserRole>(['ADMIN', 'ASSISTANTE'])('%s enregistre une révision', async (role) => {
    session(role);
    const res = await PUT(jsonReq('PUT', { expectedRevision: 3, payload: { sessions: [] } }));
    expect(res.status).toBe(200);
    expect(mockService.saveDocument).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 3, actorId: `user-${role.toLowerCase()}`, action: 'SAVE' }));
  });

  it.each<UserRole>(['COACH', 'PARENT', 'ELEVE'])('%s ne peut pas écrire (403), même avec une requête forgée', async (role) => {
    session(role);
    const res = await PUT(jsonReq('PUT', { expectedRevision: 3, payload: { sessions: [] } }));
    expect(res.status).toBe(403);
    expect(mockService.saveDocument).not.toHaveBeenCalled();
  });

  it('anonyme : 401', async () => {
    session(null);
    expect((await PUT(jsonReq('PUT', { expectedRevision: 3, payload: {} }))).status).toBe(401);
  });

  it('requête invalide : 400', async () => {
    session('ADMIN');
    expect((await PUT(jsonReq('PUT', { expectedRevision: -1, payload: {} }))).status).toBe(400);
    expect((await PUT(jsonReq('PUT', { expectedRevision: 3 }))).status).toBe(400);
    expect((await PUT(new NextRequest('http://localhost/api/planning-studio', { method: 'PUT', body: '{oops' }))).status).toBe(400);
  });

  it('conflit de version : 409 avec la révision courante', async () => {
    session('ASSISTANTE');
    mockService.saveDocument.mockRejectedValue(new PlanningConflictError(5, new Date(), { id: 'u', name: 'Alaeddine', role: 'ADMIN' }));
    const res = await PUT(jsonReq('PUT', { expectedRevision: 3, payload: { sessions: [] } }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('PLANNING_REVISION_CONFLICT');
    expect(body.currentRevision).toBe(5);
    expect(body.message).toMatch(/modifié par un autre utilisateur/);
  });

  it('planning refusé par la validation serveur : 422 avec les conflits', async () => {
    session('ADMIN');
    mockService.saveDocument.mockRejectedValue(new PlanningValidationError(['1 conflit'], [{ id: 'x', severity: 'error', code: 'TEACHER_OVERLAP', title: 'Conflit', message: 'm', sessionIds: ['a'] }]));
    const res = await PUT(jsonReq('PUT', { expectedRevision: 3, payload: { sessions: [] } }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.blocking[0].code).toBe('TEACHER_OVERLAP');
  });

  it('RESET réservé à ADMIN', async () => {
    session('ASSISTANTE');
    expect((await PUT(jsonReq('PUT', { expectedRevision: 3, action: 'RESET' }))).status).toBe(403);
    expect(mockService.resetToBootstrap).not.toHaveBeenCalled();
    session('ADMIN');
    expect((await PUT(jsonReq('PUT', { expectedRevision: 3, action: 'RESET' }))).status).toBe(200);
    expect(mockService.resetToBootstrap).toHaveBeenCalledWith({ expectedRevision: 3, actorId: 'user-admin' });
  });

  it('IMPORT accepté pour ASSISTANTE', async () => {
    session('ASSISTANTE');
    const res = await PUT(jsonReq('PUT', { expectedRevision: 3, action: 'IMPORT', payload: { sessions: [] }, summary: 'Import de x.json' }));
    expect(res.status).toBe(200);
    expect(mockService.saveDocument).toHaveBeenCalledWith(expect.objectContaining({ action: 'IMPORT', summary: 'Import de x.json' }));
  });
});

describe('historique et restauration', () => {
  it('revisions : ADMIN seulement', async () => {
    session('ADMIN');
    expect((await listRevisions(new NextRequest('http://localhost/api/planning-studio/revisions?limit=5'))).status).toBe(200);
    expect(mockService.listRevisions).toHaveBeenCalledWith(5);
    for (const role of ['ASSISTANTE', 'COACH', 'PARENT'] as Role[]) {
      session(role);
      expect((await listRevisions(new NextRequest('http://localhost/api/planning-studio/revisions'))).status).toBe(403);
    }
    session(null);
    expect((await listRevisions(new NextRequest('http://localhost/api/planning-studio/revisions'))).status).toBe(401);
  });

  it('revisions/:n : ADMIN seulement, numéro validé', async () => {
    session('ADMIN');
    const ok = await getRevision(new NextRequest('http://localhost/api/planning-studio/revisions/2'), { params: Promise.resolve({ revision: '2' }) });
    expect(ok.status).toBe(200);
    expect((await ok.json()).revision).toBe(2);
    const bad = await getRevision(new NextRequest('http://localhost/api/planning-studio/revisions/abc'), { params: Promise.resolve({ revision: 'abc' }) });
    expect(bad.status).toBe(400);
    session('ASSISTANTE');
    const forbidden = await getRevision(new NextRequest('http://localhost/api/planning-studio/revisions/2'), { params: Promise.resolve({ revision: '2' }) });
    expect(forbidden.status).toBe(403);
  });

  it('restore : ADMIN seulement, verrou optimiste transmis', async () => {
    session('ADMIN');
    const res = await restore(jsonReq('POST', { revision: 2, expectedRevision: 3 }, 'http://localhost/api/planning-studio/restore'));
    expect(res.status).toBe(200);
    expect(mockService.restoreRevision).toHaveBeenCalledWith({ revision: 2, expectedRevision: 3, actorId: 'user-admin' });
    for (const role of ['ASSISTANTE', 'COACH'] as Role[]) {
      session(role);
      expect((await restore(jsonReq('POST', { revision: 2, expectedRevision: 3 }, 'http://localhost/api/planning-studio/restore'))).status).toBe(403);
    }
    session('ADMIN');
    expect((await restore(jsonReq('POST', { revision: 0, expectedRevision: 3 }, 'http://localhost/api/planning-studio/restore'))).status).toBe(400);
  });
});

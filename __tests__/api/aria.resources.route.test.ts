import { auth } from '@/auth';
import { GET } from '@/app/api/aria/resources/route';
import { listAriaResourcesForActor } from '@/lib/aria/application/resources/public';
import { AriaError } from '@/lib/aria/errors';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/aria/application/resources/public', () => ({
  listAriaResourcesForActor: jest.fn(),
}));

describe('GET /api/aria/resources', () => {
  const mockAuth = auth as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renvoie 401 si non authentifié', async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost:3000/api/aria/resources?courseKey=eds-maths-terminale');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('renvoie 400 si courseKey est manquant', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    const req = new NextRequest('http://localhost:3000/api/aria/resources');
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(listAriaResourcesForActor).not.toHaveBeenCalled();
  });

  it('renvoie 404 si courseKey est inconnu', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    (listAriaResourcesForActor as jest.Mock).mockRejectedValueOnce(
      new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.')
    );
    const req = new NextRequest('http://localhost:3000/api/aria/resources?courseKey=cours-inconnu');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('renvoie 403 si l élève n est pas inscrit au cours', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    (listAriaResourcesForActor as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie de votre scolarité')
    );

    // Cours de Première alors que l'élève est en Terminale
    const req = new NextRequest('http://localhost:3000/api/aria/resources?courseKey=eds-maths-premiere');
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('ne fait pas partie de votre scolarité');
  });

  it('renvoie 200 et la liste des ressources pour un cours valide', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    (listAriaResourcesForActor as jest.Mock).mockResolvedValueOnce({
      resources: [{ id: 'resource-1', courseKey: 'eds-maths-terminale' }],
    });

    const req = new NextRequest('http://localhost:3000/api/aria/resources?courseKey=eds-maths-terminale');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resources).toBeDefined();
    expect(data.resources.length).toBeGreaterThan(0);
    for (const r of data.resources) {
      expect(r.courseKey).toBe('eds-maths-terminale');
    }
    expect(listAriaResourcesForActor).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-terminale',
    });
  });
});

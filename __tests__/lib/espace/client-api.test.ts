import { createSaveApi } from '@/lib/espace/client/api';

const mockFetch = jest.fn();
const previousFetch = global.fetch;
beforeEach(() => { global.fetch = mockFetch; mockFetch.mockReset(); });
afterAll(() => { global.fetch = previousFetch; });
const input = { baseRevision: 2, stepId: 'scope', step: { fields: { '3-arith': 'no' } } };
const response = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

it('transmet la vue normalisée renvoyée par le serveur au moteur de sauvegarde', async () => {
  mockFetch.mockResolvedValue(response(200, { revision: 3, content: { v: 1, steps: { evidence: { fields: {} } } } }));
  await expect(createSaveApi('work-test').save(input)).resolves.toMatchObject({ kind: 'ok', revision: 3, steps: { evidence: { fields: {} } } });
  expect(mockFetch).toHaveBeenCalledWith('/api/espace/works/work-test', expect.objectContaining({ credentials: 'same-origin', method: 'PUT' }));
});

it.each([403, 404])('un accès retiré (%s) ne déclenche pas une boucle de réessai réseau', async status => {
  mockFetch.mockResolvedValue(response(status, { error: 'NOT_FOUND' }));
  await expect(createSaveApi('work-test').save(input)).resolves.toMatchObject({ kind: 'rejected' });
});

it('ne confirme jamais une sauvegarde sans révision serveur valide', async () => {
  mockFetch.mockResolvedValue(response(200, { message: 'page intermédiaire' }));
  await expect(createSaveApi('work-test').save(input)).rejects.toThrow();
});

it('fournit la nouvelle copie lors d’un conflit à la transmission', async () => {
  const current = { revision: 3, content: { v: 1, steps: { review: { fields: { confirmed: '' } } } } };
  mockFetch.mockResolvedValue(response(409, { error: 'REVISION_CONFLICT', details: { current } }));
  await expect(createSaveApi('work-test').submit({ baseRevision: 2 })).resolves.toMatchObject({ kind: 'conflict', current: { revision: 3, steps: current.content.steps } });
});

it('une session expirée est un refus explicite, sans réessai automatique réseau', async () => {
  mockFetch.mockResolvedValue(response(401, { error: 'UNAUTHENTICATED' }));
  await expect(createSaveApi('work-test').save(input)).resolves.toMatchObject({ kind: 'rejected', code: 'UNAUTHENTICATED', message: expect.stringContaining('reconnectez-vous') });
});

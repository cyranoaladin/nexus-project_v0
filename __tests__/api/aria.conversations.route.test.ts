import { auth } from '@/auth';
import { GET } from '@/app/api/aria/conversations/route';
import { listAriaConversations } from '@/lib/aria/application/history/public';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/history/public', () => ({ listAriaConversations: jest.fn() }));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

describe('GET /api/aria/conversations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthorized', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const response = await GET(new Request('http://localhost/api/aria/conversations') as never);
    expect(response.status).toBe(401);
  });

  it.each([
    'http://localhost/api/aria/conversations',
    'http://localhost/api/aria/conversations?subject=NSI',
    'http://localhost/api/aria/conversations?courseKey=eds-nsi-terminale&unknown=1',
    'http://localhost/api/aria/conversations?courseKey=eds-nsi-terminale&courseKey=eds-maths-premiere',
  ])('rejects a non-canonical query: %s', async (url) => {
    (auth as jest.Mock).mockResolvedValue({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await GET(new Request(url) as never);
    expect(response.status).toBe(400);
    expect(listAriaConversations).not.toHaveBeenCalled();
  });

  it('A018 ARIA-B-R010 lists active conversations by courseKey using the opaque cursor contract', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { role: 'ELEVE', id: 'user-1' } });
    (listAriaConversations as jest.Mock).mockResolvedValue({
      conversations: [{
        id: 'conv-1', courseKey: 'eds-nsi-terminale', contextState: 'ACTIVE',
        resumable: true, title: null, createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T11:00:00.000Z',
      }],
      nextCursor: 'opaque-next',
    });
    const response = await GET(new Request(
      'http://localhost/api/aria/conversations?courseKey=eds-nsi-terminale&limit=20',
    ) as never);
    await expect(response.json()).resolves.toMatchObject({
      conversations: [{ id: 'conv-1', courseKey: 'eds-nsi-terminale', resumable: true }],
      nextCursor: 'opaque-next',
    });
    expect(listAriaConversations).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' }, courseKey: 'eds-nsi-terminale',
      contextState: 'ACTIVE', cursor: undefined, limit: 20,
    });
  });

  it('THREAD_LEGACY_HISTORY_NULL_COURSE', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { role: 'ELEVE', id: 'user-1' } });
    (listAriaConversations as jest.Mock).mockResolvedValue({
      conversations: [{
        id: 'legacy-1', courseKey: null, contextState: 'LEGACY_CONTEXT_UNRESOLVED',
        resumable: false, title: 'Historique', createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T11:00:00.000Z',
      }],
      nextCursor: null,
    });
    const response = await GET(new Request(
      'http://localhost/api/aria/conversations?contextState=LEGACY_CONTEXT_UNRESOLVED',
    ) as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.conversations[0]).toMatchObject({ courseKey: null, resumable: false });
    expect(listAriaConversations).toHaveBeenCalledWith(expect.objectContaining({
      courseKey: undefined, contextState: 'LEGACY_CONTEXT_UNRESOLVED',
    }));
  });
});

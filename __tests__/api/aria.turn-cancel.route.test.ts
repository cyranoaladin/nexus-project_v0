import { auth } from '@/auth';
import { POST } from '@/app/api/aria/turns/[turnId]/cancel/route';
import { cancelAriaConversationTurn } from '@/lib/aria/application/conversation/public';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/conversation/public', () => ({ cancelAriaConversationTurn: jest.fn() }));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

const clientRequestId = '00000000-0000-4000-8000-000000000001';

describe('POST /api/aria/turns/:turnId/cancel', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    { clientRequestId, studentId: 'forged' },
    { clientRequestId, unknownField: true },
    { clientRequestId: 'not-a-uuid' },
  ])('strictly rejects mutation injection: %o', async (body) => {
    (auth as jest.Mock).mockResolvedValue({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await POST(new Request('http://localhost/api/aria/turns/turn-1/cancel', {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
    }) as never, { params: Promise.resolve({ turnId: 'turn-1' }) });
    expect(response.status).toBe(400);
    expect(cancelAriaConversationTurn).not.toHaveBeenCalled();
  });

  it('A016 ARIA-B-R090 uses only the authenticated actor and returns the persisted canonical state', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { role: 'ELEVE', id: 'user-1' } });
    (cancelAriaConversationTurn as jest.Mock).mockResolvedValue({
      turnId: 'turn-1', conversationId: 'conversation-1', status: 'RUNNING',
      disposition: 'CANCELLATION_REQUESTED',
      executionToken: 'internal-lease-secret',
    });
    const response = await POST(new Request('http://localhost/api/aria/turns/turn-1/cancel', {
      method: 'POST', body: JSON.stringify({ clientRequestId }),
      headers: { 'Content-Type': 'application/json' },
    }) as never, { params: Promise.resolve({ turnId: 'turn-1' }) });
    expect(response.status).toBe(202);
    expect(cancelAriaConversationTurn).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' }, turnId: 'turn-1', clientRequestId,
    });
    await expect(response.json()).resolves.toEqual({
      turnId: 'turn-1', status: 'RUNNING', disposition: 'CANCELLATION_REQUESTED',
      conversationId: 'conversation-1',
    });
  });

  it('classifies an invalid internal cancellation projection as INTERNAL_ERROR', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { role: 'ELEVE', id: 'user-1' } });
    (cancelAriaConversationTurn as jest.Mock).mockResolvedValue({
      turnId: 'turn-1', conversationId: 'conversation-1', status: 'RUNNING',
      disposition: 'CANCELLED',
    });
    const response = await POST(new Request('http://localhost/api/aria/turns/turn-1/cancel', {
      method: 'POST', body: JSON.stringify({ clientRequestId }),
      headers: { 'Content-Type': 'application/json' },
    }) as never, { params: Promise.resolve({ turnId: 'turn-1' }) });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
  });
});

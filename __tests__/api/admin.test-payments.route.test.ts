import { GET, POST } from '@/app/api/admin/test-payments/route';
import { getServerSession } from 'next-auth';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('admin test payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
  });

  it('blocks non admin/assistant', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ action: 'test_connection' }));

    expect(response.status).toBe(401);
  });

  it('returns configuration status on GET', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.configuration).toBeDefined();
  });

  it('returns 400 for create_test_payment with low amount', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    const response = await POST(
      makeRequest({ action: 'create_test_payment', amount: 50 })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('tests connection success', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ paymentRef: 'ref-1', paymentUrl: 'https://pay' }),
    });

    const response = await POST(makeRequest({ action: 'test_connection', testMode: true }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('checks status missing paymentRef', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    const response = await POST(makeRequest({ action: 'check_status' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('handles status check success', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'PAID' }),
    });

    const response = await POST(makeRequest({ action: 'check_status', paymentRef: 'ref-1' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

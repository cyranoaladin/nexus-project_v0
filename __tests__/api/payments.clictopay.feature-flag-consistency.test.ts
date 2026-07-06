import { POST as initPOST } from '@/app/api/payments/clictopay/init/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

function initRequest(body: unknown) {
  return new Request('http://localhost:3000/api/payments/clictopay/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('ClicToPay public flag consistency', () => {
  const originalFlag = process.env.NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC;

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC;
    } else {
      process.env.NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC = originalFlag;
    }
  });

  it('fails closed if public ClicToPay is enabled while backend remains disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC = 'true';

    const response = await initPOST(initRequest({ amount: 450000 }) as any);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: 'Configuration paiement incohérente',
      code: 'CLICTOPAY_PUBLIC_FLAG_INCONSISTENT',
    });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});

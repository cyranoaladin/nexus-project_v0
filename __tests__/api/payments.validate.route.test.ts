import { auth } from '@/auth';
import { POST } from '@/app/api/payments/validate/route';
import { prisma } from '@/lib/prisma';
import { activateEntitlements } from '@/lib/entitlement/engine';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/entitlement/engine', () => ({
  activateEntitlements: jest.fn().mockResolvedValue({
    activatedCodes: ['ABONNEMENT_ESSENTIEL'],
    skippedItems: 0,
    noBeneficiary: false,
  }),
}));

jest.mock('@/lib/utils', () => ({
  mergePaymentMetadata: jest.fn((existing: any, extra: any) => ({ value: { ...existing, ...extra } })),
  parsePaymentMetadata: jest.fn((m: any) => m),
}));

jest.mock('@/lib/invoice', () => ({
  renderInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('pdf')),
  generateInvoiceNumber: jest.fn().mockResolvedValue('INV-001'),
  storeInvoicePDF: jest.fn().mockResolvedValue('/tmp/invoice.pdf'),
  getInvoiceUrl: jest.fn().mockReturnValue('/api/invoices/1'),
  createInvoiceEvent: jest.fn().mockReturnValue({}),
  appendInvoiceEvent: jest.fn().mockReturnValue([]),
  tndToMillimes: jest.fn((v: number) => v * 1000),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: { findUnique: jest.fn(), update: jest.fn() },
    student: { findUnique: jest.fn() },
    subscription: { updateMany: jest.fn(), findFirst: jest.fn() },
    invoice: { findUnique: jest.fn(), update: jest.fn() },
    userDocument: { create: jest.fn() },
    creditTransaction: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('POST /api/payments/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not assistant', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Accès');
  });

  it('returns 404 when payment not found', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ paymentId: 'pay-1', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Paiement');
  });

  it('returns 400 on invalid payload', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    const response = await POST(makeRequest({ paymentId: 'pay-1', action: 'invalid' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Données');
  });

  it('approves payment via transaction', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-1',
      status: 'PENDING',
      type: 'SUBSCRIPTION',
      metadata: { studentId: 'student-1', itemKey: 'PLAN' },
      amount: 450,
      description: 'Abonnement Hybride',
      method: 'bank_transfer',
      userId: 'parent-1',
      user: {
        id: 'parent-1',
        email: 'parent@example.com',
        firstName: 'Parent',
        lastName: 'Nexus',
        parentProfile: { children: [{ id: 'student-1' }] },
      },
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        invoice: {
          create: jest.fn().mockResolvedValue({
            id: 'invoice-1',
            number: 'INV-001',
            issuedAt: new Date(),
            issuerName: 'Nexus Réussite',
            issuerAddress: 'Mutuelleville, Tunis',
            issuerMF: 'MF-1',
            issuerRNE: 'RNE-1',
            items: [{ label: 'Abonnement Hybride', description: null, qty: 1, unitPrice: 450000, total: 450000 }],
            currency: 'TND',
            subtotal: 450000,
            discountTotal: 0,
            taxTotal: 0,
            total: 450000,
            taxRegime: 'TVA_NON_APPLICABLE',
            customerName: 'Parent Nexus',
            customerEmail: 'parent@example.com',
            beneficiaryUserId: 'student-1',
            events: [],
          }),
        },
        student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
        subscription: { updateMany: jest.fn(), findFirst: jest.fn().mockResolvedValue({ creditsPerMonth: 0 }) },
        creditTransaction: { create: jest.fn() },
      };
      return cb(tx);
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: 'invoice-1',
      number: 'INV-001',
      issuedAt: new Date(),
      issuerName: 'Nexus Réussite',
      issuerAddress: 'Mutuelleville, Tunis',
      issuerMF: 'MF-1',
      issuerRNE: 'RNE-1',
      items: [{ label: 'Abonnement Hybride', description: null, qty: 1, unitPrice: 450000, total: 450000 }],
      currency: 'TND',
      subtotal: 450000,
      discountTotal: 0,
      taxTotal: 0,
      total: 450000,
      taxRegime: 'TVA_NON_APPLICABLE',
      customerName: 'Parent Nexus',
      customerEmail: 'parent@example.com',
      events: [],
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValue({});
    (prisma.userDocument.create as jest.Mock).mockResolvedValue({ id: 'doc-1' });

    const response = await POST(makeRequest({ paymentId: 'pay-1', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(activateEntitlements).toHaveBeenCalledWith('invoice-1', expect.any(Object));
  });

  it('allocates credits when subscription has credits', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-2',
      status: 'PENDING',
      type: 'SUBSCRIPTION',
      metadata: { studentId: 'student-1', itemKey: 'PLAN' },
      amount: 450,
      description: 'Abonnement Hybride',
      method: 'bank_transfer',
      userId: 'parent-1',
      user: {
        id: 'parent-1',
        email: 'parent@example.com',
        firstName: 'Parent',
        lastName: 'Nexus',
        parentProfile: { children: [{ id: 'student-1' }] },
      },
    });
    let capturedTx: any = null;
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        invoice: {
          create: jest.fn().mockResolvedValue({
            id: 'invoice-2',
            number: 'INV-002',
            issuedAt: new Date(),
            issuerName: 'Nexus Réussite',
            issuerAddress: 'Mutuelleville, Tunis',
            issuerMF: 'MF-1',
            issuerRNE: 'RNE-1',
            items: [{ label: 'Abonnement Hybride', description: null, qty: 1, unitPrice: 450000, total: 450000 }],
            currency: 'TND',
            subtotal: 450000,
            discountTotal: 0,
            taxTotal: 0,
            total: 450000,
            taxRegime: 'TVA_NON_APPLICABLE',
            customerName: 'Parent Nexus',
            customerEmail: 'parent@example.com',
            beneficiaryUserId: 'student-1',
            events: [],
          }),
        },
        student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
        subscription: { updateMany: jest.fn(), findFirst: jest.fn().mockResolvedValue({ creditsPerMonth: 4 }) },
        creditTransaction: { create: jest.fn() },
      };
      capturedTx = tx;
      return cb(tx);
    });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: 'invoice-2',
      number: 'INV-002',
      issuedAt: new Date(),
      issuerName: 'Nexus Réussite',
      issuerAddress: 'Mutuelleville, Tunis',
      issuerMF: 'MF-1',
      issuerRNE: 'RNE-1',
      items: [{ label: 'Abonnement Hybride', description: null, qty: 1, unitPrice: 450000, total: 450000 }],
      currency: 'TND',
      subtotal: 450000,
      discountTotal: 0,
      taxTotal: 0,
      total: 450000,
      taxRegime: 'TVA_NON_APPLICABLE',
      customerName: 'Parent Nexus',
      customerEmail: 'parent@example.com',
      events: [],
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValue({});
    (prisma.userDocument.create as jest.Mock).mockResolvedValue({ id: 'doc-2' });

    const response = await POST(makeRequest({ paymentId: 'pay-2', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(capturedTx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-1',
          type: 'MONTHLY_ALLOCATION',
          amount: 4,
        }),
      })
    );
  });

  it('does not activate subscription or credits when payment was already processed concurrently', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-race',
      status: 'PENDING',
      type: 'SUBSCRIPTION',
      metadata: { studentId: 'student-1', itemKey: 'PLAN' },
      user: { parentProfile: { children: [{ id: 'student-1' }] } },
    });
    let txSubscriptionUpdate: jest.Mock | undefined;
    let txCreditCreate: jest.Mock | undefined;
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      txSubscriptionUpdate = jest.fn();
      txCreditCreate = jest.fn();
      return cb({
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
        subscription: { updateMany: txSubscriptionUpdate, findFirst: jest.fn() },
        creditTransaction: { create: txCreditCreate },
      });
    });

    const response = await POST(makeRequest({ paymentId: 'pay-race', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('déjà');
    expect(txSubscriptionUpdate).not.toHaveBeenCalled();
    expect(txCreditCreate).not.toHaveBeenCalled();
  });

  it('rejects payment and updates status', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-3',
      status: 'PENDING',
      type: 'SUBSCRIPTION',
      metadata: { studentId: 'student-1' },
      user: { parentProfile: { children: [{ id: 'student-1' }] } },
    });

    const response = await POST(makeRequest({ paymentId: 'pay-3', action: 'reject', note: 'Nope' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-3' },
        data: expect.objectContaining({
          status: 'FAILED',
        }),
      })
    );
  });

  it('returns 409 on transaction conflict', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-4',
      status: 'PENDING',
      type: 'SUBSCRIPTION',
      metadata: { studentId: 'student-1', itemKey: 'PLAN' },
      user: { parentProfile: { children: [{ id: 'student-1' }] } },
    });
    const prismaError = new Error('Transaction conflict');
    (prismaError as any).code = 'P2034';
    (prisma.$transaction as jest.Mock).mockRejectedValue(prismaError);

    const response = await POST(makeRequest({ paymentId: 'pay-4', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('Conflit');
  });

  it('returns 404 on transaction P2025', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-5',
      status: 'PENDING',
      type: 'SUBSCRIPTION',
      metadata: { studentId: 'student-1', itemKey: 'PLAN' },
      user: { parentProfile: { children: [{ id: 'student-1' }] } },
    });
    const prismaError = new Error('Record not found');
    (prismaError as any).code = 'P2025';
    (prisma.$transaction as jest.Mock).mockRejectedValue(prismaError);

    const response = await POST(makeRequest({ paymentId: 'pay-5', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Ressource');
  });
});

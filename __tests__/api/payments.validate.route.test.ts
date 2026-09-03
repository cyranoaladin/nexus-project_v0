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

  it('rejects any student-scoped payment when the referenced student is outside the parent household', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-foreign-addon',
      status: 'PENDING',
      type: 'SPECIAL_PACK',
      metadata: { studentId: 'foreign-student', itemKey: 'ARIA_MATHS' },
      userId: 'parent-1',
      user: {
        id: 'parent-1',
        parentProfile: { children: [{ id: 'owned-student', userId: 'owned-user' }] },
      },
    });

    const response = await POST(makeRequest({ paymentId: 'pay-foreign-addon', action: 'approve' }));

    expect(response.status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
      // Cubic P1-A: 'PLAN' now correctly resolves to a suspended
      // SUBSCRIPTION_PLAN surface — these tests exercise the generic
      // transaction/credit-allocation mechanics, not suspension, so they use
      // a non-suspended legacy itemKey (dedicated suspension coverage lives
      // in the "historical payments predating..." and P0-ARIA-03 describe
      // blocks below).
      metadata: { studentId: 'student-1', itemKey: 'STAGE_MATHS_P1' },
      amount: 450,
      description: 'Abonnement Hybride',
      method: 'bank_transfer',
      userId: 'parent-1',
      user: {
        id: 'parent-1',
        email: 'parent@example.com',
        firstName: 'Parent',
        lastName: 'Nexus',
        parentProfile: { children: [{ id: 'student-1', userId: 'student-user-1' }] },
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
            beneficiaryUserId: 'student-user-1',
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
      // Cubic P1-A: 'PLAN' now correctly resolves to a suspended
      // SUBSCRIPTION_PLAN surface — these tests exercise the generic
      // transaction/credit-allocation mechanics, not suspension, so they use
      // a non-suspended legacy itemKey (dedicated suspension coverage lives
      // in the "historical payments predating..." and P0-ARIA-03 describe
      // blocks below).
      metadata: { studentId: 'student-1', itemKey: 'STAGE_MATHS_P1' },
      amount: 450,
      description: 'Abonnement Hybride',
      method: 'bank_transfer',
      userId: 'parent-1',
      user: {
        id: 'parent-1',
        email: 'parent@example.com',
        firstName: 'Parent',
        lastName: 'Nexus',
        parentProfile: { children: [{ id: 'student-1', userId: 'student-user-1' }] },
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
      // Cubic P1-A: 'PLAN' now correctly resolves to a suspended
      // SUBSCRIPTION_PLAN surface — these tests exercise the generic
      // transaction/credit-allocation mechanics, not suspension, so they use
      // a non-suspended legacy itemKey (dedicated suspension coverage lives
      // in the "historical payments predating..." and P0-ARIA-03 describe
      // blocks below).
      metadata: { studentId: 'student-1', itemKey: 'STAGE_MATHS_P1' },
      user: { parentProfile: { children: [{ id: 'student-1', userId: 'student-user-1' }] } },
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
      user: { parentProfile: { children: [{ id: 'student-1', userId: 'student-user-1' }] } },
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
      // Cubic P1-A: 'PLAN' now correctly resolves to a suspended
      // SUBSCRIPTION_PLAN surface — these tests exercise the generic
      // transaction/credit-allocation mechanics, not suspension, so they use
      // a non-suspended legacy itemKey (dedicated suspension coverage lives
      // in the "historical payments predating..." and P0-ARIA-03 describe
      // blocks below).
      metadata: { studentId: 'student-1', itemKey: 'STAGE_MATHS_P1' },
      user: { parentProfile: { children: [{ id: 'student-1', userId: 'student-user-1' }] } },
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
      // Cubic P1-A: 'PLAN' now correctly resolves to a suspended
      // SUBSCRIPTION_PLAN surface — these tests exercise the generic
      // transaction/credit-allocation mechanics, not suspension, so they use
      // a non-suspended legacy itemKey (dedicated suspension coverage lives
      // in the "historical payments predating..." and P0-ARIA-03 describe
      // blocks below).
      metadata: { studentId: 'student-1', itemKey: 'STAGE_MATHS_P1' },
      user: { parentProfile: { children: [{ id: 'student-1', userId: 'student-user-1' }] } },
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

// ─── P0-ARIA-03: sale-suspension is enforced on STAFF APPROVAL too ─────────
//
// A `Payment` created via bank-transfer/confirm before (or despite) the
// suspension check there always carries `metadata.itemType` — the same
// vocabulary `resolveSellablePaymentCatalogItem` uses. Staff approval must
// refuse to activate one of these for a currently-suspended surface, exactly
// like the parent-facing request route already does.
describe('POST /api/payments/validate — sale suspension (P0-ARIA-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function pendingPayment(overrides: Partial<{ itemType: string; itemKey: string }> = {}) {
    return {
      id: 'pay-suspended-1',
      status: 'PENDING',
      type: 'SUBSCRIPTION',
      amount: 450,
      description: 'Abonnement Hybride',
      method: 'bank_transfer',
      userId: 'parent-1',
      metadata: {
        studentId: 'student-1',
        itemType: overrides.itemType ?? 'subscription',
        itemKey: overrides.itemKey ?? 'HYBRIDE',
      },
      user: {
        id: 'parent-1',
        email: 'parent@example.com',
        firstName: 'Parent',
        lastName: 'Nexus',
        parentProfile: { children: [{ id: 'student-1', userId: 'student-user-1' }] },
      },
    };
  }

  it('CODEX_P0_ARIA_03_RED: refuses to approve a historical PENDING payment for a currently-suspended subscription surface', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(pendingPayment({ itemType: 'subscription' }));

    const response = await POST(makeRequest({ paymentId: 'pay-suspended-1', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('SALE_SUSPENDED');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(activateEntitlements).not.toHaveBeenCalled();
  });

  it('refuses to approve a historical PENDING payment for a currently-suspended ARIA addon surface', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(
      pendingPayment({ itemType: 'addon', itemKey: 'MATIERE_SUPPLEMENTAIRE' }),
    );

    const response = await POST(makeRequest({ paymentId: 'pay-suspended-1', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('SALE_SUSPENDED');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('still allows approving a SPECIAL_PACK payment (never suspended)', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(
      pendingPayment({ itemType: 'pack', itemKey: 'GRAND_ORAL' }),
    );
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb({
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      invoice: {
        create: jest.fn().mockResolvedValue({
          id: 'invoice-pack-1', number: 'INV-002', items: [], beneficiaryUserId: 'student-user-1',
        }),
      },
      student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
      subscription: { updateMany: jest.fn(), findFirst: jest.fn() },
      creditTransaction: { create: jest.fn() },
    }));
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: 'invoice-pack-1', number: 'INV-002', issuedAt: new Date(),
      issuerName: 'Nexus Réussite', issuerAddress: 'Mutuelleville, Tunis', issuerMF: 'MF-1', issuerRNE: 'RNE-1',
      items: [{ label: 'Grand Oral', description: null, qty: 1, unitPrice: 450000, total: 450000 }],
      currency: 'TND', subtotal: 450000, discountTotal: 0, taxTotal: 0, total: 450000,
      taxRegime: 'TVA_NON_APPLICABLE', customerName: 'Parent Nexus', customerEmail: 'parent@example.com', events: [],
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValue({});
    (prisma.userDocument.create as jest.Mock).mockResolvedValue({ id: 'doc-1' });

    const response = await POST(makeRequest({ paymentId: 'pay-suspended-1', action: 'approve' }));

    expect(response.status).toBe(200);
  });

  it('never blocks rejecting a payment for a suspended surface — rejection always stays available', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(pendingPayment({ itemType: 'subscription' }));
    (prisma.payment.update as jest.Mock).mockResolvedValue({});

    const response = await POST(makeRequest({ paymentId: 'pay-suspended-1', action: 'reject', note: 'test' }));

    expect(response.status).toBe(200);
  });

  // Cubic P1-A: a Payment created BEFORE bank-transfer/confirm started
  // stamping `metadata.itemType` never carries that field at all — only the
  // legacy `metadata.itemKey` (and the coarse Prisma `payment.type`).
  describe('historical payments predating the metadata.itemType convention (Cubic P1-A)', () => {
    function historicalPayment(overrides: Partial<{ type: string; itemKey: string }>) {
      return {
        id: 'pay-historical-1',
        status: 'PENDING',
        type: overrides.type ?? 'SUBSCRIPTION',
        amount: 450,
        description: 'Abonnement Hybride',
        method: 'bank_transfer',
        userId: 'parent-1',
        metadata: {
          studentId: 'student-1',
          itemKey: overrides.itemKey,
          // itemType deliberately absent — the historical shape.
        },
        user: {
          id: 'parent-1',
          email: 'parent@example.com',
          firstName: 'Parent',
          lastName: 'Nexus',
          parentProfile: { children: [{ id: 'student-1', userId: 'student-user-1' }] },
        },
      };
    }

    it('CODEX_CUBIC_P1A_RED: refuses to approve a historical subscription payment with itemKey but no itemType', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(
        historicalPayment({ type: 'SUBSCRIPTION', itemKey: 'HYBRIDE' }),
      );

      const response = await POST(makeRequest({ paymentId: 'pay-historical-1', action: 'approve' }));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.code).toBe('SALE_SUSPENDED');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to approve a historical ARIA addon payment with itemKey but no itemType', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(
        historicalPayment({ type: 'SPECIAL_PACK', itemKey: 'ARIA_MATHS' }),
      );

      const response = await POST(makeRequest({ paymentId: 'pay-historical-1', action: 'approve' }));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.code).toBe('SALE_SUSPENDED');
    });

    it('refuses to approve when metadata is genuinely unidentifiable on a SUBSCRIPTION-typed payment (fail closed, never guessed)', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(
        historicalPayment({ type: 'SUBSCRIPTION', itemKey: undefined }),
      );

      const response = await POST(makeRequest({ paymentId: 'pay-historical-1', action: 'approve' }));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.code).toBe('SALE_SUSPENDED');
    });

    it('still allows approving a historical SPECIAL_PACK/stage payment with no itemType', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(
        historicalPayment({ type: 'CREDIT_PACK', itemKey: 'STAGE_MATHS_P1' }),
      );
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb({
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        invoice: {
          create: jest.fn().mockResolvedValue({
            id: 'invoice-hist-1', number: 'INV-003', items: [], beneficiaryUserId: 'student-user-1',
          }),
        },
        student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
        subscription: { updateMany: jest.fn(), findFirst: jest.fn() },
        creditTransaction: { create: jest.fn() },
      }));
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
        id: 'invoice-hist-1', number: 'INV-003', issuedAt: new Date(),
        issuerName: 'Nexus Réussite', issuerAddress: 'Mutuelleville, Tunis', issuerMF: 'MF-1', issuerRNE: 'RNE-1',
        items: [{ label: 'Stage Maths', description: null, qty: 1, unitPrice: 450000, total: 450000 }],
        currency: 'TND', subtotal: 450000, discountTotal: 0, taxTotal: 0, total: 450000,
        taxRegime: 'TVA_NON_APPLICABLE', customerName: 'Parent Nexus', customerEmail: 'parent@example.com', events: [],
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValue({});
      (prisma.userDocument.create as jest.Mock).mockResolvedValue({ id: 'doc-1' });

      const response = await POST(makeRequest({ paymentId: 'pay-historical-1', action: 'approve' }));

      expect(response.status).toBe(200);
    });

    it('still allows rejecting a historical payment regardless of how its surface resolves', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } });
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(
        historicalPayment({ type: 'SUBSCRIPTION', itemKey: 'HYBRIDE' }),
      );
      (prisma.payment.update as jest.Mock).mockResolvedValue({});

      const response = await POST(makeRequest({ paymentId: 'pay-historical-1', action: 'reject', note: 'test' }));

      expect(response.status).toBe(200);
    });
  });
});

/**
 * Tests P0-04: Payment validation must create invoice with productCode
 * and activate entitlement atomically.
 */

import { POST as validatePayment } from '@/app/api/payments/validate/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { activateEntitlements } from '@/lib/entitlement/engine';

jest.mock('@/auth');
jest.mock('@/lib/entitlement/engine', () => ({
  activateEntitlements: jest.fn().mockResolvedValue({
    activatedCodes: ['ABONNEMENT_HYBRIDE'],
    skippedItems: 0,
    noBeneficiary: false,
  }),
}));
jest.mock('@/lib/invoice', () => ({
  renderInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('PDF')),
  generateInvoiceNumber: jest.fn().mockResolvedValue('INV-TEST-001'),
  storeInvoicePDF: jest.fn().mockResolvedValue('/data/invoices/test.pdf'),
  getInvoiceUrl: jest.fn().mockReturnValue('/invoices/test.pdf'),
  createInvoiceEvent: jest.fn((type: string, by: string, detail: string) => ({ type, by, detail, at: new Date().toISOString() })),
  appendInvoiceEvent: jest.fn((events: any[], evt: any) => [...events, evt]),
  tndToMillimes: jest.fn((tnd: number) => tnd * 1000),
}));

function mockAdminSession() {
  (auth as jest.Mock).mockResolvedValue({
    user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
  });
}

function req(body: object) {
  return new NextRequest('http://localhost/api/payments/validate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/payments/validate — P0-04 entitlement bridge', () => {
  let tx: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminSession();
    tx = undefined;

    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay-test-1',
      amount: 450,
      description: 'Abonnement Hybride',
      status: 'PENDING',
      type: 'SUBSCRIPTION',
      method: 'bank_transfer',
      userId: 'parent-user-1',
      metadata: { studentId: 'child-user-1', itemKey: 'HYBRIDE' },
      user: {
        id: 'parent-user-1',
        email: 'parent@test.com',
        firstName: 'P',
        lastName: 'A',
        parentProfile: {
          children: [{ id: 'child-user-1' }],
        },
      },
    });

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
      tx = {
        payment: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        invoice: {
          create: jest.fn().mockResolvedValue({
            id: 'invoice-1',
            number: 'INV-TEST-001',
            issuedAt: new Date(),
            issuerName: 'Nexus Réussite',
            issuerAddress: 'Mutuelleville, Tunis',
            issuerMF: 'MF-TEST',
            issuerRNE: 'RNE-TEST',
            items: [
              {
                label: 'Abonnement Hybride',
                description: null,
                qty: 1,
                unitPrice: 450000,
                total: 450000,
              },
            ],
            currency: 'TND',
            subtotal: 450000,
            discountTotal: 0,
            taxTotal: 0,
            total: 450000,
            taxRegime: 'TVA_NON_APPLICABLE',
            customerName: 'P A',
            customerEmail: 'parent@test.com',
            beneficiaryUserId: 'child-user-1',
            events: [],
          }),
          findUnique: jest.fn().mockResolvedValue({
            id: 'invoice-1',
            number: 'INV-TEST-001',
            issuerName: 'Nexus Réussite',
            issuerAddress: 'Mutuelleville, Tunis',
            issuerMF: 'MF-TEST',
            issuerRNE: 'RNE-TEST',
            items: [{ label: 'Abonnement Hybride', description: null, qty: 1, unitPrice: 450000, total: 450000 }],
            currency: 'TND',
            subtotal: 450000,
            discountTotal: 0,
            taxTotal: 0,
            total: 450000,
            taxRegime: 'TVA_NON_APPLICABLE',
            customerName: 'P A',
            customerEmail: 'parent@test.com',
            events: [],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        student: {
          findUnique: jest.fn().mockResolvedValue({ id: 'child-user-1' }),
        },
        subscription: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        creditTransaction: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      return callback(tx);
    });

    (prisma.invoice.update as jest.Mock).mockResolvedValue({});
    (prisma.userDocument.create as jest.Mock).mockResolvedValue({ id: 'doc-1' });
  });

  it('creates invoice with productCode and activates entitlement', async () => {
    const response = await validatePayment(req({ paymentId: 'pay-test-1', action: 'approve' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(activateEntitlements).toHaveBeenCalledWith('invoice-1', tx);
    const invoiceCreateArg = tx.invoice.create.mock.calls[0][0];
    expect(invoiceCreateArg.data.beneficiaryUserId).toBe('child-user-1');
    expect(invoiceCreateArg.data.items.create[0].productCode).toBe('ABONNEMENT_HYBRIDE');
  });
});

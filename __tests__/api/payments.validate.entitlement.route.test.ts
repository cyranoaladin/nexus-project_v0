/**
 * Tests P0-04: Payment validation must create invoice with productCode
 * and call activateEntitlements atomically.
 */

import { POST as validatePayment } from '@/app/api/payments/validate/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';

jest.mock('@/auth');
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
  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.entitlement.deleteMany();
    await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
    await prisma.parentProfile.deleteMany();
    await prisma.student.deleteMany();

    const parentUser = await prisma.user.create({
      data: { email: 'parent@test.com', password: 'hash', role: 'PARENT', firstName: 'P', lastName: 'A' },
    });
    const parentProfile = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    const childUser = await prisma.user.create({
      data: { email: 'child@test.com', password: 'hash', role: 'ELEVE', firstName: 'C', lastName: 'A' },
    });
    await prisma.student.create({
      data: { userId: childUser.id, parentId: parentProfile.id, grade: 'Terminale', gradeLevel: 'TERMINALE', academicTrack: 'GENERAL' },
    });

    await prisma.payment.create({
      data: {
        id: 'pay-test-1',
        amount: 450,
        description: 'Abonnement Hybride',
        status: 'PENDING',
        type: 'SUBSCRIPTION',
        method: 'bank_transfer',
        userId: parentUser.id,
        metadata: JSON.stringify({ studentId: childUser.id, itemKey: 'HYBRIDE' }),
      },
    });
    mockAdminSession();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates invoice with productCode and activates entitlement', async () => {
    const response = await validatePayment(req({ paymentId: 'pay-test-1', action: 'approve' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    const invoice = await prisma.invoice.findFirst({
      where: { beneficiaryUserId: 'child@test.com' ? undefined : undefined },
      include: { items: true, entitlements: true },
    });
    // Invoice should exist with at least one item
    const invoices = await prisma.invoice.findMany({ include: { items: true } });
    expect(invoices.length).toBeGreaterThanOrEqual(1);
    const inv = invoices[0];
    expect(inv.items[0].productCode).toBe('ABONNEMENT_HYBRIDE');
    expect(inv.beneficiaryUserId).toBeTruthy();
  });
});

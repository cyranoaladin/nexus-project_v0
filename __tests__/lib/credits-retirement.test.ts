import * as credits from '@/lib/credits';
import * as cron from '@/lib/cron-jobs';
import { prisma } from '@/lib/prisma';
import { sendCreditExpirationReminder } from '@/lib/email';
jest.mock('@/lib/prisma', () => ({ prisma: {
  creditTransaction: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  cronExecution: { create: jest.fn(), update: jest.fn() }, $transaction: jest.fn()
} }));
jest.mock('@/lib/email', () => ({ sendCreditExpirationReminder: jest.fn() }));
describe('Credit retirement preserves historical records', () => {
  beforeEach(() => jest.clearAllMocks());
  it('legacy allocations, debits, refunds and expirations are inert', async () => {
    await credits.allocateMonthlyCredits('student', 10);
    await credits.debitCredits('student', 1, 'session', 'legacy');
    await credits.refundCredits('student', 1, 'session', 'legacy');
    await credits.refundSessionBookingById('session');
    await credits.expireOldCredits();
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
    expect(prisma.creditTransaction.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('scheduled legacy jobs neither alter history nor send reminders', async () => {
    await cron.allocateMonthlyCredits(); await cron.expireOldCredits(); await cron.checkExpiringCredits();
    expect(prisma.cronExecution.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.creditTransaction.findMany).not.toHaveBeenCalled();
    expect(sendCreditExpirationReminder).not.toHaveBeenCalled();
  });
  it('balances no longer gate educational access', async () => {
    expect(await credits.checkCreditBalance('student', 99)).toBe(true);
    expect(credits.calculateCreditCost('COURS_INDIVIDUEL' as any)).toBe(0);
    expect(prisma.creditTransaction.findMany).not.toHaveBeenCalled();
  });
});

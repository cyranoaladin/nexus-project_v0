/** @jest-environment node */
import { generateRawToken, verifyAccessToken } from '@/lib/invoice/access-token';
import { prisma } from '@/lib/prisma';
const now = new Date('2026-10-04T12:00:00Z');
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers(); jest.setSystemTime(now);
  (prisma.invoiceAccessToken.findUnique as jest.Mock).mockResolvedValue({
    invoiceId:'synthetic-invoice',expiresAt:new Date(now.getTime()+1000),revokedAt:null,
  });
});
afterEach(() => { jest.useRealTimers(); });
it('refuses a link exactly at its expiry instant', async () => {
  (prisma.invoiceAccessToken.findUnique as jest.Mock).mockResolvedValue({invoiceId:'synthetic-invoice',expiresAt:now,revokedAt:null});
  await expect(verifyAccessToken(generateRawToken())).resolves.toEqual({valid:false,reason:'EXPIRED'});
});
it('accepts an unrevoked opaque link strictly before expiry', async () => {
  await expect(verifyAccessToken(generateRawToken())).resolves.toEqual({valid:true,invoiceId:'synthetic-invoice'});
});
it.each(['','short','A'.repeat(64),'0'.repeat(63),'0'.repeat(65),'0'.repeat(64)+' ','0'.repeat(64)+'\0','é'.repeat(64)])(
  'refuses a malformed link before hashing or querying', async raw => {
    await expect(verifyAccessToken(raw)).resolves.toEqual({valid:false,reason:'NOT_FOUND'});
    expect(prisma.invoiceAccessToken.findUnique).not.toHaveBeenCalled();
  },
);

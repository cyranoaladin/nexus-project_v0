import type { Prisma, PrismaClient } from '@prisma/client';

/** Real PostgreSQL rows remain locked; advance wall time during the final identity read. */
export function delayFinalV1Verification(client: PrismaClient, deadline: Date,
  when: (tx: Prisma.TransactionClient) => Promise<boolean> = async () => true) {
  let waited = false;
  const realTransaction = client.$transaction.bind(client);
  const intercepted = jest.spyOn(client, '$transaction').mockImplementation((async (
    operation: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object,
  ) => realTransaction(async tx => {
    const realQuery = tx.$queryRaw.bind(tx); let identityReads = 0;
    const delayed = jest.spyOn(tx, '$queryRaw').mockImplementation((async (...args: Parameters<typeof tx.$queryRaw>) => {
      const result = await realQuery(...args);
      const query = Array.isArray(args[0]) ? args[0].join('') : '';
      if (query.includes('FROM public.users') && ++identityReads === 2 && await when(tx)) {
        waited = true;
        await new Promise(resolve => setTimeout(resolve, Math.max(1, deadline.getTime() - Date.now() + 25)));
      }
      return result;
    }) as typeof tx.$queryRaw);
    try { return await operation(tx); } finally { delayed.mockRestore(); }
  }, options)) as typeof client.$transaction);
  return { didWait: () => waited, restore: () => intercepted.mockRestore() };
}

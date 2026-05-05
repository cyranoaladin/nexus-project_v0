import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};


// Production pool tuning: append ?connection_limit=10&pool_timeout=30 to DATABASE_URL
// or use Prisma Accelerate / PgBouncer for connection pooling in high-traffic environments.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

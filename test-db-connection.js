// Simple Prisma connectivity check without exposing secrets
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('DB connection OK');
    process.exit(0);
  } catch (e) {
    console.error('DB connection FAILED:', e?.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();

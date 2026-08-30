/** Compatibility exports for legacy tests. The reset has one implementation. */
import { setupTestDatabase, testPrisma } from './setup/test-database';

export const cleanDatabase = setupTestDatabase;
export const prisma = testPrisma;

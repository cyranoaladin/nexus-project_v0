/**
 * Jest Global Setup for Integration Tests
 * 
 * Provides automatic cleanup between tests to avoid constraint violations.
 * Ensures each test runs with a clean database state.
 */

import { beforeEach, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clean all tables using TRUNCATE strategy (resets IDs to 1)
 * Called before each test to ensure clean state with zero pollution
 */
export async function cleanDatabase() {
  // Get all table names from the database
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename != '_prisma_migrations'
  `;

  // Disable triggers and foreign key checks
  await prisma.$executeRawUnsafe('SET session_replication_role = replica;');

  try {
    // TRUNCATE all tables with RESTART IDENTITY CASCADE
    // This resets auto-increment counters to 1 and cascades to dependent tables
    for (const { tablename } of tables) {
      try {
        await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE;`
        );
      } catch (error) {
        // Log but don't fail - some tables might have special constraints
        console.warn(`[Test Setup] Could not truncate ${tablename}:`, error);
      }
    }
  } finally {
    // Re-enable triggers and foreign key checks
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
  }
}

/**
 * Setup hook - runs before each test
 */
beforeEach(async () => {
  await cleanDatabase();
});

/**
 * Teardown hook - runs after all tests
 */
afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Export prisma instance for tests
 */
export { prisma };

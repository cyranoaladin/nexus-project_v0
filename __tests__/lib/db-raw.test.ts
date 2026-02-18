/**
 * Tests for lib/db-raw.ts — centralized raw SQL helper.
 *
 * Verifies:
 * - dbExecute delegates to prisma.$executeRawUnsafe with params
 * - dbQuery delegates to prisma.$queryRawUnsafe with params
 * - Both reject queries containing string interpolation (${...})
 */

import { dbExecute, dbQuery } from '@/lib/db-raw';

describe('db-raw', () => {
  const mockPrisma = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: '1' }]),
  } as unknown as import('@prisma/client').PrismaClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('dbExecute', () => {
    it('delegates to $executeRawUnsafe with params', async () => {
      const result = await dbExecute(
        mockPrisma,
        'UPDATE "assessments" SET "ssn" = $1 WHERE "id" = $2',
        42.5,
        'abc-123'
      );
      expect(result).toBe(1);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        'UPDATE "assessments" SET "ssn" = $1 WHERE "id" = $2',
        42.5,
        'abc-123'
      );
    });

    it('rejects queries with string interpolation', async () => {
      await expect(
        dbExecute(mockPrisma, 'UPDATE "assessments" SET "ssn" = ${value}')
      ).rejects.toThrow('SECURITY');
    });
  });

  describe('dbQuery', () => {
    it('delegates to $queryRawUnsafe with params', async () => {
      const result = await dbQuery<{ id: string }>(
        mockPrisma,
        'SELECT "id" FROM "assessments" WHERE "studentId" = $1',
        'student-1'
      );
      expect(result).toEqual([{ id: '1' }]);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT "id" FROM "assessments" WHERE "studentId" = $1',
        'student-1'
      );
    });

    it('rejects queries with string interpolation', async () => {
      await expect(
        dbQuery(mockPrisma, 'SELECT * FROM "users" WHERE "id" = ${userId}')
      ).rejects.toThrow('SECURITY');
    });

    it('allows queries with dollar-sign placeholders', async () => {
      await dbQuery(mockPrisma, 'SELECT * FROM "users" WHERE "id" = $1', 'u1');
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
    });
  });
});

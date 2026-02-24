/**
 * DB Raw — Complete Test Suite
 *
 * Tests: dbExecute, dbQuery (parameterized SQL with injection prevention)
 *
 * Source: lib/db-raw.ts
 */

import { dbExecute, dbQuery } from '@/lib/db-raw';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── dbExecute ───────────────────────────────────────────────────────────────

describe('dbExecute', () => {
  it('should execute parameterized SQL', async () => {
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const result = await dbExecute(prisma, 'UPDATE "users" SET "name" = $1 WHERE "id" = $2', 'John', 'u1');

    expect(result).toBe(1);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'UPDATE "users" SET "name" = $1 WHERE "id" = $2',
      'John',
      'u1'
    );
  });

  it('should reject queries with string interpolation', async () => {
    await expect(
      dbExecute(prisma, 'UPDATE "users" SET "name" = \'${injected}\' WHERE "id" = $1', 'u1')
    ).rejects.toThrow('SECURITY');
  });

  it('should reject queries containing ${ pattern', async () => {
    await expect(
      dbExecute(prisma, 'SELECT * FROM users WHERE id = ${userId}')
    ).rejects.toThrow('string interpolation');
  });

  it('should allow queries with $1 placeholders', async () => {
    prisma.$executeRawUnsafe.mockResolvedValue(0);

    await expect(
      dbExecute(prisma, 'DELETE FROM "sessions" WHERE "id" = $1', 'sess-1')
    ).resolves.toBe(0);
  });

  it('should pass multiple parameters correctly', async () => {
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    await dbExecute(
      prisma,
      'INSERT INTO "logs" ("id", "action", "userId") VALUES ($1, $2, $3)',
      'log-1', 'LOGIN', 'u1'
    );

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'INSERT INTO "logs" ("id", "action", "userId") VALUES ($1, $2, $3)',
      'log-1', 'LOGIN', 'u1'
    );
  });
});

// ─── dbQuery ─────────────────────────────────────────────────────────────────

describe('dbQuery', () => {
  it('should execute parameterized SELECT query', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'u1', name: 'John' }]);

    const result = await dbQuery<{ id: string; name: string }>(
      prisma,
      'SELECT "id", "name" FROM "users" WHERE "id" = $1',
      'u1'
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('John');
  });

  it('should reject queries with string interpolation', async () => {
    await expect(
      dbQuery(prisma, 'SELECT * FROM users WHERE id = ${userId}')
    ).rejects.toThrow('SECURITY');
  });

  it('should return empty array when no results', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    const result = await dbQuery(prisma, 'SELECT * FROM "users" WHERE "id" = $1', 'nonexistent');

    expect(result).toEqual([]);
  });

  it('should pass multiple parameters correctly', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    await dbQuery(
      prisma,
      'SELECT * FROM "assessments" WHERE "studentEmail" = $1 AND "subject" = $2',
      'test@example.com', 'MATHS'
    );

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT * FROM "assessments" WHERE "studentEmail" = $1 AND "subject" = $2',
      'test@example.com', 'MATHS'
    );
  });

  it('should allow complex safe queries', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ count: 5 }]);

    const result = await dbQuery<{ count: number }>(
      prisma,
      'SELECT COUNT(*) as count FROM "assessments" WHERE "createdAt" >= $1 AND "status" = $2',
      new Date('2026-01-01'), 'COMPLETED'
    );

    expect(result[0].count).toBe(5);
  });
});

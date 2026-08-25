/**
 * DB integration test for ShadowComparisonLog (recâblage mission §3/§7).
 */
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { testPrisma, canConnectToTestDb } from '../setup/test-database';
import { logShadowComparison } from '@/lib/quotes/shadow-persistence.server';
import { computeSituationChecksum } from '@/lib/quotes/shadow-comparison';

const prisma = testPrisma;

describe('ShadowComparisonLog persistence', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) console.warn('Skipping shadow comparison log tests: test database not available');
  }, 10000);

  afterEach(async () => {
    if (!dbAvailable) return;
    await prisma.shadowComparisonLog.deleteMany();
  });

  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  }, 30000);

  test('persists a comparison record with no PII field', async () => {
    if (!dbAvailable) return;
    const checksum = computeSituationChecksum({ level: 'terminale', examSession: 2027, specialites: ['MATHEMATIQUES', 'NSI'] });
    await logShadowComparison({
      situationChecksum: checksum,
      divergenceCategory: 'INSUFFICIENT_INPUT',
      legacySummary: { subjects: ['eds1', 'eds2'], priceAnnualTnd: 6200, depositTnd: 1550, installmentTnd: 465, status: 'LEGACY_SCENARIO', warningsCount: 0 },
      newSummary: { subjects: [], priceAnnualTnd: null, depositTnd: null, installmentTnd: null, status: 'INVALID', warningsCount: 1 },
      detail: 'modalité absente',
    });

    const rows = await prisma.shadowComparisonLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].situationChecksum).toBe(checksum);
    expect(rows[0].divergenceCategory).toBe('INSUFFICIENT_INPUT');
    expect(rows[0].legacySummary).toMatchObject({ priceAnnualTnd: 6200 });

    const json = JSON.stringify(rows[0]).toLowerCase();
    for (const forbidden of ['email', 'phone', 'whatsapp', 'parentname', 'studentfirstname']) {
      expect(json).not.toContain(forbidden);
    }
  });

  test('the aggregate report can be built directly from persisted rows', async () => {
    if (!dbAvailable) return;
    const summary = { subjects: [], priceAnnualTnd: null, depositTnd: null, installmentTnd: null, status: 'x', warningsCount: 0 };
    await logShadowComparison({ situationChecksum: 'a', divergenceCategory: 'IDENTICAL', legacySummary: summary, newSummary: summary, detail: '' });
    await logShadowComparison({ situationChecksum: 'b', divergenceCategory: 'PRICING_DIFFERENCE', legacySummary: summary, newSummary: summary, detail: '' });

    const rows = await prisma.shadowComparisonLog.findMany();
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.divergenceCategory === 'IDENTICAL')).toHaveLength(1);
  });
});

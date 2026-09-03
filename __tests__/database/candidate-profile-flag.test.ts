/**
 * Server-governed feature flag for the ProfilCandidat workflow (Track A,
 * Section A12). Real Postgres — the flag must be readable from
 * BusinessConfig, never hardcoded, and must fail closed (DISABLED) when
 * unset rather than defaulting open.
 */
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { testPrisma, setupTestDatabase, canConnectToTestDb } from '../setup/test-database';
import {
  getCandidateProfileWorkflowStatus,
  CANDIDATE_PROFILE_FLAG_NAMESPACE,
  CANDIDATE_PROFILE_FLAG_KEY,
} from '@/lib/quotes/candidate-profile-flag';

const prisma = testPrisma;

describe('getCandidateProfileWorkflowStatus', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (dbAvailable) await setupTestDatabase();
  });

  afterEach(async () => {
    if (!dbAvailable) return;
    await prisma.businessConfig.deleteMany({ where: { namespace: CANDIDATE_PROFILE_FLAG_NAMESPACE } });
  });

  test('fails closed to DISABLED when no BusinessConfig row exists — never defaults open', async () => {
    if (!dbAvailable) return;
    expect(await getCandidateProfileWorkflowStatus()).toBe('DISABLED');
  });

  test('fails closed to DISABLED when the stored value does not parse as a known status', async () => {
    if (!dbAvailable) return;
    await prisma.businessConfig.create({
      data: { namespace: CANDIDATE_PROFILE_FLAG_NAMESPACE, key: CANDIDATE_PROFILE_FLAG_KEY, value: { status: 'NOT_A_REAL_STATUS' }, schemaVersion: '1', updatedBy: 'test-admin' },
    });
    expect(await getCandidateProfileWorkflowStatus()).toBe('DISABLED');
  });

  test('returns ACTIVE_INTERNAL when explicitly set by an admin override', async () => {
    if (!dbAvailable) return;
    await prisma.businessConfig.create({
      data: { namespace: CANDIDATE_PROFILE_FLAG_NAMESPACE, key: CANDIDATE_PROFILE_FLAG_KEY, value: { status: 'ACTIVE_INTERNAL' }, schemaVersion: '1', updatedBy: 'test-admin' },
    });
    expect(await getCandidateProfileWorkflowStatus()).toBe('ACTIVE_INTERNAL');
  });
});

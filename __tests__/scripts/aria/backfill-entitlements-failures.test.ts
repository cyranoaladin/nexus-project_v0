import { rollbackAriaEntitlementBackfill } from '@/scripts/aria/backfill-entitlements';

const instant = '2026-08-30T12:00:00.000Z';
const sourceId = 'subscription-1';
const validTargetKey = {
  afterFingerprint: 'a'.repeat(64),
  academicMapConsulted: false,
  created: false,
  generation: 1,
  scopeCount: 1,
};
const validBeforeImage = {
  ariaSubjects: '["eds-maths-premiere"]',
  endDate: null,
  entitlement: {
    status: 'ACTIVE',
    startsAt: instant,
    endsAt: null,
    suspendedAt: null,
    revokedAt: null,
    scopes: [{ kind: 'COURSE', courseKey: 'eds-maths-premiere' }],
  },
  startDate: instant,
  status: 'ACTIVE',
  subscriptionId: sourceId,
};

function rollbackPool(targetKey: unknown, beforeImage: unknown) {
  const query = jest.fn(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] };
    if (sql.includes('SELECT status::text FROM aria_data_migration_runs')) {
      return { rowCount: 1, rows: [{ status: 'COMPLETED' }] };
    }
    if (sql.includes('LOCK TABLE student_academic_enrollments')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM aria_data_migration_row_audits')) {
      return {
        rowCount: 1,
        rows: [{
          sourceId,
          sourceFingerprint: 'b'.repeat(64),
          targetId: 'entitlement-1',
          targetKey,
          beforeImage,
        }],
      };
    }
    return { rowCount: 0, rows: [] };
  });
  const client = { query, release: jest.fn() };
  return { pool: { connect: jest.fn().mockResolvedValue(client) }, query, client };
}

async function expectInvalidEvidence(targetKey: unknown, beforeImage: unknown) {
  const { pool, query, client } = rollbackPool(targetKey, beforeImage);
  await expect(rollbackAriaEntitlementBackfill(pool as never, 'run-1'))
    .rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_REPLAY_AUDIT_INVALID');
  expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
  expect(client.release).toHaveBeenCalledTimes(1);
}

describe('ARIA entitlement backfill persisted evidence validation', () => {
  it.each([
    ['NULL', null],
    ['ARRAY', []],
    ['EXTRA_KEY', { ...validTargetKey, extra: true }],
    ['FINGERPRINT_TYPE', { ...validTargetKey, afterFingerprint: 42 }],
    ['FINGERPRINT_FORMAT', { ...validTargetKey, afterFingerprint: 'short' }],
    ['ACADEMIC_MAP', { ...validTargetKey, academicMapConsulted: 'false' }],
    ['CREATED', { ...validTargetKey, created: 'false' }],
    ['GENERATION_FRACTION', { ...validTargetKey, generation: 1.5 }],
    ['GENERATION_ZERO', { ...validTargetKey, generation: 0 }],
    ['GENERATION_OVERFLOW', { ...validTargetKey, generation: 2_147_483_648 }],
    ['SCOPE_COUNT_FRACTION', { ...validTargetKey, scopeCount: 1.5 }],
    ['SCOPE_COUNT_NEGATIVE', { ...validTargetKey, scopeCount: -1 }],
  ])('B3_ROLLBACK_REJECTS_TARGET_KEY_%s', async (_name, targetKey) => {
    await expectInvalidEvidence(targetKey, validBeforeImage);
  });

  it.each([
    ['NULL', null, validTargetKey],
    ['ARRAY', [], validTargetKey],
    ['EXTRA_KEY', { ...validBeforeImage, extra: true }, validTargetKey],
    ['ARIA_SUBJECTS', { ...validBeforeImage, ariaSubjects: 42 }, validTargetKey],
    ['SOURCE_ID', { ...validBeforeImage, subscriptionId: 'other-subscription' }, validTargetKey],
    ['STATUS', { ...validBeforeImage, status: 'PAUSED' }, validTargetKey],
    ['START_DATE', { ...validBeforeImage, startDate: 'invalid' }, validTargetKey],
    ['END_DATE', { ...validBeforeImage, endDate: 'invalid' }, validTargetKey],
    [
      'CREATED_WITH_PRIOR_STATE',
      validBeforeImage,
      { ...validTargetKey, created: true },
    ],
    ['MISSING_PRIOR_STATE', { ...validBeforeImage, entitlement: null }, validTargetKey],
    ['ARRAY_PRIOR_STATE', { ...validBeforeImage, entitlement: [] }, validTargetKey],
    [
      'PRIOR_STATE_EXTRA_KEY',
      { ...validBeforeImage, entitlement: { ...validBeforeImage.entitlement, extra: true } },
      validTargetKey,
    ],
    [
      'PRIOR_STATE_STATUS',
      { ...validBeforeImage, entitlement: { ...validBeforeImage.entitlement, status: 'PAUSED' } },
      validTargetKey,
    ],
    [
      'PRIOR_STATE_SCOPES_TYPE',
      { ...validBeforeImage, entitlement: { ...validBeforeImage.entitlement, scopes: 'bad' } },
      validTargetKey,
    ],
    [
      'SCOPE_NULL',
      { ...validBeforeImage, entitlement: { ...validBeforeImage.entitlement, scopes: [null] } },
      validTargetKey,
    ],
    [
      'SCOPE_EXTRA_KEY',
      {
        ...validBeforeImage,
        entitlement: {
          ...validBeforeImage.entitlement,
          scopes: [{ kind: 'COURSE', courseKey: 'eds-maths-premiere', extra: true }],
        },
      },
      validTargetKey,
    ],
    [
      'SCOPE_INVALID_GLOBAL',
      {
        ...validBeforeImage,
        entitlement: {
          ...validBeforeImage.entitlement,
          scopes: [{ kind: 'GLOBAL', courseKey: 'eds-maths-premiere' }],
        },
      },
      validTargetKey,
    ],
    [
      'SCOPE_INVALID_COURSE',
      {
        ...validBeforeImage,
        entitlement: {
          ...validBeforeImage.entitlement,
          scopes: [{ kind: 'COURSE', courseKey: '' }],
        },
      },
      validTargetKey,
    ],
    [
      'PRIOR_START_DATE',
      {
        ...validBeforeImage,
        entitlement: { ...validBeforeImage.entitlement, startsAt: 'invalid' },
      },
      validTargetKey,
    ],
    [
      'PRIOR_END_DATE',
      {
        ...validBeforeImage,
        entitlement: { ...validBeforeImage.entitlement, endsAt: 'invalid' },
      },
      validTargetKey,
    ],
  ])('B3_ROLLBACK_REJECTS_BEFORE_IMAGE_%s', async (_name, beforeImage, targetKey) => {
    await expectInvalidEvidence(targetKey, beforeImage);
  });
});

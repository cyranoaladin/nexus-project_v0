import {
  backfillAriaEntitlements,
  planAriaEntitlementBackfill,
  rollbackAriaEntitlementBackfill,
} from '@/scripts/aria/backfill-entitlements';
import { stableLegacyFingerprint } from '@/scripts/aria/audit-legacy-data';

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
const archivedSubscription = {
  id: 'subscription-archived', studentId: 'student-1', userId: 'user-1',
  gradeLevel: 'PREMIERE' as const, academicTrack: 'EDS_GENERALE' as const,
  stmgPathway: null, status: 'ACTIVE' as const,
  startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: null,
  ariaSubjects: '',
};
const now = new Date('2026-08-30T12:00:00.000Z');
const archivedPlan = planAriaEntitlementBackfill({
  subscriptions: [archivedSubscription], enrollments: [], existingEntitlements: new Map(),
  priorGenerations: new Map(), now,
});
const deterministicPlan = planAriaEntitlementBackfill({
  subscriptions: [{ ...archivedSubscription, ariaSubjects: 'ALL' }],
  enrollments: [], existingEntitlements: new Map(), priorGenerations: new Map(), now,
});

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

function archivedApplyPool(input: Readonly<{
  auditRowCount?: number;
  prerequisite?: Readonly<{
    status: string;
    sourceDigest: string;
    sourceSnapshot: unknown;
  }> | null;
  terminalRowCount?: number;
  }>) {
  const query = jest.fn(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] };
    if (sql.startsWith('LOCK TABLE')) return { rowCount: 0, rows: [] };
    if (sql.includes('FROM subscriptions sub JOIN students student')) {
      return { rowCount: 1, rows: [archivedSubscription] };
    }
    if (sql.includes('FROM entitlements') && sql.includes('"sourceSubscriptionId"')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM student_academic_enrollments')) return { rowCount: 0, rows: [] };
    if (sql.includes('FROM aria_data_migration_row_audits audit')
      && sql.includes('FOR UPDATE OF audit, migration_run')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('COALESCE(MAX(')) return { rowCount: 0, rows: [] };
    if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'APPLY'")) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'DRY_RUN'")) {
      const prerequisite = input.prerequisite === undefined ? {
        status: 'COMPLETED', sourceDigest: archivedPlan.sourceDigest,
        sourceSnapshot: archivedPlan.sourceSnapshot,
      } : input.prerequisite;
      if (prerequisite === null) return { rowCount: 0, rows: [] };
      return {
        rowCount: 1,
        rows: [prerequisite],
      };
    }
    if (sql.includes('INSERT INTO aria_data_migration_runs')) {
      return { rowCount: 1, rows: [{ id: 'apply-archived' }] };
    }
    if (sql.includes('INSERT INTO aria_data_migration_row_audits')) {
      return { rowCount: input.auditRowCount ?? 1, rows: [] };
    }
    if (sql.includes('UPDATE aria_data_migration_runs')) {
      return { rowCount: input.terminalRowCount ?? 1, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  });
  const client = { query, release: jest.fn() };
  return { pool: { connect: jest.fn().mockResolvedValue(client) }, query, client };
}

const replayTargetState = {
  status: 'ACTIVE',
  startsAt: instant,
  endsAt: null,
  suspendedAt: null,
  revokedAt: null,
  scopes: [{ kind: 'GLOBAL' as const, courseKey: null }],
};

function completedReplayPool(input: Readonly<{
  plan?: typeof archivedPlan;
  prerequisitePlan?: typeof archivedPlan;
  apply?: Readonly<{
    id?: string;
    status?: string;
    prerequisiteRunId?: string | null;
    sourceSnapshot?: unknown;
  }>;
  aggregate?: Readonly<{
    scanned: number;
    deterministic: number;
    archived: number;
    manualReview: number;
    mutated: number;
    invalid: number;
  }>;
  auditedSources?: readonly unknown[];
  current?: typeof replayTargetState | null;
  currentProductCode?: string;
  currentUserId?: string;
}>) {
  const plan = input.plan ?? archivedPlan;
  const prerequisitePlan = input.prerequisitePlan ?? plan;
  const query = jest.fn(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] };
    if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'APPLY'")) {
      return {
        rowCount: 1,
        rows: [{
          id: input.apply?.id ?? 'apply-replay',
          status: input.apply?.status ?? 'COMPLETED',
          prerequisiteRunId: input.apply?.prerequisiteRunId ?? 'audit-replay',
          scannedCount: plan.report.scanned,
          deterministicCount: plan.report.deterministic,
          archivedCount: plan.report.archived,
          manualReviewCount: plan.report.manualReview,
          mutatedCount: plan.report.deterministic,
          sourceSnapshot: input.apply?.sourceSnapshot ?? plan.sourceSnapshot,
        }],
      };
    }
    if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'DRY_RUN'")) {
      return {
        rowCount: 1,
        rows: [{
          status: 'COMPLETED',
          sourceDigest: plan.sourceDigest,
          sourceSnapshot: prerequisitePlan.sourceSnapshot,
        }],
      };
    }
    if (sql.includes('SELECT COUNT(*)::integer AS scanned')) {
      return {
        rowCount: 1,
        rows: [input.aggregate ?? {
          scanned: plan.report.scanned,
          deterministic: plan.report.deterministic,
          archived: plan.report.archived,
          manualReview: plan.report.manualReview,
          mutated: plan.report.deterministic,
          invalid: 0,
        }],
      };
    }
    if (sql.includes('SELECT classification::text, "sourceId"')) {
      return { rowCount: input.auditedSources?.length ?? 0, rows: input.auditedSources ?? [] };
    }
    if (sql.includes('FROM entitlements WHERE id = $1')) {
      if (input.current === null) return { rowCount: 0, rows: [] };
      const current = input.current ?? replayTargetState;
      return {
        rowCount: 1,
        rows: [{
          productCode: input.currentProductCode ?? 'ARIA_ACCESS',
          userId: input.currentUserId ?? archivedSubscription.userId,
          status: current.status,
          startsAt: current.startsAt,
          endsAt: current.endsAt,
          suspendedAt: current.suspendedAt,
          revokedAt: current.revokedAt,
        }],
      };
    }
    if (sql.includes('FROM aria_entitlement_scopes')) {
      return { rowCount: replayTargetState.scopes.length, rows: (input.current ?? replayTargetState).scopes };
    }
    return { rowCount: 0, rows: [] };
  });
  const client = { query, release: jest.fn() };
  return { pool: { connect: jest.fn().mockResolvedValue(client) }, query, client };
}

function deterministicApplyPool(input: Readonly<{
  auditRowCount?: number;
  insertedRunRowCount?: number;
  prerequisitePlan?: typeof deterministicPlan;
  target?: typeof replayTargetState | null;
  targetProductCode?: string;
  targetUserId?: string;
}>) {
  const prerequisitePlan = input.prerequisitePlan ?? deterministicPlan;
  const query = jest.fn(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] };
    if (sql.startsWith('LOCK TABLE')) return { rowCount: 0, rows: [] };
    if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'APPLY'")) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM aria_data_migration_runs') && sql.includes("mode = 'DRY_RUN'")) {
      return {
        rowCount: 1,
        rows: [{
          status: 'COMPLETED',
          sourceDigest: prerequisitePlan.sourceDigest,
          sourceSnapshot: prerequisitePlan.sourceSnapshot,
        }],
      };
    }
    if (sql.includes('FROM subscriptions sub JOIN students student')) {
      return {
        rowCount: 1,
        rows: [{ ...archivedSubscription, ariaSubjects: 'ALL' }],
      };
    }
    if (sql.includes('FROM student_academic_enrollments')) return { rowCount: 0, rows: [] };
    if (sql.includes('FROM entitlements') && sql.includes('"sourceSubscriptionId"')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM aria_data_migration_row_audits audit')
      && sql.includes('FOR UPDATE OF audit, migration_run')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('COALESCE(MAX(')) return { rowCount: 0, rows: [] };
    if (sql.includes('INSERT INTO aria_data_migration_runs')) {
      const rowCount = input.insertedRunRowCount ?? 1;
      return { rowCount, rows: rowCount === 1 ? [{ id: 'apply-deterministic' }] : [] };
    }
    if (sql.includes('INSERT INTO entitlements')) {
      return { rowCount: 1, rows: [{ id: 'entitlement-deterministic' }] };
    }
    if (sql.includes('FROM entitlements WHERE id = $1')) {
      if (input.target === null) return { rowCount: 0, rows: [] };
      const target = input.target ?? replayTargetState;
      return {
        rowCount: 1,
        rows: [{
          productCode: input.targetProductCode ?? 'ARIA_ACCESS',
          userId: input.targetUserId ?? archivedSubscription.userId,
          status: target.status,
          startsAt: target.startsAt,
          endsAt: target.endsAt,
          suspendedAt: target.suspendedAt,
          revokedAt: target.revokedAt,
        }],
      };
    }
    if (sql.includes('FROM aria_entitlement_scopes')) {
      return { rowCount: 1, rows: (input.target ?? replayTargetState).scopes };
    }
    if (sql.includes('INSERT INTO aria_data_migration_row_audits')) {
      return { rowCount: input.auditRowCount ?? 1, rows: [] };
    }
    if (sql.includes('UPDATE aria_data_migration_runs')) return { rowCount: 1, rows: [] };
    return { rowCount: 0, rows: [] };
  });
  const client = { query, release: jest.fn() };
  return { pool: { connect: jest.fn().mockResolvedValue(client) }, query, client };
}

function emptyDryRunPool() {
  const query = jest.fn(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] };
    if (sql.includes('FROM subscriptions sub JOIN students student')) return { rowCount: 0, rows: [] };
    if (sql.includes('FROM student_academic_enrollments')) return { rowCount: 0, rows: [] };
    return { rowCount: 0, rows: [] };
  });
  const client = { query, release: jest.fn() };
  return { pool: { connect: jest.fn().mockResolvedValue(client) }, query, client };
}

const rollbackSourceFingerprint = stableLegacyFingerprint({
  subscription: {
    ...archivedSubscription,
    ariaSubjects: 'ALL',
    startDate: archivedSubscription.startDate.toISOString(),
    endDate: null,
  },
  enrollments: [],
  academicMapConsulted: false,
});

function validRollbackPool(input: Readonly<{
  created?: boolean;
  deleteRowCount?: number;
  restoreRowCount?: number;
  terminalRowCount?: number;
  withAudit?: boolean;
}>) {
  const created = input.created ?? true;
  const targetKey = {
    afterFingerprint: stableLegacyFingerprint(replayTargetState),
    academicMapConsulted: false,
    created,
    generation: 1,
    scopeCount: 1,
  };
  const beforeImage = {
    ...validBeforeImage,
    ariaSubjects: 'ALL',
    subscriptionId: archivedSubscription.id,
    entitlement: created ? null : validBeforeImage.entitlement,
  };
  const query = jest.fn(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] };
    if (sql.includes('SELECT status::text FROM aria_data_migration_runs')) {
      return { rowCount: 1, rows: [{ status: 'COMPLETED' }] };
    }
    if (sql.includes('LOCK TABLE student_academic_enrollments')) return { rowCount: 0, rows: [] };
    if (sql.includes('FROM aria_data_migration_row_audits')
      && sql.includes('ORDER BY "sourceId" FOR UPDATE')) {
      if (input.withAudit === false) return { rowCount: 0, rows: [] };
      return {
        rowCount: 1,
        rows: [{
          sourceId: archivedSubscription.id,
          sourceFingerprint: rollbackSourceFingerprint,
          targetId: 'entitlement-deterministic',
          targetKey,
          beforeImage,
        }],
      };
    }
    if (sql.includes('FROM aria_data_migration_row_audits later_audit')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM subscriptions sub JOIN students student')) {
      return {
        rowCount: 1,
        rows: [{ ...archivedSubscription, ariaSubjects: 'ALL' }],
      };
    }
    if (sql.includes('SELECT "productCode"') && sql.includes('FROM entitlements WHERE id = $1')) {
      return {
        rowCount: 1,
        rows: [{
          productCode: 'ARIA_ACCESS',
          userId: archivedSubscription.userId,
          status: replayTargetState.status,
          startsAt: replayTargetState.startsAt,
          endsAt: replayTargetState.endsAt,
          suspendedAt: replayTargetState.suspendedAt,
          revokedAt: replayTargetState.revokedAt,
        }],
      };
    }
    if (sql.includes('FROM aria_entitlement_scopes')) {
      return { rowCount: 1, rows: replayTargetState.scopes };
    }
    if (sql.includes('DELETE FROM entitlements WHERE id')) {
      return { rowCount: input.deleteRowCount ?? 1, rows: [] };
    }
    if (sql.startsWith('UPDATE entitlements SET status')) {
      return { rowCount: input.restoreRowCount ?? 1, rows: [] };
    }
    if (sql.includes("SET status = 'ROLLED_BACK'")) {
      return { rowCount: input.terminalRowCount ?? 1, rows: [] };
    }
    return { rowCount: 1, rows: [] };
  });
  const client = { query, release: jest.fn() };
  return { pool: { connect: jest.fn().mockResolvedValue(client) }, query, client };
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

  it.each([
    ['AUDIT_INSERT_CONFLICT', { auditRowCount: 0 }, 'ARIA_ENTITLEMENT_BACKFILL_AUDIT_INSERT_CONFLICT'],
    ['TERMINAL_TRANSITION_LOSS', { terminalRowCount: 0 }, 'ARIA_ENTITLEMENT_BACKFILL_TERMINAL_CONFLICT'],
  ] as const)('B3_APPLY_REJECTS_%s', async (_name, failure, expectedError) => {
    const { pool, query, client } = archivedApplyPool(failure);

    await expect(backfillAriaEntitlements(pool as never, {
      runId: 'apply-archived', mode: 'APPLY', sourceDigest: archivedPlan.sourceDigest,
      prerequisiteRunId: 'audit-archived', now,
    })).rejects.toThrow(expectedError);
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('B3_APPLY_REJECTS_MISSING_PREREQUISITE_RUN_ID', async () => {
    const { pool, query, client } = archivedApplyPool({});

    await expect(backfillAriaEntitlements(pool as never, {
      runId: 'apply-archived', mode: 'APPLY', sourceDigest: archivedPlan.sourceDigest,
      prerequisiteRunId: undefined as never, now,
    })).rejects.toThrow('ARIA_ENTITLEMENT_SOURCE_SNAPSHOT_MISMATCH');
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['MISSING', null],
    ['RUNNING', {
      status: 'RUNNING', sourceDigest: archivedPlan.sourceDigest,
      sourceSnapshot: archivedPlan.sourceSnapshot,
    }],
    ['DIGEST_DRIFT', {
      status: 'COMPLETED', sourceDigest: 'c'.repeat(64),
      sourceSnapshot: archivedPlan.sourceSnapshot,
    }],
    ['INVALID_SEAL', {
      status: 'COMPLETED', sourceDigest: archivedPlan.sourceDigest,
      sourceSnapshot: {
        ...archivedPlan.sourceSnapshot,
        sourceSnapshotSha256: 'c'.repeat(64),
      },
    }],
  ] as const)('B3_APPLY_REJECTS_%s_PREREQUISITE', async (_name, prerequisite) => {
    const { pool, query, client } = archivedApplyPool({ prerequisite });

    await expect(backfillAriaEntitlements(pool as never, {
      runId: 'apply-archived', mode: 'APPLY', sourceDigest: archivedPlan.sourceDigest,
      prerequisiteRunId: 'audit-archived', now,
    })).rejects.toThrow('ARIA_ENTITLEMENT_SOURCE_SNAPSHOT_MISMATCH');
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['RUN_ID', { id: 'other-run' }],
    ['STATUS', { status: 'RUNNING' }],
    ['PREREQUISITE', { prerequisiteRunId: 'other-audit' }],
  ] as const)('B3_COMPLETED_REPLAY_REJECTS_%s_DRIFT', async (_name, apply) => {
    const { pool, query, client } = completedReplayPool({ apply });

    await expect(backfillAriaEntitlements(pool as never, {
      runId: 'apply-replay', mode: 'APPLY', sourceDigest: archivedPlan.sourceDigest,
      prerequisiteRunId: 'audit-replay', now,
    })).rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_RUN_NOT_REPLAYABLE');
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('B3_COMPLETED_REPLAY_REJECTS_SOURCE_SNAPSHOT_DRIFT', async () => {
    const { pool } = completedReplayPool({
      plan: deterministicPlan,
      apply: { sourceSnapshot: archivedPlan.sourceSnapshot },
    });

    await expect(backfillAriaEntitlements(pool as never, {
      runId: 'apply-replay', mode: 'APPLY', sourceDigest: deterministicPlan.sourceDigest,
      prerequisiteRunId: 'audit-replay', now,
    })).rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_REPLAY_AUDIT_INVALID');
  });

  it('B3_COMPLETED_REPLAY_REJECTS_ARCHIVED_PRIOR_ENTITLEMENT', async () => {
    const { pool } = completedReplayPool({
      auditedSources: [{
        classification: 'ARCHIVED_NON_RESUMABLE',
        sourceId: archivedSubscription.id,
        targetId: null,
        targetKey: null,
        beforeImage: {
          ...validBeforeImage,
          subscriptionId: archivedSubscription.id,
        },
      }],
    });

    await expect(backfillAriaEntitlements(pool as never, {
      runId: 'apply-replay', mode: 'APPLY', sourceDigest: archivedPlan.sourceDigest,
      prerequisiteRunId: 'audit-replay', now,
    })).rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_REPLAY_AUDIT_INVALID');
  });

  it('B3_COMPLETED_REPLAY_REJECTS_DETERMINISTIC_TARGET_WITHOUT_ID', async () => {
    const { pool } = completedReplayPool({
      plan: deterministicPlan,
      auditedSources: [{
        classification: 'DETERMINISTIC_BACKFILL',
        sourceId: archivedSubscription.id,
        targetId: null,
        targetKey: null,
        beforeImage: null,
      }],
    });

    await expect(backfillAriaEntitlements(pool as never, {
      runId: 'apply-replay', mode: 'APPLY', sourceDigest: deterministicPlan.sourceDigest,
      prerequisiteRunId: 'audit-replay', now,
    })).rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_REPLAY_AUDIT_INVALID');
  });

  it.each([
    ['MISSING_TARGET', null, 'a'.repeat(64), 1],
    ['FINGERPRINT_DRIFT', replayTargetState, 'a'.repeat(64), 1],
    ['SCOPE_COUNT_DRIFT', replayTargetState, stableLegacyFingerprint(replayTargetState), 2],
  ] as const)(
    'B3_COMPLETED_REPLAY_REJECTS_%s',
    async (_name, current, afterFingerprint, scopeCount) => {
      const { pool } = completedReplayPool({
        plan: deterministicPlan,
        current,
        auditedSources: [{
          classification: 'DETERMINISTIC_BACKFILL',
          sourceId: archivedSubscription.id,
          targetId: 'entitlement-replay',
          targetKey: {
            afterFingerprint,
            academicMapConsulted: false,
            created: true,
            generation: 1,
            scopeCount,
          },
          beforeImage: {
            ...validBeforeImage,
            ariaSubjects: 'ALL',
            subscriptionId: archivedSubscription.id,
            entitlement: null,
          },
        }],
      });

      await expect(backfillAriaEntitlements(pool as never, {
        runId: 'apply-replay', mode: 'APPLY', sourceDigest: deterministicPlan.sourceDigest,
        prerequisiteRunId: 'audit-replay', now,
      })).rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_REPLAY_AUDIT_INVALID');
    },
  );

  it('B3_DRY_RUN_EMPTY_SOURCE_RETURNS_ZERO_REPORT', async () => {
    const { pool, query, client } = emptyDryRunPool();

    await expect(backfillAriaEntitlements(pool as never, {
      runId: 'dry-run-empty', mode: 'DRY_RUN', sourceDigest: 'unused', now,
    })).resolves.toMatchObject({
      scanned: 0,
      deterministic: 0,
      archived: 0,
      manualReview: 0,
      mutated: 0,
    });
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['MISSING_TARGET', { target: null }, 'ARIA_ENTITLEMENT_BACKFILL_TARGET_MISSING'],
    ['TARGET_PRODUCT', { targetProductCode: 'OTHER_PRODUCT' }, 'ARIA_ENTITLEMENT_BACKFILL_TARGET_OWNERSHIP_CONFLICT'],
    ['TARGET_OWNER', { targetUserId: 'other-user' }, 'ARIA_ENTITLEMENT_BACKFILL_TARGET_OWNERSHIP_CONFLICT'],
    ['AUDIT_FENCE', { auditRowCount: 0 }, 'ARIA_ENTITLEMENT_BACKFILL_AUDIT_INSERT_CONFLICT'],
  ] as const)(
    'B3_APPLY_REJECTS_DETERMINISTIC_%s',
    async (_name, failure, expectedError) => {
      const { pool, query, client } = deterministicApplyPool(failure);

      await expect(backfillAriaEntitlements(pool as never, {
        runId: 'apply-deterministic', mode: 'APPLY', sourceDigest: deterministicPlan.sourceDigest,
        prerequisiteRunId: 'audit-deterministic', now,
      })).rejects.toThrow(expectedError);
      expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    },
  );

  it('B3_APPLY_INSERT_CONFLICT_REQUIRES_REPLAYABLE_RUN', async () => {
    const { pool, query, client } = deterministicApplyPool({ insertedRunRowCount: 0 });

    await expect(backfillAriaEntitlements(pool as never, {
      runId: 'apply-deterministic', mode: 'APPLY', sourceDigest: deterministicPlan.sourceDigest,
      prerequisiteRunId: 'audit-deterministic', now,
    })).rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_RUN_NOT_REPLAYABLE');
    expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('B3_APPLY_REJECTS_SOURCE_PLAN_DRIFT_AFTER_LOCK', async () => {
    const { pool } = deterministicApplyPool({ prerequisitePlan: archivedPlan as typeof deterministicPlan });

    await expect(backfillAriaEntitlements(pool as never, {
      runId: 'apply-deterministic', mode: 'APPLY', sourceDigest: archivedPlan.sourceDigest,
      prerequisiteRunId: 'audit-archived', now,
    })).rejects.toThrow('ARIA_ENTITLEMENT_SOURCE_SNAPSHOT_MISMATCH');
  });

  it.each([
    ['DELETE_FENCE', { created: true, deleteRowCount: 0 }, 'ARIA_ENTITLEMENT_ROLLBACK_TARGET_CONFLICT'],
    ['RESTORE_FENCE', { created: false, restoreRowCount: 0 }, 'ARIA_ENTITLEMENT_ROLLBACK_TARGET_CONFLICT'],
    ['TERMINAL_FENCE', { withAudit: false, terminalRowCount: 0 }, 'ARIA_ENTITLEMENT_ROLLBACK_RUN_NOT_COMPLETED'],
  ] as const)(
    'B3_ROLLBACK_REJECTS_%s_LOSS',
    async (_name, failure, expectedError) => {
      const { pool, query, client } = validRollbackPool(failure);

      await expect(rollbackAriaEntitlementBackfill(pool as never, 'apply-deterministic'))
        .rejects.toThrow(expectedError);
      expect(query.mock.calls.map(([sql]) => sql).at(-1)).toBe('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    },
  );
});

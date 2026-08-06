import {
  ACCOUNT_ACTIVATION_TTL_MS,
  PENDING_PARENT_CLASSIFICATIONS,
  PENDING_PARENT_ELIGIBILITY_MS,
  PENDING_PARENT_POLICY_VERSION,
  classifyPendingParentGraph,
  isActivationExpired,
  isPurgeAgeReached,
  sanitizePendingLifecycleAudit,
} from '@/lib/auth/pending-account-policy'

const now = new Date('2026-08-04T12:00:00.000Z')

function graph(overrides: Record<string, unknown> = {}) {
  return {
    isPendingParent: true,
    referenceTime: new Date(now.getTime() - PENDING_PARENT_ELIGIBILITY_MS),
    activationTokenPresent: false,
    activationExpiry: null,
    parentProfileCount: 1,
    studentCount: 1,
    studentUserCount: 1,
    pendingStudentUserCount: 1,
    canonicalPendingLinkCount: 1,
    conflictingLinkCount: 0,
    businessRelationCount: 0,
    contactDataCount: 0,
    ...overrides,
  }
}

describe('pending Parent lifecycle policy', () => {
  test('centralizes the approved durations and closed classification set', () => {
    expect(PENDING_PARENT_POLICY_VERSION).toBe('2026-08-04.v3')
    expect(ACCOUNT_ACTIVATION_TTL_MS).toBe(72 * 60 * 60 * 1000)
    expect(PENDING_PARENT_ELIGIBILITY_MS).toBe(90 * 24 * 60 * 60 * 1000)
    expect(PENDING_PARENT_CLASSIFICATIONS).toEqual([
      'RECONCILIATION_REQUIRED', 'TOKEN_INVALIDATION_ELIGIBLE', 'PURGE_ELIGIBLE',
      'HUMAN_REVIEW_REQUIRED', 'NOT_ELIGIBLE', 'INCONSISTENT_GRAPH',
    ])
  })

  test('uses exact UTC boundaries for 72 hours and 90 days', () => {
    expect(isActivationExpired(new Date(now.getTime() + 1), now)).toBe(false)
    expect(isActivationExpired(now, now)).toBe(true)
    expect(isActivationExpired(new Date(now.getTime() - 1), now)).toBe(true)
    expect(isPurgeAgeReached(new Date(now.getTime() - PENDING_PARENT_ELIGIBILITY_MS + 1), now)).toBe(false)
    expect(isPurgeAgeReached(new Date(now.getTime() - PENDING_PARENT_ELIGIBILITY_MS), now)).toBe(true)
    expect(isPurgeAgeReached(new Date(now.getTime() - PENDING_PARENT_ELIGIBILITY_MS - 1), now)).toBe(true)
  })

  test.each([
    [graph({ canonicalPendingLinkCount: 0 }), 'RECONCILIATION_REQUIRED'],
    [graph({ activationTokenPresent: true, activationExpiry: now }), 'TOKEN_INVALIDATION_ELIGIBLE'],
    [graph(), 'PURGE_ELIGIBLE'],
    [graph({ businessRelationCount: 1 }), 'HUMAN_REVIEW_REQUIRED'],
    [graph({ referenceTime: new Date(now.getTime() - PENDING_PARENT_ELIGIBILITY_MS + 1) }), 'NOT_ELIGIBLE'],
    [graph({ parentProfileCount: 0 }), 'INCONSISTENT_GRAPH'],
  ])('classifies the closed matrix %#', (facts, expected) => {
    expect(classifyPendingParentGraph(facts, now)).toBe(expected)
  })

  test('recent reissue, activation and activity prevent purge', () => {
    expect(classifyPendingParentGraph(graph({
      activationTokenPresent: true,
      activationExpiry: new Date(now.getTime() + ACCOUNT_ACTIVATION_TTL_MS - 1),
    }), now)).toBe('NOT_ELIGIBLE')
    expect(classifyPendingParentGraph(graph({ isPendingParent: false }), now)).toBe('NOT_ELIGIBLE')
    expect(classifyPendingParentGraph(graph({ referenceTime: new Date(now.getTime() - 1) }), now)).toBe('NOT_ELIGIBLE')
  })

  test('fails closed for token mismatch, ambiguous links, data and malformed time', () => {
    expect(classifyPendingParentGraph(graph({ activationTokenPresent: true }), now)).toBe('INCONSISTENT_GRAPH')
    expect(classifyPendingParentGraph(graph({ conflictingLinkCount: 1 }), now)).toBe('HUMAN_REVIEW_REQUIRED')
    expect(classifyPendingParentGraph(graph({ contactDataCount: 1 }), now)).toBe('HUMAN_REVIEW_REQUIRED')
    expect(
      classifyPendingParentGraph(graph({ canonicalPendingLinkCount: 0, contactDataCount: 1 }), now),
    ).toBe('RECONCILIATION_REQUIRED')
    expect(classifyPendingParentGraph(graph({ referenceTime: new Date(now.getTime() + 1) }), now)).toBe('INCONSISTENT_GRAPH')
    expect(classifyPendingParentGraph(graph({ pendingStudentUserCount: 0 }), now)).toBe('INCONSISTENT_GRAPH')
  })

  test('emits aggregate-only audit data without PII, ids or activation material', () => {
    const decisions = Object.fromEntries(PENDING_PARENT_CLASSIFICATIONS.map((value) => [value, 1])) as never
    const audit = sanitizePendingLifecycleAudit({
      policyVersion: PENDING_PARENT_POLICY_VERSION,
      dryRun: true,
      examined: 6,
      decisions,
      userId: 'user-secret',
      email: 'parent@example.test',
      activationToken: 'pact_raw-secret',
    })
    expect(JSON.stringify(audit)).not.toMatch(/user-secret|parent@example|pact_/)
    expect(audit.examined).toBe(6)
  })
})

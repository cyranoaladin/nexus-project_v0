export const PENDING_PARENT_POLICY_VERSION = '2026-08-04.v3'
export const ACCOUNT_ACTIVATION_TTL_MS = 72 * 60 * 60 * 1000
export const PENDING_PARENT_ELIGIBILITY_MS = 90 * 24 * 60 * 60 * 1000
export const PENDING_PARENT_PLAN_TTL_MS = 15 * 60 * 1000
export const PENDING_PARENT_MAX_BATCH_SIZE = 100

export const PENDING_PARENT_CLASSIFICATIONS = [
  'RECONCILIATION_REQUIRED',
  'TOKEN_INVALIDATION_ELIGIBLE',
  'PURGE_ELIGIBLE',
  'HUMAN_REVIEW_REQUIRED',
  'NOT_ELIGIBLE',
  'INCONSISTENT_GRAPH',
] as const

export type PendingParentClassification = typeof PENDING_PARENT_CLASSIFICATIONS[number]

export type PendingParentGraphFacts = Readonly<{
  isPendingParent: boolean
  referenceTime: Date
  activationTokenPresent: boolean
  activationExpiry: Date | null
  parentProfileCount: number
  studentCount: number
  studentUserCount: number
  pendingStudentUserCount: number
  canonicalPendingLinkCount: number
  conflictingLinkCount: number
  businessRelationCount: number
  contactDataCount: number
}>

export type PendingLifecycleDecisionCounts = Record<PendingParentClassification, number>

export function emptyPendingLifecycleDecisionCounts(): PendingLifecycleDecisionCounts {
  return {
    RECONCILIATION_REQUIRED: 0,
    TOKEN_INVALIDATION_ELIGIBLE: 0,
    PURGE_ELIGIBLE: 0,
    HUMAN_REVIEW_REQUIRED: 0,
    NOT_ELIGIBLE: 0,
    INCONSISTENT_GRAPH: 0,
  }
}

export function isActivationExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime()
}

export function isPurgeAgeReached(referenceTime: Date, now: Date): boolean {
  const ageMs = now.getTime() - referenceTime.getTime()
  return Number.isFinite(ageMs) && ageMs >= PENDING_PARENT_ELIGIBILITY_MS
}

function structurallyCoherent(facts: PendingParentGraphFacts): boolean {
  return (
    facts.parentProfileCount === 1
    && facts.studentCount === 1
    && facts.studentUserCount === facts.studentCount
    && facts.pendingStudentUserCount === facts.studentCount
    && (facts.canonicalPendingLinkCount === 0 || facts.canonicalPendingLinkCount === facts.studentCount)
  )
}

export function classifyPendingParentGraph(
  facts: PendingParentGraphFacts,
  now: Date,
): PendingParentClassification {
  if (!facts.isPendingParent) return 'NOT_ELIGIBLE'
  if (!structurallyCoherent(facts)) return 'INCONSISTENT_GRAPH'
  if (facts.activationTokenPresent !== (facts.activationExpiry instanceof Date)) {
    return 'INCONSISTENT_GRAPH'
  }
  if (!Number.isFinite(facts.referenceTime.getTime()) || facts.referenceTime.getTime() > now.getTime()) {
    return 'INCONSISTENT_GRAPH'
  }
  if (facts.conflictingLinkCount > 0) return 'HUMAN_REVIEW_REQUIRED'
  if (facts.canonicalPendingLinkCount === 0) return 'RECONCILIATION_REQUIRED'
  if (facts.businessRelationCount > 0 || facts.contactDataCount > 0) {
    return 'HUMAN_REVIEW_REQUIRED'
  }
  if (facts.activationExpiry && !isActivationExpired(facts.activationExpiry, now)) {
    return 'NOT_ELIGIBLE'
  }
  if (facts.activationTokenPresent) return 'TOKEN_INVALIDATION_ELIGIBLE'
  if (!isPurgeAgeReached(facts.referenceTime, now)) return 'NOT_ELIGIBLE'
  return 'PURGE_ELIGIBLE'
}

type UnsafeAuditInput = Readonly<{
  policyVersion: string
  dryRun: boolean
  examined: number
  decisions: PendingLifecycleDecisionCounts
}> & Readonly<Record<string, unknown>>

export function sanitizePendingLifecycleAudit(input: UnsafeAuditInput) {
  return Object.freeze({
    policyVersion: input.policyVersion,
    dryRun: input.dryRun,
    examined: input.examined,
    decisions: Object.freeze({ ...input.decisions }),
  })
}

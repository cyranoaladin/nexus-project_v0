import { readFileSync } from 'node:fs'

const policy = readFileSync('lib/auth/pending-account-policy.ts', 'utf8')
const token = readFileSync('lib/auth/activation-token.ts', 'utf8')
const lifecycle = readFileSync('lib/auth/pending-account-lifecycle.ts', 'utf8')
const consent = readFileSync('lib/bilans/parent-student-consent.ts', 'utf8')
const command = readFileSync('scripts/auth/process-pending-parent-accounts.ts', 'utf8')

describe('pending Parent lifecycle architecture boundary', () => {
  test('keeps activation, retention and plan durations in the canonical policy only', () => {
    expect(policy).toContain('ACCOUNT_ACTIVATION_TTL_MS')
    expect(policy).toContain('PENDING_PARENT_ELIGIBILITY_MS')
    expect(policy).toContain('PENDING_PARENT_PLAN_TTL_MS')
    expect(token).toContain('ACCOUNT_ACTIVATION_TTL_MS')
    expect(token).not.toMatch(/72\s*\*\s*60\s*\*\s*60/)
    expect(lifecycle).not.toMatch(/(?:72|90)\s*\*\s*(?:24|60)/)
    expect(command).not.toMatch(/(?:72|90)\s*\*\s*(?:24|60)/)
  })

  test('requires an expiring HMAC-bound plan and never supports force-only writes', () => {
    expect(command).toContain("const DEFAULT_MODE = 'dry-run'")
    expect(command).toContain('--plan-file')
    expect(command).not.toContain('--force')
    expect(lifecycle).toContain("createHmac('sha256'")
    expect(lifecycle).toContain('PENDING_PLAN_STALE')
    expect(lifecycle).toContain('PENDING_PLAN_ENVIRONMENT_MISMATCH')
    expect(lifecycle).toContain('pg_advisory_xact_lock')
    expect(lifecycle).toContain('FOR UPDATE SKIP LOCKED')
    expect(command).not.toMatch(/console\.(?:log|error)\([^\n]*(?:email|token|userId|studentId)/)
  })

  test('uses one canonical consent primitive inside the lifecycle transaction', () => {
    expect(consent).toContain('createParentStudentConsentContext')
    expect(lifecycle).toContain('createParentStudentConsentContext(transaction)')
    expect(lifecycle).not.toContain('parentStudentLink.create(')
  })

  test('limits dynamic identifiers to introspected public identifiers and fails closed', () => {
    expect(lifecycle).toContain("source_namespace.nspname = 'public'")
    expect(lifecycle).toContain("target_namespace.nspname = 'public'")
    expect(lifecycle).toContain('SAFE_IDENTIFIER')
    expect(lifecycle).toContain('PENDING_FK_INTROSPECTION_UNSUPPORTED_COMPOSITE')
  })
})

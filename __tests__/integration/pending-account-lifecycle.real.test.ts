import { PrismaClient } from '@prisma/client'

import {
  inspectPendingForeignKeyReferences,
  inventoryPendingParentAccounts,
  processPendingParentPlan,
  type PendingLifecycleAction,
} from '@/lib/auth/pending-account-lifecycle'

const databaseUrl = process.env.TEST_DATABASE_URL ?? ''
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const prefix = 's2-pending-'
const planSecret = 's2-test-plan-secret-32-bytes-minimum-value'
const environmentId = 's2-integration'

function assertIsolatedDatabase() {
  expect(databaseUrl).toMatch(/(?:localhost|127\.0\.0\.1)/)
  expect(databaseUrl).toContain('nexus_s2_pending_test')
  expect(databaseUrl).not.toMatch(/prod|production/i)
}

async function createGraph(input: {
  suffix: string
  ageDays: number
  withLink?: boolean
  withAttempt?: boolean
  token?: 'valid' | 'expired' | 'none'
}) {
  const now = new Date()
  const createdAt = new Date(now.getTime() - input.ageDays * 24 * 60 * 60 * 1000)
  const token = input.token ?? 'none'
  const parent = await prisma.user.create({
    data: {
      email: `${prefix}${input.suffix}@example.test`,
      role: 'PARENT',
      password: null,
      activatedAt: null,
      activationToken: token === 'none' ? null : `hash-${input.suffix}`,
      activationExpiry: token === 'none' ? null : new Date(now.getTime() + (token === 'valid' ? 60_000 : -60_000)),
      createdAt,
      updatedAt: createdAt,
      parentProfile: {
        create: {
          children: {
            create: {
              gradeLevel: 'SECONDE',
              createdAt,
              updatedAt: createdAt,
              user: {
                create: {
                  email: `${prefix}student-${input.suffix}@nexus-student.local`,
                  role: 'ELEVE', password: null, activatedAt: null, createdAt, updatedAt: createdAt,
                },
              },
            },
          },
        },
      },
    },
    include: { parentProfile: { include: { children: { include: { user: true } } } } },
  })
  const student = parent.parentProfile!.children[0]!
  if (input.withLink) {
    await prisma.parentStudentLink.create({
      data: { parentUserId: parent.id, studentId: student.id, state: 'PENDING_PARENT_CONSENT', requestedAt: createdAt, createdAt, updatedAt: createdAt },
    })
  }
  if (input.withAttempt) {
    await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId: student.id, seed: 's2-seed', expiresAt: new Date(now.getTime() + 60_000),
        subject: 'MATHEMATIQUES', gradeLevel: 'SECONDE', answers: {}, curriculumId: 's2',
        curriculumVersion: '1', assessmentPackId: 's2-pack', assessmentPackVersion: '1',
        assessmentPackChecksum: 's2-checksum', scoringPolicyId: 's2-score', scoringPolicyVersion: '1',
      },
    })
  }
  return { parent, student }
}

async function cleanup() {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "s2_fail_parent_profile_delete" ON "parent_profiles"')
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "s2_fail_delete"()')
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "s2_unknown_reference" CASCADE')
  await prisma.jobOutbox.deleteMany({ where: { idempotencyKey: { startsWith: 's2-' } } })
  const users = await prisma.user.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const ids = users.map(({ id }) => id)
  if (ids.length === 0) return
  await prisma.$transaction(async (tx) => {
    const students = await tx.student.findMany({ where: { user: { email: { startsWith: prefix } } }, select: { id: true } })
    const studentIds = students.map(({ id }) => id)
    await tx.canonicalAssessmentAttempt.deleteMany({ where: { studentId: { in: studentIds } } })
    await tx.parentStudentLink.deleteMany({ where: { OR: [{ parentUserId: { in: ids } }, { studentId: { in: studentIds } }] } })
    await tx.student.deleteMany({ where: { id: { in: studentIds } } })
    await tx.parentProfile.deleteMany({ where: { userId: { in: ids } } })
    await tx.user.deleteMany({ where: { id: { in: ids } } })
  })
}

const context = (now = new Date()) => ({ now, batchSize: 100, planSecret, environmentId })

async function plan(action: PendingLifecycleAction, now = new Date()) {
  const audit = await inventoryPendingParentAccounts(prisma, context(now))
  return audit.plans.find((candidate) => candidate.action === action)
}

describe('pending Parent lifecycle on real PostgreSQL', () => {
  beforeAll(async () => { assertIsolatedDatabase(); await cleanup() })
  afterEach(cleanup)
  afterAll(async () => prisma.$disconnect())

  test('dry-run produces opaque deterministic plans without writing or PII', async () => {
    await createGraph({ suffix: 'reconcile', ageDays: 2 })
    await createGraph({ suffix: 'token', ageDays: 2, withLink: true, token: 'expired' })
    await createGraph({ suffix: 'purge', ageDays: 91, withLink: true })
    const before = await prisma.user.count({ where: { email: { startsWith: prefix } } })
    const now = new Date()
    const first = await inventoryPendingParentAccounts(prisma, context(now))
    const second = await inventoryPendingParentAccounts(prisma, context(now))
    expect(first.plans).toEqual(second.plans)
    expect(first.decisions.RECONCILIATION_REQUIRED).toBe(1)
    expect(first.decisions.TOKEN_INVALIDATION_ELIGIBLE).toBe(1)
    expect(first.decisions.PURGE_ELIGIBLE).toBe(1)
    expect(await prisma.user.count({ where: { email: { startsWith: prefix } } })).toBe(before)
    expect(JSON.stringify(first)).not.toMatch(/@example|s2-pending-|hash-token/)
  })

  test('reconciles only demonstrated unambiguous ownership and replay is refused', async () => {
    const { parent, student } = await createGraph({ suffix: 'reconcile', ageDays: 3 })
    const now = new Date()
    const reconciliation = await plan('RECONCILE_LINK', now)
    expect(reconciliation).toBeDefined()
    const first = await processPendingParentPlan(prisma, { ...context(now), plan: reconciliation! })
    expect(first.reconciledLinks).toBe(1)
    expect(await prisma.parentStudentLink.findMany({ where: { parentUserId: parent.id, studentId: student.id } })).toEqual([
      expect.objectContaining({ state: 'PENDING_PARENT_CONSENT', consentedAt: null, verifiedAt: null }),
    ])
    await expect(processPendingParentPlan(prisma, { ...context(now), plan: reconciliation! })).rejects.toThrow(/PENDING_PLAN_(?:STALE|GRAPH_NOT_FOUND)/)
  })

  test('invalidates an expired hash, keeps reissue possible and refuses stale plans', async () => {
    const { parent } = await createGraph({ suffix: 'expired', ageDays: 3, withLink: true, token: 'expired' })
    const now = new Date()
    const invalidation = await plan('INVALIDATE_EXPIRED_TOKEN', now)
    expect(invalidation).toBeDefined()
    await prisma.user.update({ where: { id: parent.id }, data: { firstName: 'changed' } })
    await expect(processPendingParentPlan(prisma, { ...context(now), plan: invalidation! })).rejects.toThrow('PENDING_PLAN_STALE')
    const refreshedNow = new Date()
    const fresh = await plan('INVALIDATE_EXPIRED_TOKEN', refreshedNow)
    expect(fresh).toBeDefined()
    await processPendingParentPlan(prisma, { ...context(refreshedNow), plan: fresh! })
    const current = await prisma.user.findUniqueOrThrow({ where: { id: parent.id } })
    expect(current.activationToken).toBeNull()
    expect(current.activationExpiry).toBeNull()
    expect(current.activatedAt).toBeNull()
  })

  test('purges one old empty graph atomically and preserves protected data', async () => {
    const empty = await createGraph({ suffix: 'purge', ageDays: 91, withLink: true })
    const protectedGraph = await createGraph({ suffix: 'protected', ageDays: 91, withLink: true, withAttempt: true })
    const now = new Date()
    const purge = await plan('PURGE_GRAPH', now)
    expect(purge).toBeDefined()
    const audit = await processPendingParentPlan(prisma, { ...context(now), plan: purge! })
    expect(audit.purgedGraphs).toBe(1)
    expect(await prisma.user.findUnique({ where: { id: empty.parent.id } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: empty.student.userId } })).toBeNull()
    expect(await prisma.student.findUnique({ where: { id: empty.student.id } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: protectedGraph.parent.id } })).not.toBeNull()
    expect(await prisma.canonicalAssessmentAttempt.count({ where: { studentId: protectedGraph.student.id } })).toBe(1)
  })

  test('binds plans to time, policy, content and environment', async () => {
    await createGraph({ suffix: 'bound', ageDays: 91, withLink: true })
    const issued = new Date()
    const purge = (await plan('PURGE_GRAPH', issued))!
    await expect(processPendingParentPlan(prisma, { ...context(issued), environmentId: 'other-environment', plan: purge })).rejects.toThrow('PENDING_PLAN_ENVIRONMENT_MISMATCH')
    await expect(processPendingParentPlan(prisma, { ...context(new Date(issued.getTime() + 16 * 60_000)), plan: purge })).rejects.toThrow('PENDING_PLAN_EXPIRED')
    await expect(processPendingParentPlan(prisma, { ...context(issued), plan: { ...purge, rowCount: purge.rowCount + 1 } })).rejects.toThrow(/PENDING_PLAN_(?:TAMPERED|STALE)/)
  })

  test('serializes concurrent apply so one plan has exactly one winner', async () => {
    const { parent, student } = await createGraph({ suffix: 'concurrent', ageDays: 3 })
    const now = new Date()
    const reconciliation = (await plan('RECONCILE_LINK', now))!
    const results = await Promise.allSettled([
      processPendingParentPlan(prisma, { ...context(now), plan: reconciliation }),
      processPendingParentPlan(prisma, { ...context(now), plan: reconciliation }),
    ])
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1)
    expect(await prisma.parentStudentLink.count({ where: { parentUserId: parent.id, studentId: student.id } })).toBe(1)
  })

  test('an unknown external FK, including CASCADE, blocks purge automatically', async () => {
    const { parent } = await createGraph({ suffix: 'unknown-fk', ageDays: 91, withLink: true })
    await prisma.$executeRawUnsafe('CREATE TABLE "s2_unknown_reference" ("id" text PRIMARY KEY, "ownerId" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE)')
    await prisma.$executeRawUnsafe('INSERT INTO "s2_unknown_reference" ("id", "ownerId") VALUES ($1, $2)', 'reference', parent.id)
    const audit = await inventoryPendingParentAccounts(prisma, context())
    expect(audit.decisions.HUMAN_REVIEW_REQUIRED).toBe(1)
    expect(audit.purgeCandidates).toBe(0)
    const references = await inspectPendingForeignKeyReferences(prisma)
    expect(references).toContainEqual(expect.objectContaining({ tableName: 's2_unknown_reference', columnName: 'ownerId' }))
  })

  test('a non-FK outbox aggregate reference blocks purge', async () => {
    const { student } = await createGraph({ suffix: 'outbox', ageDays: 91, withLink: true })
    await prisma.jobOutbox.create({
      data: {
        jobType: 'GENERATE_REPORT', aggregateType: 'Student', aggregateId: student.id,
        sourceEventKey: 's2-source', idempotencyKey: `s2-${student.id}`, payload: {},
      },
    })
    const audit = await inventoryPendingParentAccounts(prisma, context())
    expect(audit.decisions.HUMAN_REVIEW_REQUIRED).toBe(1)
    expect(audit.purgeCandidates).toBe(0)
    await prisma.jobOutbox.deleteMany({ where: { idempotencyKey: `s2-${student.id}` } })
  })

  test('rolls back the complete graph when a mid-purge database fault is injected', async () => {
    const { parent, student } = await createGraph({ suffix: 'rollback', ageDays: 91, withLink: true })
    const now = new Date()
    const purge = (await plan('PURGE_GRAPH', now))!
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "s2_fail_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'S2_INJECTED_DELETE_FAILURE'; END $$
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "s2_fail_parent_profile_delete"
      BEFORE DELETE ON "parent_profiles"
      FOR EACH ROW EXECUTE FUNCTION "s2_fail_delete"()
    `)
    await expect(processPendingParentPlan(prisma, { ...context(now), plan: purge })).rejects.toThrow()
    expect(await prisma.user.findUnique({ where: { id: parent.id } })).not.toBeNull()
    expect(await prisma.user.findUnique({ where: { id: student.userId } })).not.toBeNull()
    expect(await prisma.student.findUnique({ where: { id: student.id } })).not.toBeNull()
    expect(await prisma.parentStudentLink.count({ where: { parentUserId: parent.id, studentId: student.id } })).toBe(1)
  })

  test('ambiguous, revoked, foreign and inconsistent relations fail closed', async () => {
    const graph = await createGraph({ suffix: 'ambiguous', ageDays: 91 })
    const other = await createGraph({ suffix: 'other', ageDays: 91, withLink: true })
    await prisma.parentStudentLink.create({
      data: { parentUserId: other.parent.id, studentId: graph.student.id, state: 'REVOKED', revokedAt: new Date() },
    })
    const audit = await inventoryPendingParentAccounts(prisma, context())
    expect(audit.decisions.HUMAN_REVIEW_REQUIRED).toBeGreaterThanOrEqual(1)
    expect(audit.plans.filter(({ graphKey }) => graphKey.length !== 64)).toHaveLength(0)
  })
})

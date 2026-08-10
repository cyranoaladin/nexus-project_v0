import { createHmac, timingSafeEqual } from 'node:crypto'

import { Prisma, PrismaClient } from '@prisma/client'

import { createParentStudentConsentContext } from '@/lib/bilans/parent-student-consent'
import { hasUserEmail } from '@/lib/contact/user-email'
import {
  PENDING_PARENT_MAX_BATCH_SIZE,
  PENDING_PARENT_PLAN_TTL_MS,
  PENDING_PARENT_POLICY_VERSION,
  classifyPendingParentGraph,
  emptyPendingLifecycleDecisionCounts,
  sanitizePendingLifecycleAudit,
  type PendingLifecycleDecisionCounts,
  type PendingParentClassification,
  type PendingParentGraphFacts,
} from '@/lib/auth/pending-account-policy'

const PROCESS_LOCK_ID = 748_210_902
const CLOCK_SKEW_MS = 30_000
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

type LifecycleClient = PrismaClient
type QueryClient = PrismaClient | Prisma.TransactionClient

type LifecycleOptions = Readonly<{
  now: Date
  batchSize: number
  planSecret: string
  environmentId: string
}>

export type PendingLifecycleAction = 'NONE' | 'RECONCILE_LINK' | 'INVALIDATE_EXPIRED_TOKEN' | 'PURGE_GRAPH'

export type PendingLifecyclePlan = Readonly<{
  policyVersion: string
  issuedAt: string
  expiresAt: string
  environmentBinding: string
  graphKey: string
  graphFingerprint: string
  classification: PendingParentClassification
  rowCount: number
  action: PendingLifecycleAction
  planId: string
}>

export type PendingLifecycleProcessOptions = LifecycleOptions & Readonly<{
  plan: PendingLifecyclePlan
}>

export type PendingLifecycleAudit = Readonly<{
  policyVersion: string
  dryRun: boolean
  examined: number
  decisions: PendingLifecycleDecisionCounts
  plannedLinkReconciliations: number
  expiredTokenCandidates: number
  purgeCandidates: number
  reconciledLinks: number
  expiredTokensCleared: number
  purgedGraphs: number
  plans: readonly PendingLifecyclePlan[]
}>

type GraphStudent = Readonly<{
  id: string
  userId: string
  userRole: string
  userPasswordPresent: boolean
  userActivatedAt: Date | null
  createdAt: Date
  updatedAt: Date
  userCreatedAt: Date
  userUpdatedAt: Date
}>

type GraphLink = Readonly<{
  id: string
  parentUserId: string
  studentId: string
  state: 'PENDING_PARENT_CONSENT' | 'VERIFIED' | 'REVOKED' | 'EXPIRED'
  requestedAt: Date
  updatedAt: Date
  consentedAt: Date | null
  verifiedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date | null
}>

type PendingGraph = Readonly<{
  parentUserId: string
  parentEmail: string
  parentProfileId: string | null
  createdAt: Date
  updatedAt: Date
  activationTokenHash: string | null
  activationExpiry: Date | null
  students: readonly GraphStudent[]
  links: readonly GraphLink[]
  facts: PendingParentGraphFacts
}>

export type PendingForeignKeyReference = Readonly<{
  tableName: string
  columnName: string
  targetTable: 'users' | 'parent_profiles' | 'students'
  sourceColumnCount: number
  targetColumnCount: number
  deleteAction: string
}>

type EmailReference = Readonly<{ tableName: string; columnName: string }>
type LooseIdentifierReference = Readonly<{ tableName: string; columnName: string }>

const STRUCTURAL_REFERENCES = new Set([
  'parent_profiles.userId',
  'students.parentId',
  'students.userId',
  'canonical_parent_student_links.parentUserId',
  'canonical_parent_student_links.studentId',
])

function boundedBatchSize(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > PENDING_PARENT_MAX_BATCH_SIZE) {
    throw new Error('PENDING_PARENT_BATCH_SIZE_INVALID')
  }
  return value
}

function validatePlanContext(planSecret: string, environmentId: string): void {
  if (planSecret.length < 32) throw new Error('PENDING_PLAN_SECRET_INVALID')
  if (!/^[A-Za-z0-9._:-]{3,128}$/.test(environmentId)) throw new Error('PENDING_ENVIRONMENT_ID_INVALID')
}

function quoteCatalogIdentifier(value: string): string {
  if (!SAFE_IDENTIFIER.test(value)) throw new Error('PENDING_FK_INTROSPECTION_INVALID_IDENTIFIER')
  return `"${value}"`
}

function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

function safeEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}

export async function inspectPendingForeignKeyReferences(
  client: QueryClient,
): Promise<readonly PendingForeignKeyReference[]> {
  const references = await client.$queryRaw<PendingForeignKeyReference[]>(Prisma.sql`
    SELECT
      source.relname AS "tableName",
      source_column.attname AS "columnName",
      target.relname AS "targetTable",
      cardinality(constraint_row.conkey)::int AS "sourceColumnCount",
      cardinality(constraint_row.confkey)::int AS "targetColumnCount",
      constraint_row.confdeltype::text AS "deleteAction"
    FROM pg_constraint constraint_row
    JOIN pg_class source ON source.oid = constraint_row.conrelid
    JOIN pg_namespace source_namespace ON source_namespace.oid = source.relnamespace
    JOIN pg_class target ON target.oid = constraint_row.confrelid
    JOIN pg_namespace target_namespace ON target_namespace.oid = target.relnamespace
    JOIN pg_attribute source_column
      ON source_column.attrelid = source.oid
      AND source_column.attnum = constraint_row.conkey[1]
    WHERE constraint_row.contype = 'f'
      AND source_namespace.nspname = 'public'
      AND target_namespace.nspname = 'public'
      AND target.relname IN ('users', 'parent_profiles', 'students')
    ORDER BY source.relname, source_column.attname
  `)
  for (const reference of references) {
    quoteCatalogIdentifier(reference.tableName)
    quoteCatalogIdentifier(reference.columnName)
    if (reference.sourceColumnCount !== 1 || reference.targetColumnCount !== 1) {
      throw new Error('PENDING_FK_INTROSPECTION_UNSUPPORTED_COMPOSITE')
    }
  }
  return references
}

async function emailReferences(client: QueryClient): Promise<readonly EmailReference[]> {
  const references = await client.$queryRaw<EmailReference[]>(Prisma.sql`
    SELECT "table_name" AS "tableName", "column_name" AS "columnName"
    FROM information_schema.columns
    WHERE "table_schema" = 'public'
      AND "table_name" <> 'users'
      AND lower("column_name") LIKE '%email%'
      AND "data_type" IN ('character varying', 'text')
    ORDER BY "table_name", "column_name"
  `)
  for (const reference of references) {
    quoteCatalogIdentifier(reference.tableName)
    quoteCatalogIdentifier(reference.columnName)
  }
  return references
}

async function looseIdentifierReferences(client: QueryClient): Promise<readonly LooseIdentifierReference[]> {
  const references = await client.$queryRaw<LooseIdentifierReference[]>(Prisma.sql`
    SELECT columns."table_name" AS "tableName", columns."column_name" AS "columnName"
    FROM information_schema.columns columns
    WHERE columns."table_schema" = 'public'
      AND columns."column_name" <> 'id'
      AND lower(columns."column_name") LIKE '%id'
      AND columns."data_type" IN ('character varying', 'text')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        JOIN pg_class source ON source.oid = constraint_row.conrelid
        JOIN pg_namespace source_namespace ON source_namespace.oid = source.relnamespace
        JOIN pg_attribute source_column
          ON source_column.attrelid = source.oid
          AND source_column.attnum = ANY(constraint_row.conkey)
        WHERE constraint_row.contype = 'f'
          AND source_namespace.nspname = 'public'
          AND source.relname = columns."table_name"
          AND source_column.attname = columns."column_name"
      )
    ORDER BY columns."table_name", columns."column_name"
  `)
  for (const reference of references) {
    quoteCatalogIdentifier(reference.tableName)
    quoteCatalogIdentifier(reference.columnName)
  }
  return references
}

async function referenceExists(
  client: QueryClient,
  tableName: string,
  columnName: string,
  value: string,
): Promise<boolean> {
  const sql = `SELECT EXISTS(SELECT 1 FROM ${quoteCatalogIdentifier(tableName)} WHERE ${quoteCatalogIdentifier(columnName)} = $1 LIMIT 1) AS "exists"`
  const rows = await client.$queryRawUnsafe<Array<{ exists: boolean }>>(sql, value)
  return rows[0]?.exists === true
}

async function normalizedEmailReferenceExists(
  client: QueryClient,
  reference: EmailReference,
  email: string,
): Promise<boolean> {
  const sql = `SELECT EXISTS(SELECT 1 FROM ${quoteCatalogIdentifier(reference.tableName)} WHERE lower(btrim(${quoteCatalogIdentifier(reference.columnName)})) = lower(btrim($1)) LIMIT 1) AS "exists"`
  const rows = await client.$queryRawUnsafe<Array<{ exists: boolean }>>(sql, email)
  return rows[0]?.exists === true
}

async function countBusinessRelations(
  client: QueryClient,
  input: Readonly<{
    parentUserId: string
    parentProfileId: string | null
    students: readonly GraphStudent[]
  }>,
): Promise<number> {
  const targets: Record<PendingForeignKeyReference['targetTable'], readonly string[]> = {
    users: [input.parentUserId, ...input.students.map(({ userId }) => userId)],
    parent_profiles: input.parentProfileId === null ? [] : [input.parentProfileId],
    students: input.students.map(({ id }) => id),
  }
  let count = 0
  for (const reference of await inspectPendingForeignKeyReferences(client)) {
    if (STRUCTURAL_REFERENCES.has(`${reference.tableName}.${reference.columnName}`)) continue
    for (const value of targets[reference.targetTable]) {
      if (await referenceExists(client, reference.tableName, reference.columnName, value)) {
        count += 1
        break
      }
    }
  }
  const opaqueIdentifiers = [
    input.parentUserId,
    ...(input.parentProfileId === null ? [] : [input.parentProfileId]),
    ...input.students.flatMap(({ id, userId }) => [id, userId]),
  ]
  for (const reference of await looseIdentifierReferences(client)) {
    for (const value of opaqueIdentifiers) {
      if (await referenceExists(client, reference.tableName, reference.columnName, value)) {
        count += 1
        break
      }
    }
  }
  return count
}

async function countContactData(client: QueryClient, email: string): Promise<number> {
  let count = 0
  for (const reference of await emailReferences(client)) {
    if (await normalizedEmailReferenceExists(client, reference, email)) count += 1
  }
  return count
}

function latestDate(dates: readonly Date[]): Date {
  return new Date(Math.max(...dates.map((value) => value.getTime())))
}

async function loadGraphs(
  client: QueryClient,
  input: LifecycleOptions & Readonly<{ ids?: readonly string[] }>,
): Promise<readonly PendingGraph[]> {
  const batchSize = boundedBatchSize(input.batchSize)
  const users = await client.user.findMany({
    where: {
      role: 'PARENT',
      password: null,
      activatedAt: null,
      mergedIntoUserId: null,
      email: { not: null },
      ...(input.ids ? { id: { in: [...input.ids] } } : {}),
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: batchSize,
    select: {
      id: true,
      email: true,
      createdAt: true,
      updatedAt: true,
      activationToken: true,
      activationExpiry: true,
      parentProfile: {
        select: {
          id: true,
          bilanGratuitCompletedAt: true,
          bilanGratuitDismissedAt: true,
          children: {
            select: {
              id: true,
              userId: true,
              createdAt: true,
              updatedAt: true,
              credits: true,
              totalSessions: true,
              completedSessions: true,
              user: {
                select: {
                  role: true,
                  password: true,
                  activatedAt: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const graphs: PendingGraph[] = []
  for (const user of users) {
    // Un foyer papier sans e-mail n'est pas une activation abandonnée : il
    // attend une complétion humaine et doit rester visible dans la revue.
    if (!hasUserEmail(user.email)) continue
    const students: GraphStudent[] = (user.parentProfile?.children ?? []).map((student) => ({
      id: student.id,
      userId: student.userId,
      userRole: student.user.role,
      userPasswordPresent: student.user.password !== null,
      userActivatedAt: student.user.activatedAt,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      userCreatedAt: student.user.createdAt,
      userUpdatedAt: student.user.updatedAt,
    }))
    const studentIds = students.map(({ id }) => id)
    const links: GraphLink[] = await client.parentStudentLink.findMany({
      where: {
        OR: [
          { parentUserId: user.id },
          ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : []),
        ],
      },
      select: {
        id: true,
        parentUserId: true,
        studentId: true,
        state: true,
        requestedAt: true,
        updatedAt: true,
        consentedAt: true,
        verifiedAt: true,
        revokedAt: true,
        expiresAt: true,
      },
    })
    const matchingPendingLinks = links.filter((link) => (
      link.parentUserId === user.id
      && studentIds.includes(link.studentId)
      && link.state === 'PENDING_PARENT_CONSENT'
      && link.consentedAt === null
      && link.verifiedAt === null
      && link.revokedAt === null
      && (link.expiresAt === null || link.expiresAt.getTime() > input.now.getTime())
    ))
    const conflictingLinks = links.filter((link) => !matchingPendingLinks.includes(link))
    const scalarBusinessActivity = (
      (user.parentProfile?.bilanGratuitCompletedAt ? 1 : 0)
      + (user.parentProfile?.bilanGratuitDismissedAt ? 1 : 0)
      + (user.parentProfile?.children ?? []).filter((student) => (
        student.credits !== 0 || student.totalSessions !== 0 || student.completedSessions !== 0
      )).length
    )
    const businessRelationCount = scalarBusinessActivity + await countBusinessRelations(client, {
      parentUserId: user.id,
      parentProfileId: user.parentProfile?.id ?? null,
      students,
    })
    const contactDataCount = await countContactData(client, user.email)
    const activityDates = [
      user.createdAt,
      user.updatedAt,
      ...students.flatMap((student) => [
        student.createdAt,
        student.updatedAt,
        student.userCreatedAt,
        student.userUpdatedAt,
      ]),
      ...links.flatMap((link) => [link.requestedAt, link.updatedAt]),
    ]
    const facts: PendingParentGraphFacts = {
      isPendingParent: true,
      referenceTime: latestDate(activityDates),
      activationTokenPresent: user.activationToken !== null,
      activationExpiry: user.activationExpiry,
      parentProfileCount: user.parentProfile === null ? 0 : 1,
      studentCount: students.length,
      studentUserCount: students.length,
      pendingStudentUserCount: students.filter((student) => (
        student.userRole === 'ELEVE'
        && !student.userPasswordPresent
        && student.userActivatedAt === null
      )).length,
      canonicalPendingLinkCount: matchingPendingLinks.length,
      conflictingLinkCount: conflictingLinks.length,
      businessRelationCount,
      contactDataCount,
    }
    graphs.push({
      parentUserId: user.id,
      parentEmail: user.email,
      parentProfileId: user.parentProfile?.id ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      activationTokenHash: user.activationToken,
      activationExpiry: user.activationExpiry,
      students,
      links,
      facts,
    })
  }
  return graphs
}

function graphRowCount(graph: PendingGraph): number {
  return 1 + (graph.parentProfileId ? 1 : 0) + graph.students.length * 2 + graph.links.length
}

function graphSnapshot(graph: PendingGraph): string {
  return JSON.stringify({
    parentUserId: graph.parentUserId,
    parentProfileId: graph.parentProfileId,
    createdAt: graph.createdAt.toISOString(),
    updatedAt: graph.updatedAt.toISOString(),
    activationTokenHash: graph.activationTokenHash,
    activationExpiry: graph.activationExpiry?.toISOString() ?? null,
    students: graph.students.map((student) => ({ ...student,
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
      userCreatedAt: student.userCreatedAt.toISOString(),
      userUpdatedAt: student.userUpdatedAt.toISOString(),
    })).sort((left, right) => left.id.localeCompare(right.id)),
    links: graph.links.map((link) => ({ ...link,
      requestedAt: link.requestedAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
      consentedAt: link.consentedAt?.toISOString() ?? null,
      verifiedAt: link.verifiedAt?.toISOString() ?? null,
      revokedAt: link.revokedAt?.toISOString() ?? null,
      expiresAt: link.expiresAt?.toISOString() ?? null,
    })).sort((left, right) => left.id.localeCompare(right.id)),
    facts: {
      ...graph.facts,
      referenceTime: graph.facts.referenceTime.toISOString(),
      activationExpiry: graph.facts.activationExpiry?.toISOString() ?? null,
    },
  })
}

function actionForClassification(classification: PendingParentClassification): PendingLifecycleAction {
  if (classification === 'RECONCILIATION_REQUIRED') return 'RECONCILE_LINK'
  if (classification === 'TOKEN_INVALIDATION_ELIGIBLE') return 'INVALIDATE_EXPIRED_TOKEN'
  if (classification === 'PURGE_ELIGIBLE') return 'PURGE_GRAPH'
  return 'NONE'
}

function planForGraph(
  graph: PendingGraph,
  options: LifecycleOptions,
  classification: PendingParentClassification,
): PendingLifecyclePlan {
  validatePlanContext(options.planSecret, options.environmentId)
  const issuedAt = options.now.toISOString()
  const expiresAt = new Date(options.now.getTime() + PENDING_PARENT_PLAN_TTL_MS).toISOString()
  const environmentBinding = hmac(options.planSecret, `environment:${options.environmentId}`)
  const graphKey = hmac(options.planSecret, `graph:${graph.parentUserId}`)
  const graphFingerprint = hmac(options.planSecret, `snapshot:${graphSnapshot(graph)}`)
  const action = actionForClassification(classification)
  const rowCount = graphRowCount(graph)
  const planId = hmac(options.planSecret, JSON.stringify({
    policyVersion: PENDING_PARENT_POLICY_VERSION,
    issuedAt,
    expiresAt,
    environmentBinding,
    graphKey,
    graphFingerprint,
    classification,
    rowCount,
    action,
  }))
  return Object.freeze({
    policyVersion: PENDING_PARENT_POLICY_VERSION,
    issuedAt,
    expiresAt,
    environmentBinding,
    graphKey,
    graphFingerprint,
    classification,
    rowCount,
    action,
    planId,
  })
}

function auditFromGraphs(graphs: readonly PendingGraph[], options: LifecycleOptions, dryRun: boolean): PendingLifecycleAudit {
  const decisions = emptyPendingLifecycleDecisionCounts()
  const plans = graphs.map((graph) => {
    const classification = classifyPendingParentGraph(graph.facts, options.now)
    decisions[classification] += 1
    return planForGraph(graph, options, classification)
  })
  return {
    ...sanitizePendingLifecycleAudit({
      policyVersion: PENDING_PARENT_POLICY_VERSION,
      dryRun,
      examined: graphs.length,
      decisions,
    }),
    plannedLinkReconciliations: decisions.RECONCILIATION_REQUIRED,
    expiredTokenCandidates: decisions.TOKEN_INVALIDATION_ELIGIBLE,
    purgeCandidates: decisions.PURGE_ELIGIBLE,
    reconciledLinks: 0,
    expiredTokensCleared: 0,
    purgedGraphs: 0,
    plans,
  }
}

export async function inventoryPendingParentAccounts(
  client: LifecycleClient,
  options: LifecycleOptions,
): Promise<PendingLifecycleAudit> {
  validatePlanContext(options.planSecret, options.environmentId)
  const graphs = await loadGraphs(client, options)
  return auditFromGraphs(graphs, options, true)
}

async function lockedCandidateIds(
  transaction: Prisma.TransactionClient,
  options: LifecycleOptions,
): Promise<readonly string[]> {
  const batchSize = boundedBatchSize(options.batchSize)
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "users"
    WHERE "role" = 'PARENT'::"UserRole"
      AND "password" IS NULL
      AND "activatedAt" IS NULL
      AND "email" IS NOT NULL
    ORDER BY "createdAt" ASC, "id" ASC
    LIMIT ${batchSize}
    FOR UPDATE SKIP LOCKED
  `)
  return rows.map(({ id }) => id)
}

async function lockGraphRows(transaction: Prisma.TransactionClient, graph: PendingGraph): Promise<void> {
  if (graph.parentProfileId) {
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "parent_profiles" WHERE "id" = ${graph.parentProfileId} FOR UPDATE`)
  }
  const studentIds = graph.students.map(({ id }) => id)
  const studentUserIds = graph.students.map(({ userId }) => userId)
  if (studentIds.length > 0) {
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "students" WHERE "id" IN (${Prisma.join(studentIds)}) ORDER BY "id" FOR UPDATE`)
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "users" WHERE "id" IN (${Prisma.join(studentUserIds)}) ORDER BY "id" FOR UPDATE`)
    await transaction.$queryRaw(Prisma.sql`
      SELECT "id" FROM "canonical_parent_student_links"
      WHERE "parentUserId" = ${graph.parentUserId} OR "studentId" IN (${Prisma.join(studentIds)})
      ORDER BY "id" FOR UPDATE
    `)
  }
}

function validatePlanShape(plan: PendingLifecyclePlan): void {
  if (plan.policyVersion !== PENDING_PARENT_POLICY_VERSION) throw new Error('PENDING_PLAN_POLICY_MISMATCH')
  if (!Number.isSafeInteger(plan.rowCount) || plan.rowCount < 1) throw new Error('PENDING_PLAN_INVALID')
  if (!['NONE', 'RECONCILE_LINK', 'INVALIDATE_EXPIRED_TOKEN', 'PURGE_GRAPH'].includes(plan.action)) {
    throw new Error('PENDING_PLAN_INVALID')
  }
  if (plan.action === 'NONE') throw new Error('PENDING_PLAN_NOT_ACTIONABLE')
}

function validatePlanAgainstGraph(
  plan: PendingLifecyclePlan,
  graph: PendingGraph,
  options: LifecycleOptions,
): void {
  validatePlanShape(plan)
  const issuedAt = new Date(plan.issuedAt)
  const expiresAt = new Date(plan.expiresAt)
  if (!Number.isFinite(issuedAt.getTime()) || !Number.isFinite(expiresAt.getTime())) throw new Error('PENDING_PLAN_INVALID')
  if (issuedAt.getTime() > options.now.getTime() + CLOCK_SKEW_MS) throw new Error('PENDING_PLAN_FROM_FUTURE')
  if (expiresAt.getTime() <= options.now.getTime()) throw new Error('PENDING_PLAN_EXPIRED')
  const current = planForGraph(graph, { ...options, now: issuedAt }, classifyPendingParentGraph(graph.facts, options.now))
  const expectedEnvironment = hmac(options.planSecret, `environment:${options.environmentId}`)
  if (!safeEqual(plan.environmentBinding, expectedEnvironment)) throw new Error('PENDING_PLAN_ENVIRONMENT_MISMATCH')
  if (!safeEqual(plan.graphKey, current.graphKey)) throw new Error('PENDING_PLAN_GRAPH_MISMATCH')
  if (!safeEqual(plan.graphFingerprint, current.graphFingerprint)) throw new Error('PENDING_PLAN_STALE')
  if (!safeEqual(plan.planId, current.planId)) throw new Error('PENDING_PLAN_TAMPERED')
  if (plan.classification !== current.classification || plan.action !== current.action || plan.rowCount !== current.rowCount) {
    throw new Error('PENDING_PLAN_STALE')
  }
}

async function purgeGraph(transaction: Prisma.TransactionClient, graph: PendingGraph): Promise<void> {
  const studentIds = graph.students.map(({ id }) => id)
  const studentUserIds = graph.students.map(({ userId }) => userId)
  await transaction.parentStudentLink.deleteMany({
    where: { parentUserId: graph.parentUserId, studentId: { in: studentIds } },
  })
  await transaction.student.deleteMany({ where: { id: { in: studentIds } } })
  await transaction.user.deleteMany({ where: { id: { in: studentUserIds } } })
  if (graph.parentProfileId !== null) {
    await transaction.parentProfile.delete({ where: { id: graph.parentProfileId } })
  }
  await transaction.user.delete({ where: { id: graph.parentUserId } })
}

export async function processPendingParentPlan(
  client: LifecycleClient,
  options: PendingLifecycleProcessOptions,
): Promise<PendingLifecycleAudit> {
  validatePlanContext(options.planSecret, options.environmentId)
  validatePlanShape(options.plan)
  boundedBatchSize(options.batchSize)

  return client.$transaction(async (transaction) => {
    await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${PROCESS_LOCK_ID})`)
    const ids = await lockedCandidateIds(transaction, options)
    let graphs = await loadGraphs(transaction, { ...options, ids })
    let graph = graphs.find((candidate) => safeEqual(
      options.plan.graphKey,
      hmac(options.planSecret, `graph:${candidate.parentUserId}`),
    ))
    if (!graph) throw new Error('PENDING_PLAN_GRAPH_NOT_FOUND')

    await lockGraphRows(transaction, graph)
    graphs = await loadGraphs(transaction, { ...options, ids: [graph.parentUserId] })
    graph = graphs[0]
    if (!graph) throw new Error('PENDING_PLAN_GRAPH_NOT_FOUND')
    validatePlanAgainstGraph(options.plan, graph, options)

    const audit = auditFromGraphs([graph], options, false)
    let reconciledLinks = 0
    let expiredTokensCleared = 0
    let purgedGraphs = 0
    if (options.plan.action === 'RECONCILE_LINK') {
      if (graph.parentProfileId === null || graph.students.length !== 1) throw new Error('PENDING_RECONCILIATION_REFUSED')
      const consent = createParentStudentConsentContext(transaction)
      const link = await consent.preparePending({
        parentUserId: graph.parentUserId,
        studentId: graph.students[0]!.id,
        now: options.now,
      })
      if (link.state !== 'PENDING_PARENT_CONSENT') throw new Error('PENDING_RECONCILIATION_REFUSED')
      reconciledLinks = 1
    } else if (options.plan.action === 'INVALIDATE_EXPIRED_TOKEN') {
      const cleared = await transaction.user.updateMany({
        where: {
          id: graph.parentUserId,
          password: null,
          activatedAt: null,
          activationToken: graph.activationTokenHash,
          activationExpiry: { lte: options.now },
        },
        data: { activationToken: null, activationExpiry: null, updatedAt: options.now },
      })
      if (cleared.count !== 1) throw new Error('PENDING_PLAN_STALE')
      expiredTokensCleared = 1
    } else if (options.plan.action === 'PURGE_GRAPH') {
      await purgeGraph(transaction, graph)
      purgedGraphs = 1
    }

    return { ...audit, reconciledLinks, expiredTokensCleared, purgedGraphs, plans: [] }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

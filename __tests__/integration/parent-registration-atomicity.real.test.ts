/**
 * P0-D Parent registration atomicity on real PostgreSQL.
 *
 * Amendement 7 (Task 4): `POST /api/bilan-gratuit` no longer creates the
 * parent+student account graph itself -- it only captures a `FamilyRequest`.
 * The atomic parent+student creation transaction this suite protects (fault
 * injection at each of its five inserts must roll back to zero rows; no
 * duplicate/partial graph under concurrent creation for the same identity)
 * now lives inside `createFamily()`, reached only through the staff
 * conversion route (`POST /api/assistante/family-requests/[requestId]/
 * convert`). Both the fault-injection triggers below and the graph they
 * protect are unchanged -- only the entry point that reaches them moved.
 */

jest.unmock('@/lib/prisma')
jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true, messageId: 'p0d-test' }),
}))
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}))

import { NextRequest } from 'next/server'

import { POST as registerBilan } from '@/app/api/bilan-gratuit/route'
import { POST as convertFamilyRequest } from '@/app/api/assistante/family-requests/[requestId]/convert/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres'
import { normalizeParentEmail } from '@/lib/auth/parent-activation'

const PREFIX = 'P0DAtomic'
const FAILURE_STEPS = ['parent-user', 'parent-profile', 'student-user', 'student', 'link'] as const

let staffUserId: string

function assertIsolatedDatabase() {
  const target = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
  assertDisposablePostgresUrl(target)
}

function registrationRequest(email: string, child = 'Child') {
  return new NextRequest('http://localhost:3211/api/bilan-gratuit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3211',
    },
    body: JSON.stringify({
      parentFirstName: PREFIX,
      parentLastName: 'Parent',
      parentEmail: email,
      parentPhone: '+21699000006',
      studentFirstName: PREFIX + child,
      studentLastName: 'Student',
      studentGrade: 'Seconde',
      studentSchool: 'Synthetic school',
      subjects: ['MATHEMATIQUES'],
      objectives: 'Prove transactional registration against PostgreSQL.',
      acceptTerms: true,
    }),
  })
}

function convertRequest(requestId: string): NextRequest {
  return new NextRequest(`http://localhost:3211/api/assistante/family-requests/${requestId}/convert`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:3211' },
  })
}

/**
 * Soumet un bilan gratuit (capture seulement une FamilyRequest -- aucune
 * écriture sur `users`/`students`, donc les triggers de panne ci-dessous ne
 * peuvent jamais s'y déclencher) et renvoie l'identifiant de la demande
 * encore `SUBMITTED`, prête à être convertie.
 */
async function submitAndFetchRequestId(email: string, child: string): Promise<string> {
  (auth as jest.Mock).mockResolvedValue(null)
  const response = await registerBilan(registrationRequest(email, child))
  expect(response.status).toBe(200)
  const record = await prisma.familyRequest.findFirstOrThrow({
    where: { contactEmail: normalizeParentEmail(email), status: 'SUBMITTED' },
    orderBy: { createdAt: 'desc' },
  })
  return record.id
}

function convert(requestId: string) {
  (auth as jest.Mock).mockResolvedValue({ user: { id: staffUserId, role: 'ASSISTANTE' } })
  return convertFamilyRequest(convertRequest(requestId), { params: Promise.resolve({ requestId }) })
}

async function cleanupRows() {
  await prisma.$executeRawUnsafe(
    "DELETE FROM canonical_parent_student_links WHERE \"parentUserId\" IN " +
    "(SELECT id FROM users WHERE \"firstName\" LIKE 'P0DAtomic%') OR \"studentId\" IN " +
    "(SELECT s.id FROM students s JOIN users u ON u.id = s.\"userId\" " +
    "WHERE u.\"firstName\" LIKE 'P0DAtomic%')",
  )
  await prisma.familyRequest.deleteMany({ where: { contactFirstName: { startsWith: PREFIX } } })
  await prisma.user.deleteMany({ where: { firstName: { startsWith: PREFIX } } })
}

async function counts() {
  const users = await prisma.user.count({ where: { firstName: { startsWith: PREFIX } } })
  const profiles = await prisma.parentProfile.count({
    where: { user: { firstName: { startsWith: PREFIX } } },
  })
  const students = await prisma.student.count({
    where: { user: { firstName: { startsWith: PREFIX } } },
  })
  const links = await prisma.parentStudentLink.count({
    where: { student: { user: { firstName: { startsWith: PREFIX } } } },
  })
  return { users, profiles, students, links }
}

async function installFailureInjection() {
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS p0d_registration_failure_control (step text PRIMARY KEY)',
  )
  await prisma.$executeRawUnsafe(
    "CREATE OR REPLACE FUNCTION p0d_fail_registration_step() RETURNS trigger LANGUAGE plpgsql AS $$ " +
    "BEGIN IF EXISTS (SELECT 1 FROM p0d_registration_failure_control WHERE step = TG_ARGV[0]) " +
    "THEN RAISE EXCEPTION 'P0D_INJECTED_FAILURE'; END IF; RETURN NEW; END $$",
  )
  const statements = [
    "CREATE TRIGGER p0d_fail_parent_user AFTER INSERT ON users FOR EACH ROW " +
      "WHEN (NEW.role = 'PARENT') EXECUTE FUNCTION p0d_fail_registration_step('parent-user')",
    "CREATE TRIGGER p0d_fail_parent_profile AFTER INSERT ON parent_profiles FOR EACH ROW " +
      "EXECUTE FUNCTION p0d_fail_registration_step('parent-profile')",
    "CREATE TRIGGER p0d_fail_student_user AFTER INSERT ON users FOR EACH ROW " +
      "WHEN (NEW.role = 'ELEVE') EXECUTE FUNCTION p0d_fail_registration_step('student-user')",
    "CREATE TRIGGER p0d_fail_student AFTER INSERT ON students FOR EACH ROW " +
      "EXECUTE FUNCTION p0d_fail_registration_step('student')",
    "CREATE TRIGGER p0d_fail_link AFTER INSERT ON canonical_parent_student_links FOR EACH ROW " +
      "EXECUTE FUNCTION p0d_fail_registration_step('link')",
  ]
  for (const statement of statements) await prisma.$executeRawUnsafe(statement)
}

async function removeFailureInjection() {
  for (const statement of [
    'DROP TRIGGER IF EXISTS p0d_fail_parent_user ON users',
    'DROP TRIGGER IF EXISTS p0d_fail_parent_profile ON parent_profiles',
    'DROP TRIGGER IF EXISTS p0d_fail_student_user ON users',
    'DROP TRIGGER IF EXISTS p0d_fail_student ON students',
    'DROP TRIGGER IF EXISTS p0d_fail_link ON canonical_parent_student_links',
    'DROP FUNCTION IF EXISTS p0d_fail_registration_step()',
    'DROP TABLE IF EXISTS p0d_registration_failure_control',
  ]) await prisma.$executeRawUnsafe(statement)
}

describe('P0-D Parent registration atomicity on real PostgreSQL', () => {
  beforeAll(async () => {
    assertIsolatedDatabase()
    await cleanupRows()
    await removeFailureInjection()
    await installFailureInjection()
    const staff = await prisma.user.create({
      data: { role: 'ASSISTANTE', firstName: 'AtomicTestStaff', lastName: 'Actor' },
      select: { id: true },
    })
    staffUserId = staff.id
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE p0d_registration_failure_control')
    await cleanupRows()
  })

  afterAll(async () => {
    await cleanupRows()
    await removeFailureInjection()
    if (staffUserId) await prisma.user.deleteMany({ where: { id: staffUserId } })
    await prisma.$disconnect()
  })

  it.each(FAILURE_STEPS)('rolls back every record when failure is injected at %s', async (step) => {
    const requestId = await submitAndFetchRequestId('p0d-atomic-' + step + '@example.test', step)

    await prisma.$executeRawUnsafe(
      'INSERT INTO p0d_registration_failure_control(step) VALUES ($1)',
      step,
    )
    const response = await convert(requestId)
    expect(response.status).toBe(500)
    expect(await counts()).toEqual({ users: 0, profiles: 0, students: 0, links: 0 })

    // La transaction de conversion entière (marquage COMPLETED + createFamily())
    // s'annule d'un bloc : la demande reste donc `SUBMITTED`, jamais
    // `COMPLETED` sans foyer, jamais bloquée dans un état intermédiaire.
    const stillPending = await prisma.familyRequest.findUniqueOrThrow({ where: { id: requestId } })
    expect(stillPending.status).toBe('SUBMITTED')
  })

  it('creates one coherent parent graph under concurrent conversions for the same identity', async () => {
    const attemptsBefore = await prisma.canonicalAssessmentAttempt.count()
    const outboxBefore = await prisma.jobOutbox.count()
    const keysBefore = await prisma.canonicalApiIdempotencyKey.count()
    const email = 'p0d-atomic-race@example.test'

    // Deux soumissions distinctes pour la même identité (casse/espaces
    // normalisés différemment, comme dans l'ancien scénario de course), donc
    // deux FamilyRequest indépendantes. Sous l'ancienne architecture, deux
    // POST /api/bilan-gratuit concurrents pour le même e-mail se disputaient
    // directement la création du parent ; Amendement 7 déplace cette
    // dispute à la conversion -- reproduite ici par deux conversions
    // concurrentes de ces deux demandes.
    const requestIdA = await submitAndFetchRequestId(' ' + email.toUpperCase() + ' ', 'First')
    const requestIdB = await submitAndFetchRequestId(email, 'Second')

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: staffUserId, role: 'ASSISTANTE' } })
    const concurrent = await Promise.all([
      convertFamilyRequest(convertRequest(requestIdA), { params: Promise.resolve({ requestId: requestIdA }) }),
      convertFamilyRequest(convertRequest(requestIdB), { params: Promise.resolve({ requestId: requestIdB }) }),
    ])
    expect(concurrent.map((response) => response.status)).toEqual([200, 200])
    // Un seul parent existe pour cette adresse -- jamais deux identités --
    // mais chaque enfant, lui, est réel : ce sont deux demandes légitimement
    // distinctes (Amendement 7 ne les fusionne jamais côté enfant, seule
    // l'identité du parent est dédupliquée). C'est exactement la garantie
    // que createFamily() apporte désormais sous course (voir le repli sur
    // contrainte d'unicité ajouté dans lib/families/create-family.ts).
    expect(await counts()).toEqual({ users: 3, profiles: 1, students: 2, links: 2 })
    expect(await prisma.user.count({ where: { email } })).toBe(1)
    // Chaque enfant créé enqueue son propre e-mail d'activation élève ; seule
    // la conversion qui crée réellement le parent (l'une des deux, jamais
    // les deux -- l'autre retombe sur la branche `existing !== null` de
    // createFamily()) enqueue en plus l'e-mail d'activation parent. Deux
    // enfants + un seul parent créé : exactement trois jobs, jamais quatre
    // (ce qui trahirait un second parent) ni deux (un enfant silencieusement
    // perdu).
    expect(await prisma.jobOutbox.count()).toBe(outboxBefore + 3)

    // Une troisième demande pour la même adresse, convertie séparément,
    // s'attache elle aussi au même unique parent -- jamais un second.
    const requestIdC = await submitAndFetchRequestId(email, 'Third')
    const retry = await convert(requestIdC)
    expect(retry.status).toBe(200)
    expect(await counts()).toEqual({ users: 4, profiles: 1, students: 3, links: 3 })
    expect(await prisma.user.count({ where: { email } })).toBe(1)
    // Un enfant de plus sur le même parent : un seul job supplémentaire (son
    // activation élève), jamais un second e-mail d'activation parent.
    expect(await prisma.jobOutbox.count()).toBe(outboxBefore + 4)
    expect(await prisma.canonicalAssessmentAttempt.count()).toBe(attemptsBefore)
    expect(await prisma.canonicalApiIdempotencyKey.count()).toBe(keysBefore)
  })
})

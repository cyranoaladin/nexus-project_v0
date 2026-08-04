jest.unmock('@/lib/prisma')
jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true, messageId: 'p0d-test' }),
}))
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}))

import { NextRequest } from 'next/server'

import { POST as register } from '@/app/api/bilan-gratuit/route'
import { prisma } from '@/lib/prisma'

const PREFIX = 'P0DAtomic'
const FAILURE_STEPS = ['parent-user', 'parent-profile', 'student-user', 'student', 'link'] as const

function assertIsolatedDatabase() {
  const target = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
  expect(target).toMatch(/(?:localhost|127\.0\.0\.1)/)
  expect(target).toContain('nexus_p0d_parent_test')
  expect(target).not.toMatch(/nexus_prod|production/i)
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

async function cleanupRows() {
  await prisma.$executeRawUnsafe(
    "DELETE FROM canonical_parent_student_links WHERE \"parentUserId\" IN " +
    "(SELECT id FROM users WHERE \"firstName\" LIKE 'P0DAtomic%') OR \"studentId\" IN " +
    "(SELECT s.id FROM students s JOIN users u ON u.id = s.\"userId\" " +
    "WHERE u.\"firstName\" LIKE 'P0DAtomic%')",
  )
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
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE p0d_registration_failure_control')
    await cleanupRows()
  })

  afterAll(async () => {
    await cleanupRows()
    await removeFailureInjection()
    await prisma.$disconnect()
  })

  it.each(FAILURE_STEPS)('rolls back every record when failure is injected at %s', async (step) => {
    await prisma.$executeRawUnsafe(
      'INSERT INTO p0d_registration_failure_control(step) VALUES ($1)',
      step,
    )
    const response = await register(registrationRequest(
      'p0d-atomic-' + step + '@example.test',
      step,
    ))
    expect(response.status).toBe(500)
    expect(await counts()).toEqual({ users: 0, profiles: 0, students: 0, links: 0 })
  })

  it('creates one coherent graph under concurrent and normalized duplicate requests', async () => {
    const attemptsBefore = await prisma.canonicalAssessmentAttempt.count()
    const outboxBefore = await prisma.jobOutbox.count()
    const keysBefore = await prisma.canonicalApiIdempotencyKey.count()
    const email = 'p0d-atomic-race@example.test'

    const concurrent = await Promise.all([
      register(registrationRequest(' ' + email.toUpperCase() + ' ', 'First')),
      register(registrationRequest(email, 'Second')),
    ])
    expect(concurrent.map((response) => response.status)).toEqual([200, 200])
    expect(await counts()).toEqual({ users: 2, profiles: 1, students: 1, links: 1 })

    const retry = await register(registrationRequest(email, 'DifferentChild'))
    expect(retry.status).toBe(200)
    expect(await counts()).toEqual({ users: 2, profiles: 1, students: 1, links: 1 })
    expect(await prisma.canonicalAssessmentAttempt.count()).toBe(attemptsBefore)
    expect(await prisma.jobOutbox.count()).toBe(outboxBefore)
    expect(await prisma.canonicalApiIdempotencyKey.count()).toBe(keysBefore)
  })
})

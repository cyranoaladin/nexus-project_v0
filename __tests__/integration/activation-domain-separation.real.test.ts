jest.unmock('@/lib/prisma')
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}))

import { NextRequest } from 'next/server'

import { POST as canonicalActivation } from '@/app/api/auth/activate/route'
import { POST as legacyStudentActivation } from '@/app/api/student/activate/route'
import { createActivationToken } from '@/lib/auth/activation-token'
import { prisma } from '@/lib/prisma'

const PREFIX = 'p0d-domain-'
const password = 'Synthetic-password-2026'

function assertIsolatedDatabase() {
  const target = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
  expect(target).toMatch(/(?:localhost|127\.0\.0\.1)/)
  expect(target).toContain('nexus_p0d_parent_test')
  expect(target).not.toMatch(/nexus_prod|production/i)
}

function request(path: string, purpose: 'parent' | 'student', token: string) {
  return new NextRequest('http://localhost' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose, token, password }),
  })
}

async function createPendingUser(
  id: string,
  role: 'PARENT' | 'ELEVE',
  token: ReturnType<typeof createActivationToken>,
) {
  return prisma.user.create({
    data: {
      id,
      email: id + '@example.test',
      role,
      firstName: 'P0DDomain',
      lastName: role,
      password: null,
      activatedAt: null,
      activationToken: token.tokenHash,
      activationExpiry: token.expiresAt,
    },
  })
}

describe('P0-D activation domain separation on real PostgreSQL', () => {
  beforeAll(assertIsolatedDatabase)

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.$disconnect()
  })

  it('refuses Parent and student tokens in the opposite domain without writes', async () => {
    const parent = createActivationToken('parent')
    const student = createActivationToken('student')
    await createPendingUser(PREFIX + 'parent', 'PARENT', parent)
    await createPendingUser(PREFIX + 'student', 'ELEVE', student)

    const parentViaStudent = await legacyStudentActivation(
      request('/api/student/activate', 'student', parent.rawToken),
    )
    const studentViaParent = await canonicalActivation(
      request('/api/auth/activate', 'parent', student.rawToken),
    )
    expect(parentViaStudent.status).toBe(400)
    expect(studentViaParent.status).toBe(400)

    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { activatedAt: true, password: true, activationToken: true },
    })
    expect(users).toHaveLength(2)
    expect(users.every((user) => user.activatedAt === null && user.password === null)).toBe(true)
    expect(users.every((user) => user.activationToken !== null)).toBe(true)
  })

  it('refuses a purpose-bound token after the User role changes', async () => {
    const parent = createActivationToken('parent')
    const user = await createPendingUser(PREFIX + 'role-change', 'PARENT', parent)
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ELEVE' } })

    const response = await canonicalActivation(
      request('/api/auth/activate', 'parent', parent.rawToken),
    )
    expect(response.status).toBe(400)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).activatedAt).toBeNull()
  })

  it('allows only the Parent controller to win simultaneous cross-controller consumption', async () => {
    const parent = createActivationToken('parent')
    const user = await createPendingUser(PREFIX + 'race', 'PARENT', parent)

    const [canonical, student] = await Promise.all([
      canonicalActivation(request('/api/auth/activate', 'parent', parent.rawToken)),
      legacyStudentActivation(request('/api/student/activate', 'student', parent.rawToken)),
    ])
    expect([canonical.status, student.status].sort()).toEqual([200, 400])

    const activated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(activated.activatedAt).toBeInstanceOf(Date)
    expect(activated.activationToken).toBeNull()
  })
})

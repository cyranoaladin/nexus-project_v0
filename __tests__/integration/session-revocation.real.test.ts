import { PrismaClient, UserRole } from '@prisma/client'

import {
  revokeAllUserSessions,
  validateSessionToken,
} from '@/lib/auth/session-revocation'
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres'

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const prefix = 's1-session-'

function assertIsolatedDatabase() {
  assertDisposablePostgresUrl(databaseUrl)
}

async function createUser(suffix: string, role: UserRole = UserRole.PARENT) {
  return prisma.user.create({
    data: {
      id: prefix + suffix,
      email: `${prefix}${suffix}@example.test`,
      password: 'synthetic-hash',
      role,
      activatedAt: role === UserRole.PARENT || role === UserRole.ELEVE ? new Date() : null,
    },
  })
}

function token(user: { id: string; role: UserRole; sessionVersion: number }) {
  return { id: user.id, role: user.role, sessionVersion: user.sessionVersion }
}

describe('session revocation on PostgreSQL 15', () => {
  beforeAll(async () => {
    assertIsolatedDatabase()
    await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } })
    await prisma.$disconnect()
  })

  it('revokes an old session and permits a newly issued version', async () => {
    const user = await createUser('version')
    await expect(validateSessionToken(token(user), prisma)).resolves.not.toBeNull()
    const revoked = await revokeAllUserSessions(user.id, prisma)
    expect(revoked.sessionVersion).toBe(1)
    await expect(validateSessionToken(token(user), prisma)).resolves.toBeNull()
    await expect(validateSessionToken({ ...token(user), sessionVersion: 1 }, prisma)).resolves.not.toBeNull()
  })

  it('performs concurrent increments without a lost update', async () => {
    const user = await createUser('concurrent')
    await Promise.all([
      revokeAllUserSessions(user.id, prisma),
      revokeAllUserSessions(user.id, prisma),
    ])
    const current = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(current.sessionVersion).toBe(2)
  })

  it('fails closed after role change, activation revocation and deletion', async () => {
    const roleUser = await createUser('role')
    const roleToken = token(roleUser)
    await prisma.user.update({ where: { id: roleUser.id }, data: { role: UserRole.ELEVE } })
    await expect(validateSessionToken(roleToken, prisma)).resolves.toBeNull()

    const inactiveUser = await createUser('inactive')
    const inactiveToken = token(inactiveUser)
    await prisma.user.update({ where: { id: inactiveUser.id }, data: { activatedAt: null } })
    await expect(validateSessionToken(inactiveToken, prisma)).resolves.toBeNull()

    const deletedUser = await createUser('deleted')
    const deletedToken = token(deletedUser)
    await prisma.user.delete({ where: { id: deletedUser.id } })
    await expect(validateSessionToken(deletedToken, prisma)).resolves.toBeNull()
  })
})

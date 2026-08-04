import bcrypt from 'bcryptjs'

import { authorizeCredentials } from '@/lib/auth/credentials-authorize'
import { prisma } from '@/lib/prisma'

jest.mock('bcryptjs', () => ({ compare: jest.fn() }))

const compare = bcrypt.compare as jest.Mock
const findUnique = prisma.user.findUnique as jest.Mock
const baseUser = {
  id: 'parent-user',
  email: 'parent@example.test',
  password: 'hashed-password',
  activatedAt: new Date('2026-08-01T00:00:00Z'),
  role: 'PARENT',
  firstName: 'Parent',
  lastName: 'Synthetic',
  parentProfile: {},
  coachProfile: null,
}

describe('credentials authorization activation matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    compare.mockResolvedValue(true)
  })

  it.each([
    ['activated Parent', baseUser, true],
    ['pending Parent with an expired token', { ...baseUser, activatedAt: null, activationExpiry: new Date(0) }, false],
    ['pending Parent with a valid token', { ...baseUser, activatedAt: null, activationExpiry: new Date('2099-01-01') }, false],
    ['Parent without password', { ...baseUser, password: null }, false],
    ['activated student', { ...baseUser, role: 'ELEVE' }, true],
    ['pending student', { ...baseUser, role: 'ELEVE', activatedAt: null }, false],
    ['historical coach', { ...baseUser, role: 'COACH', activatedAt: null }, true],
    ['historical admin', { ...baseUser, role: 'ADMIN', activatedAt: null }, true],
  ])('%s', async (_label, user, allowed) => {
    findUnique.mockResolvedValue(user)
    const action = authorizeCredentials({ email: ' Parent@Example.Test ', password: 'correct-password' })
    if (allowed) {
      await expect(action).resolves.toEqual(expect.objectContaining({ id: user.id, role: user.role }))
    } else if (user.password === null) {
      await expect(action).resolves.toBeNull()
    } else {
      await expect(action).rejects.toThrow('Compte non activé')
    }
  })

  it('refuses an unknown user and a wrong password', async () => {
    findUnique.mockResolvedValueOnce(null)
    await expect(authorizeCredentials({ email: 'missing@example.test', password: 'password' })).resolves.toBeNull()
    findUnique.mockResolvedValueOnce(baseUser)
    compare.mockResolvedValueOnce(false)
    await expect(authorizeCredentials({ email: baseUser.email, password: 'wrong' })).resolves.toBeNull()
  })

  it('normalizes Unicode-equivalent and case-varied addresses before lookup', async () => {
    findUnique.mockResolvedValue(baseUser)
    await authorizeCredentials({ email: ' PARÉNT@EXAMPLE.TEST ', password: 'password' })
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'parént@example.test' },
    }))
  })
})

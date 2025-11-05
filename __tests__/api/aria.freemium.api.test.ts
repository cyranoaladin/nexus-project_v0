import { GET, POST } from '@/app/api/aria/freemium/route'
import { NextRequest } from 'next/server'
import { Subject, AriaAccessStatus } from '@/types/enums'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {}
}))

jest.mock('@/lib/aria-access', () => {
  const { Subject } = require('@/types/enums')
  return {
    DEFAULT_FREEMIUM_SUBJECTS: [Subject.MATHEMATIQUES, Subject.FRANCAIS],
    DEFAULT_FREEMIUM_TOKENS: 20,
    getAriaAccessSnapshot: jest.fn(),
    grantAriaFreemium: jest.fn(),
    hasFreemiumQuota: jest.fn()
  }
})

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() }
  }
}))

const { getServerSession } = jest.requireMock('next-auth') as { getServerSession: jest.Mock }
const {
  DEFAULT_FREEMIUM_SUBJECTS,
  DEFAULT_FREEMIUM_TOKENS,
  getAriaAccessSnapshot,
  grantAriaFreemium,
  hasFreemiumQuota
} = jest.requireMock('@/lib/aria-access') as {
  DEFAULT_FREEMIUM_SUBJECTS: Subject[]
  DEFAULT_FREEMIUM_TOKENS: number
  getAriaAccessSnapshot: jest.Mock
  grantAriaFreemium: jest.Mock
  hasFreemiumQuota: jest.Mock
}
const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    student: { findUnique: jest.Mock }
  }
}

function buildRequest(payload?: unknown): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(payload ?? {}),
    headers: new Headers()
  } as unknown as NextRequest
}

describe('ARIA freemium API', () => {
  const now = new Date('2024-01-01T00:00:00.000Z')
  const baseStudent = {
    id: 'stu-1',
    userId: 'user-1'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getServerSession.mockResolvedValue({ user: { id: 'user-1', role: 'ELEVE' } })
    prisma.student.findUnique.mockResolvedValue(baseStudent)
    getAriaAccessSnapshot.mockReturnValue({
      status: AriaAccessStatus.FREEMIUM,
      subjects: DEFAULT_FREEMIUM_SUBJECTS,
      activatedAt: now,
      deactivatedAt: null,
      freemium: {
        tokensGranted: DEFAULT_FREEMIUM_TOKENS,
        tokensUsed: 0,
        remaining: DEFAULT_FREEMIUM_TOKENS,
        expiresAt: null
      },
      lastInteractionAt: now
    })
    hasFreemiumQuota.mockReturnValue(true)
  })

  it('returns freemium snapshot for GET', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.access.status).toBe(AriaAccessStatus.FREEMIUM)
    expect(data.access.subjects).toEqual(DEFAULT_FREEMIUM_SUBJECTS)
    expect(data.access.activatedAt).toBe(now.toISOString())
  })

  it('returns 401 on GET when session is missing', async () => {
    getServerSession.mockResolvedValueOnce(null)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toMatch(/Accès non autorisé/)
  })

  it('activates freemium access when student is inactive', async () => {
    prisma.student.findUnique.mockResolvedValueOnce(baseStudent).mockResolvedValueOnce(baseStudent)
    const inactiveSnapshot = {
      status: AriaAccessStatus.INACTIVE,
      subjects: [],
      activatedAt: null,
      deactivatedAt: null,
      freemium: { tokensGranted: 0, tokensUsed: 0, remaining: 0, expiresAt: null },
      lastInteractionAt: null
    }
    const freemiumSnapshot = {
      status: AriaAccessStatus.FREEMIUM,
      subjects: DEFAULT_FREEMIUM_SUBJECTS,
      activatedAt: now,
      deactivatedAt: null,
      freemium: {
        tokensGranted: DEFAULT_FREEMIUM_TOKENS,
        tokensUsed: 0,
        remaining: DEFAULT_FREEMIUM_TOKENS,
        expiresAt: now
      },
      lastInteractionAt: now
    }
    getAriaAccessSnapshot.mockReturnValueOnce(inactiveSnapshot).mockReturnValueOnce(freemiumSnapshot)
    grantAriaFreemium.mockResolvedValueOnce(undefined)

    const response = await POST(buildRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(grantAriaFreemium).toHaveBeenCalledWith({
      studentId: 'stu-1',
      subjects: DEFAULT_FREEMIUM_SUBJECTS,
      tokens: DEFAULT_FREEMIUM_TOKENS,
      durationDays: undefined
    })
    expect(data.success).toBe(true)
    expect(data.access.status).toBe(AriaAccessStatus.FREEMIUM)
  })

  it('returns 409 when ARIA is already active', async () => {
    getAriaAccessSnapshot.mockReturnValueOnce({
      status: AriaAccessStatus.ACTIVE,
      subjects: DEFAULT_FREEMIUM_SUBJECTS,
      activatedAt: now,
      deactivatedAt: null,
      freemium: { tokensGranted: 0, tokensUsed: 0, remaining: 0, expiresAt: null },
      lastInteractionAt: now
    })

    const response = await POST(buildRequest())
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toMatch(/déjà activée/)
    expect(grantAriaFreemium).not.toHaveBeenCalled()
  })

  it('returns 403 when ARIA is suspended', async () => {
    getAriaAccessSnapshot.mockReturnValueOnce({
      status: AriaAccessStatus.SUSPENDED,
      subjects: [],
      activatedAt: null,
      deactivatedAt: now,
      freemium: { tokensGranted: 0, tokensUsed: 0, remaining: 0, expiresAt: null },
      lastInteractionAt: null
    })

    const response = await POST(buildRequest())
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toMatch(/suspendu/)
    expect(grantAriaFreemium).not.toHaveBeenCalled()
  })

  it('keeps freemium active when quota available', async () => {
    getAriaAccessSnapshot.mockReturnValueOnce({
      status: AriaAccessStatus.FREEMIUM,
      subjects: DEFAULT_FREEMIUM_SUBJECTS,
      activatedAt: now,
      deactivatedAt: null,
      freemium: {
        tokensGranted: DEFAULT_FREEMIUM_TOKENS,
        tokensUsed: 5,
        remaining: DEFAULT_FREEMIUM_TOKENS - 5,
        expiresAt: now
      },
      lastInteractionAt: now
    })
    hasFreemiumQuota.mockReturnValueOnce(true)

    const response = await POST(buildRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toMatch(/déjà actif/)
    expect(grantAriaFreemium).not.toHaveBeenCalled()
  })

  it('returns 402 when freemium quota depleted', async () => {
    getAriaAccessSnapshot.mockReturnValueOnce({
      status: AriaAccessStatus.FREEMIUM,
      subjects: DEFAULT_FREEMIUM_SUBJECTS,
      activatedAt: now,
      deactivatedAt: null,
      freemium: { tokensGranted: 10, tokensUsed: 10, remaining: 0, expiresAt: now },
      lastInteractionAt: now
    })
    hasFreemiumQuota.mockReturnValueOnce(false).mockReturnValue(false)

    const response = await POST(buildRequest())
    const data = await response.json()

    expect(response.status).toBe(402)
    expect(data.error).toMatch(/quota freemium/i)
    expect(grantAriaFreemium).not.toHaveBeenCalled()
  })
})

import { POST } from '@/app/api/aria/chat/route'
import { NextRequest } from 'next/server'
import { Subject } from '@/types/enums'
import { AriaAccessStatus } from '@prisma/client'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {}
}))

jest.mock('@/lib/aria', () => ({
  generateAriaResponse: jest.fn(),
  saveAriaConversation: jest.fn()
}))

jest.mock('@/lib/badges', () => ({
  checkAndAwardBadges: jest.fn()
}))

jest.mock('@/lib/aria-access', () => ({
  getAriaAccessSnapshot: jest.fn(),
  hasFreemiumQuota: jest.fn(),
  parseSubjectsDescriptor: jest.fn(),
  registerAriaInteraction: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    ariaMessage: { findMany: jest.fn() }
  }
}))

const { getServerSession } = jest.requireMock('next-auth') as { getServerSession: jest.Mock }
const { generateAriaResponse, saveAriaConversation } = jest.requireMock('@/lib/aria') as {
  generateAriaResponse: jest.Mock
  saveAriaConversation: jest.Mock
}
const { checkAndAwardBadges } = jest.requireMock('@/lib/badges') as { checkAndAwardBadges: jest.Mock }
const {
  getAriaAccessSnapshot,
  hasFreemiumQuota,
  parseSubjectsDescriptor,
  registerAriaInteraction
} = jest.requireMock('@/lib/aria-access') as {
  getAriaAccessSnapshot: jest.Mock
  hasFreemiumQuota: jest.Mock
  parseSubjectsDescriptor: jest.Mock
  registerAriaInteraction: jest.Mock
}
const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    student: { findUnique: jest.Mock }
    ariaMessage: { findMany: jest.Mock }
  }
}

function buildRequest(payload: unknown, headersInit?: Record<string, string>): NextRequest {
  const headers = new Headers(headersInit)
  return {
    headers,
    json: jest.fn().mockResolvedValue(payload)
  } as unknown as NextRequest
}

describe('ARIA Chat API', () => {
  const baseStudent = {
    id: 'stu-1',
    userId: 'user-1',
    ariaStatus: AriaAccessStatus.FREEMIUM,
    ariaSubjects: '[]',
    ariaActivatedAt: null,
    ariaDeactivatedAt: null,
    ariaFreemiumTokens: 20,
    ariaFreemiumTokensUsed: 0,
    ariaFreemiumExpiresAt: null,
    ariaLastInteractionAt: null,
    subscriptions: [{ ariaSubjects: JSON.stringify([Subject.MATHEMATIQUES]) }]
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getServerSession.mockResolvedValue({ user: { id: 'user-1', role: 'ELEVE' } })
    generateAriaResponse.mockResolvedValue('Réponse ARIA test')
    saveAriaConversation.mockResolvedValue({
      conversation: { id: 'conv-1', subject: Subject.MATHEMATIQUES, title: 'Test' },
      ariaMessage: { id: 'msg-1', createdAt: new Date().toISOString() }
    })
    checkAndAwardBadges.mockResolvedValue([])
    getAriaAccessSnapshot.mockReturnValue({
      status: AriaAccessStatus.FREEMIUM,
      subjects: [Subject.MATHEMATIQUES],
      activatedAt: null,
      deactivatedAt: null,
      freemium: {
        tokensGranted: 20,
        tokensUsed: 0,
        remaining: 20,
        expiresAt: null
      },
      lastInteractionAt: null
    })
    hasFreemiumQuota.mockReturnValue(true)
    parseSubjectsDescriptor.mockReturnValue([Subject.MATHEMATIQUES])
    prisma.student.findUnique.mockResolvedValue(baseStudent)
    prisma.ariaMessage.findMany.mockResolvedValue([])
  })

  it('returns assistant message content when access is valid', async () => {
    const request = buildRequest({
      subject: Subject.MATHEMATIQUES,
      content: 'Bonjour',
      conversationId: undefined
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message.content).toBe('Réponse ARIA test')
    expect(registerAriaInteraction).toHaveBeenCalledWith({
      studentId: 'stu-1',
      status: AriaAccessStatus.FREEMIUM,
      tokensConsumed: 1
    })
    expect(checkAndAwardBadges).toHaveBeenNthCalledWith(1, 'stu-1', 'first_aria_question')
    expect(checkAndAwardBadges).toHaveBeenNthCalledWith(2, 'stu-1', 'aria_question_count')
  })

  it('returns 403 when subject is not allowed', async () => {
    const request = buildRequest({
      subject: Subject.FRANCAIS,
      content: 'Bonjour'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toMatch(/non autorisé/)
  })

  it('returns 403 when ARIA access is suspended', async () => {
    getAriaAccessSnapshot.mockReturnValueOnce({
      status: AriaAccessStatus.SUSPENDED,
      subjects: [Subject.MATHEMATIQUES],
      activatedAt: null,
      deactivatedAt: null,
      freemium: { tokensGranted: 0, tokensUsed: 0, remaining: 0, expiresAt: null },
      lastInteractionAt: null
    })

    const request = buildRequest({
      subject: Subject.MATHEMATIQUES,
      content: 'Pourquoi ?'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toMatch(/suspendu/)
    expect(generateAriaResponse).not.toHaveBeenCalled()
  })

  it('returns 402 when freemium quota is exhausted', async () => {
    getAriaAccessSnapshot.mockReturnValueOnce({
      status: AriaAccessStatus.FREEMIUM,
      subjects: [Subject.MATHEMATIQUES],
      activatedAt: null,
      deactivatedAt: null,
      freemium: { tokensGranted: 5, tokensUsed: 5, remaining: 0, expiresAt: null },
      lastInteractionAt: null
    })
    hasFreemiumQuota.mockReturnValueOnce(false)

    const request = buildRequest({
      subject: Subject.MATHEMATIQUES,
      content: 'Quota?'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(402)
    expect(data.error).toMatch(/Quota freemium/)
    expect(generateAriaResponse).not.toHaveBeenCalled()
  })

  it('returns 401 when session is missing', async () => {
    getServerSession.mockResolvedValueOnce(null)

    const request = buildRequest({
      subject: Subject.MATHEMATIQUES,
      content: 'Bonjour'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toMatch(/Accès non autorisé/)
  })
})

import { POST } from '@/app/api/aria/feedback/route'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {}
}))

jest.mock('@/lib/aria', () => ({
  recordAriaFeedback: jest.fn()
}))

jest.mock('@/lib/badges', () => ({
  checkAndAwardBadges: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    ariaMessage: { findFirst: jest.fn() },
    student: { findUnique: jest.fn() }
  }
}))

const { getServerSession } = jest.requireMock('next-auth') as { getServerSession: jest.Mock }
const { recordAriaFeedback } = jest.requireMock('@/lib/aria') as { recordAriaFeedback: jest.Mock }
const { checkAndAwardBadges } = jest.requireMock('@/lib/badges') as { checkAndAwardBadges: jest.Mock }
const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    ariaMessage: { findFirst: jest.Mock }
    student: { findUnique: jest.Mock }
  }
}

function buildRequest(payload: unknown): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(payload),
    headers: new Headers()
  } as unknown as NextRequest
}

describe('ARIA feedback API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getServerSession.mockResolvedValue({ user: { id: 'user-1', role: 'ELEVE' } })
    prisma.ariaMessage.findFirst.mockResolvedValue({ id: 'message-1' })
    prisma.student.findUnique.mockResolvedValue({ id: 'student-1' })
    recordAriaFeedback.mockResolvedValue(undefined)
    checkAndAwardBadges.mockResolvedValue([{ badge: { name: 'badge', description: 'desc', icon: 'icon.png' } }])
  })

  it('records feedback and returns new badges', async () => {
    const response = await POST(buildRequest({ messageId: 'message-1', feedback: true }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(recordAriaFeedback).toHaveBeenCalledWith('message-1', true)
    expect(checkAndAwardBadges).toHaveBeenCalledWith('student-1', 'aria_feedback')
    expect(data.success).toBe(true)
    expect(data.newBadges).toEqual([
      { name: 'badge', description: 'desc', icon: 'icon.png' }
    ])
  })

  it('returns 401 when there is no session', async () => {
    getServerSession.mockResolvedValueOnce(null)

    const response = await POST(buildRequest({ messageId: 'message-1', feedback: false }))
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toMatch(/Accès non autorisé/)
    expect(recordAriaFeedback).not.toHaveBeenCalled()
  })

  it('returns 404 when message is not found', async () => {
    prisma.ariaMessage.findFirst.mockResolvedValueOnce(null)

    const response = await POST(buildRequest({ messageId: 'message-2', feedback: true }))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toMatch(/Message non trouvé/)
    expect(recordAriaFeedback).not.toHaveBeenCalled()
  })

  it('returns success without badges when student lookup fails', async () => {
    prisma.student.findUnique.mockResolvedValueOnce(null)

    const response = await POST(buildRequest({ messageId: 'message-1', feedback: false }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(checkAndAwardBadges).not.toHaveBeenCalled()
    expect(data.success).toBe(true)
    expect(data.newBadges).toBeUndefined()
  })
})

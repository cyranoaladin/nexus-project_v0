import { POST as POST_KONNECT } from '@/app/api/payments/konnect/route'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } })
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

const mockFindFirstStudent = jest.fn()
const mockFindUniquePayment = jest.fn()
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findFirst: (...args: any[]) => mockFindFirstStudent(...args) },
    payment: { findUnique: (...args: any[]) => mockFindUniquePayment(...args) }
  }
}))

describe('Konnect init rate limit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindFirstStudent.mockResolvedValue({ id: 'st1' })
    mockFindUniquePayment.mockResolvedValue({
      id: 'p1',
      userId: 'parent-1',
      amount: 99,
      currency: 'TND',
      description: 'Abonnement HYBRIDE',
      status: 'PENDING',
      method: 'konnect',
      type: 'SUBSCRIPTION',
      externalId: 'ext_1',
      metadata: {},
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      user: {
        id: 'parent-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean@example.com',
        role: 'PARENT'
      }
    })
  })

  it('returns 429 after exceeding allowed requests per minute', async () => {
    const originalEnv = process.env
    process.env = { ...originalEnv, NODE_ENV: 'production' } as NodeJS.ProcessEnv

    const mockUpsert = jest.fn().mockResolvedValue({ payment: { id: 'p1', userId: 'parent-1' }, created: true })
    jest.doMock('@/lib/payments', () => ({ upsertPaymentByExternalId: (...args: any[]) => mockUpsert(...args) }))

    try {
      let lastStatus = 200
      for (let i = 0; i < 6; i++) {
        const req = new NextRequest('http://localhost/api/payments/konnect', {
          method: 'POST',
          body: JSON.stringify({ type: 'subscription', key: 'HYBRIDE', studentId: 'st1', amount: 99, description: 'Abonnement HYBRIDE' }),
          headers: { 'x-real-ip': '127.0.0.1', 'content-type': 'application/json', 'x-csrf-token': 'dev' }
        } as any)
        const res = await POST_KONNECT(req as any)
        lastStatus = res.status
        if (res.status === 429) break
      }
      expect(lastStatus).toBe(429)
    } finally {
      process.env = originalEnv
    }
  })
})
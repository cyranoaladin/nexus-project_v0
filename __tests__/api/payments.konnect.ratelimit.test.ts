import { POST as POST_KONNECT } from '@/app/api/payments/konnect/route'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } })
}))

const mockFindFirstStudent = jest.fn()
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findFirst: (...args: any[]) => mockFindFirstStudent(...args) }
  }
}))

describe('Konnect init rate limit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindFirstStudent.mockResolvedValue({ id: 'st1' })
  })

  it('returns 429 after exceeding allowed requests per minute', async () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const mockUpsert = jest.fn().mockResolvedValue({ payment: { id: 'p1' } })
    jest.doMock('@/lib/payments', () => ({ upsertPaymentByExternalId: (...args: any[]) => mockUpsert(...args) }))

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
    process.env.NODE_ENV = original
  })
})
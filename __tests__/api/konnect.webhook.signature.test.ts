import { POST as KONNECT_WEBHOOK } from '@/app/api/webhooks/konnect/route'
import { NextRequest } from 'next/server'

const mockPaymentFindFirst = jest.fn()
jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findFirst: (...args: any[]) => mockPaymentFindFirst(...args),
      findUnique: (...args: any[]) => mockPaymentFindFirst(...args),
      update: jest.fn()
    },
    student: { findUnique: jest.fn() },
    subscription: { updateMany: jest.fn() }
  }
}))

const originalEnv = { ...process.env }

describe('Konnect Webhook Signature', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    process.env.NODE_ENV = 'production'
    process.env.KONNECT_WEBHOOK_SECRET = 'testsecret'
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('rejects missing signature with 403 in production', async () => {
    const body = { payment_id: 'not-exist', status: 'completed' }
    const req = new NextRequest('http://localhost/api/webhooks/konnect', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' }
    } as any)

    const res = await KONNECT_WEBHOOK(req as any)
    expect(res.status).toBe(403)
  })

  it('accepts valid signature and returns success (even if payment not found -> 404)', async () => {
    const body = JSON.stringify({ payment_id: 'not-found', status: 'completed' })
    const crypto = await import('crypto')
    const hmac = crypto.createHmac('sha256', process.env.KONNECT_WEBHOOK_SECRET as string).update(body).digest('hex')

    const req = new NextRequest('http://localhost/api/webhooks/konnect', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-konnect-signature': hmac
      }
    } as any)

    const res = await KONNECT_WEBHOOK(req as any)
    // Paiement introuvable dans ce test -> 404
    expect([200, 404]).toContain(res.status)
  })
})
import { NextRequest } from 'next/server'

import { GET, POST } from '@/app/api/auth/activate/route'
import { completeStudentActivation, verifyActivationToken } from '@/lib/services/student-activation.service'

jest.mock('@/lib/services/student-activation.service', () => ({
  completeStudentActivation: jest.fn(),
  verifyActivationToken: jest.fn(),
}))
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}))

const parentToken = 'pact_' + 'a'.repeat(43)
const studentToken = 'sact_' + 'b'.repeat(43)

describe('canonical role-bound activation controller', () => {
  beforeEach(() => jest.clearAllMocks())

  it('passes an explicit Parent purpose to verification and completion', async () => {
    ;(verifyActivationToken as jest.Mock).mockResolvedValue({ valid: true, accountRole: 'PARENT' })
    ;(completeStudentActivation as jest.Mock).mockResolvedValue({ success: true })
    const verification = await GET(new NextRequest(
      'http://localhost/api/auth/activate?purpose=parent&token=' + parentToken,
    ))
    const completion = await POST(new NextRequest('http://localhost/api/auth/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'parent', token: parentToken, password: 'Secure-pass-2026' }),
    }))
    expect(verification.status).toBe(200)
    expect(completion.status).toBe(200)
    expect(verifyActivationToken).toHaveBeenCalledWith(parentToken, 'parent')
    expect(completeStudentActivation).toHaveBeenCalledWith(parentToken, 'Secure-pass-2026', 'parent')
  })

  it.each([
    ['missing purpose', 'http://localhost/api/auth/activate?token=' + parentToken],
    ['unknown purpose', 'http://localhost/api/auth/activate?purpose=coach&token=' + parentToken],
  ])('fails closed for %s', async (_label, url) => {
    const response = await GET(new NextRequest(url))
    expect(response.status).toBe(400)
    expect(verifyActivationToken).not.toHaveBeenCalled()
  })

  it('does not let a purpose field widen the student compatibility adapter', async () => {
    const { POST: legacyStudentPost } = await import('@/app/api/student/activate/route')
    const response = await legacyStudentPost(new NextRequest('http://localhost/api/student/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'parent', token: studentToken, password: 'Secure-pass-2026' }),
    }))
    expect(response.status).toBe(400)
    expect(completeStudentActivation).not.toHaveBeenCalled()
  })
})

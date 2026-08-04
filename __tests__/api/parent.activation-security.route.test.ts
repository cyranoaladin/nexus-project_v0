import { NextRequest, NextResponse } from 'next/server'

import { GET, POST } from '@/app/api/auth/activate/route'
import {
  completeStudentActivation,
  verifyActivationToken,
} from '@/lib/services/student-activation.service'
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive'

jest.mock('@/lib/services/student-activation.service', () => ({
  completeStudentActivation: jest.fn(),
  verifyActivationToken: jest.fn(),
}))

jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn(),
}))

const TOKEN = 'a'.repeat(43)
const secureHeaders = (response: Response) => {
  expect(response.headers.get('Cache-Control')).toContain('private')
  expect(response.headers.get('Cache-Control')).toContain('no-store')
  expect(response.headers.get('Cache-Control')).toContain('max-age=0')
  expect(response.headers.get('Pragma')).toBe('no-cache')
  expect(response.headers.get('Expires')).toBe('0')
  expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
}

describe('generic Parent/Eleve activation route security', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(guardSensitiveRateLimit as jest.Mock).mockResolvedValue(null)
  })

  it('secures successful Parent verification and activation responses', async () => {
    ;(verifyActivationToken as jest.Mock).mockResolvedValue({
      valid: true,
      studentName: 'Parent synthetique',
      email: 'parent@example.test',
      accountRole: 'PARENT',
    })
    ;(completeStudentActivation as jest.Mock).mockResolvedValue({
      success: true,
      redirectUrl: '/auth/signin?activated=true',
    })

    const verification = await GET(new NextRequest(
      'http://localhost/api/auth/activate?purpose=parent&token=pact_' + TOKEN,
    ))
    const activation = await POST(new NextRequest('http://localhost/api/auth/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'parent', token: 'pact_' + TOKEN, password: 'Secure-pass-2026' }),
    }))

    expect(verification.status).toBe(200)
    expect(await verification.json()).toEqual(expect.objectContaining({ accountRole: 'PARENT' }))
    expect(activation.status).toBe(200)
    secureHeaders(verification)
    secureHeaders(activation)
  })

  it('secures malformed, rejected, rate-limited and internal-error responses', async () => {
    ;(completeStudentActivation as jest.Mock).mockResolvedValue({ success: false, error: 'Lien invalide' })

    const malformed = await GET(new NextRequest('http://localhost/api/auth/activate?purpose=parent&token=short'))
    const rejected = await POST(new NextRequest('http://localhost/api/auth/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'parent', token: 'pact_' + TOKEN, password: 'Secure-pass-2026' }),
    }))
    ;(guardSensitiveRateLimit as jest.Mock).mockResolvedValueOnce(NextResponse.json({ error: 'rate' }, { status: 429 }))
    const limited = await GET(new NextRequest(
      'http://localhost/api/auth/activate?purpose=parent&token=pact_' + TOKEN,
    ))
    ;(guardSensitiveRateLimit as jest.Mock).mockResolvedValue(null)
    ;(verifyActivationToken as jest.Mock).mockRejectedValueOnce(new Error('recognizable-raw-token-must-not-leak'))
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const internal = await GET(new NextRequest(
      'http://localhost/api/auth/activate?purpose=parent&token=pact_' + TOKEN,
    ))

    for (const response of [malformed, rejected, limited, internal]) secureHeaders(response)
    expect(JSON.stringify(await internal.json())).not.toContain(TOKEN)
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(TOKEN)
    consoleError.mockRestore()
  })
})

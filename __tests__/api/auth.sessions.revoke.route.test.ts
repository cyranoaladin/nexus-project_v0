jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/auth/session-revocation', () => ({ revokeAllUserSessions: jest.fn() }))

import { auth } from '@/auth'
import { POST } from '@/app/api/auth/sessions/revoke/route'
import { revokeAllUserSessions } from '@/lib/auth/session-revocation'

describe('POST /api/auth/sessions/revoke', () => {
  beforeEach(() => jest.clearAllMocks())

  it('fails closed for an anonymous caller with private no-store headers', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const response = await POST(revokeRequest())
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toContain('private')
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(response.headers.get('Pragma')).toBe('no-cache')
    expect(response.headers.get('Expires')).toBe('0')
  })

  it('atomically revokes every session for the authenticated User', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'PARENT' } })
    ;(revokeAllUserSessions as jest.Mock).mockResolvedValue({ sessionVersion: 1 })
    const response = await POST(revokeRequest())
    expect(response.status).toBe(200)
    expect(revokeAllUserSessions).toHaveBeenCalledWith('user-1')
    expect(await response.json()).toEqual({ success: true })
  })

  it('returns a generic fail-closed response when revocation cannot be persisted', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'PARENT' } })
    ;(revokeAllUserSessions as jest.Mock).mockRejectedValue(new Error('private database detail'))
    const response = await POST(revokeRequest())
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('private database detail')
  })
})

function revokeRequest(): Parameters<typeof POST>[0] {
  return new Request('http://localhost/api/auth/sessions/revoke', {
    method: 'POST',
    headers: { origin: 'http://localhost' },
  }) as Parameters<typeof POST>[0]
}

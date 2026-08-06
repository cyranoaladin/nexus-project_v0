export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { revokeAllUserSessions } from '@/lib/auth/session-revocation'
import { checkCsrf } from '@/lib/csrf'
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive'
import { NextRequest, NextResponse } from 'next/server'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS })
}

function privateResponse(response: NextResponse) {
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) {
    response.headers.set(name, value)
  }
  response.headers.delete('ETag')
  return response
}

export async function POST(request: NextRequest) {
  const csrfResponse = checkCsrf(request)
  if (csrfResponse) return privateResponse(csrfResponse)

  const session = await auth()
  if (!session?.user?.id) return json({ error: 'Non authentifie' }, 401)

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'sessions-revoke',
    identity: session.user.id,
  })
  if (blocked) return privateResponse(blocked)

  try {
    await revokeAllUserSessions(session.user.id)
    return json({ success: true }, 200)
  } catch {
    return json({ error: 'Service temporairement indisponible' }, 503)
  }
}

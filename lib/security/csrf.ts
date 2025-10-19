import crypto from 'crypto'
import { cookies } from 'next/headers'

const CSRF_COOKIE = 'csrf-token'

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function setCsrfCookie(token: string, secure: boolean) {
  const c = cookies()
  // Double submit cookie must be readable by JS (HttpOnly: false)
  c.set(CSRF_COOKIE, token, {
    path: '/',
    httpOnly: false,
    sameSite: 'strict',
    secure,
    maxAge: 60 * 60 // 1h
  })
}

export function getCsrfFromCookies(): string | null {
  const c = cookies()
  const v = c.get(CSRF_COOKIE)
  return v?.value || null
}

export function extractIp(req: Request): string | null {
  const h = (name: string) => req.headers.get(name)
  const xff = h('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h('x-real-ip') || null
}

export function verifyCsrf(req: Request): boolean {
  // En production seulement pour ne pas casser le dev avant intégration front
  if (process.env.NODE_ENV !== 'production') return true

  const headerToken = req.headers.get('x-csrf-token') || ''
  const cookieToken = getCsrfFromCookies() || ''
  if (!headerToken || !cookieToken) return false

  try {
    const a = Buffer.from(headerToken, 'utf8')
    const b = Buffer.from(cookieToken, 'utf8')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

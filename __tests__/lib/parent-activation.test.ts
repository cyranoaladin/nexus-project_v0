import { NextResponse } from 'next/server'

import {
  buildParentActivationEmail,
  buildTrustedActivationUrl,
  createParentActivationToken,
  isAccountActivationRequired,
  normalizeParentEmail,
  withActivationSecurityHeaders,
} from '@/lib/auth/parent-activation'

describe('parent activation security primitives', () => {
  const previousNextAuthUrl = process.env.NEXTAUTH_URL

  afterEach(() => {
    if (previousNextAuthUrl === undefined) {
      delete process.env.NEXTAUTH_URL
    } else {
      process.env.NEXTAUTH_URL = previousNextAuthUrl
    }
  })

  it('normalizes the address without changing its local-part semantics', () => {
    expect(normalizeParentEmail('  Parent.Test+P0D@Example.TEST  ')).toBe(
      'parent.test+p0d@example.test'
    )
  })

  it('creates a long random token and exposes only its SHA-256 digest for storage', () => {
    const first = createParentActivationToken()
    const second = createParentActivationToken()

    expect(first.rawToken).not.toBe(second.rawToken)
    expect(first.rawToken.length).toBeGreaterThanOrEqual(43)
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(first.tokenHash).not.toContain(first.rawToken)
    expect(first.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('builds activation links only from the configured trusted origin', () => {
    process.env.NEXTAUTH_URL = 'https://nexus.test'

    const url = buildTrustedActivationUrl('recognizable-raw-token')

    expect(url.origin).toBe('https://nexus.test')
    expect(url.pathname).toBe('/auth/activate')
    expect(url.searchParams.get('token')).toBe('recognizable-raw-token')
    expect(url.searchParams.get('purpose')).toBe('parent')
    expect(url.href).not.toContain('attacker.example')
  })

  it('rejects a non-HTTPS configured origin outside local tests', () => {
    process.env.NEXTAUTH_URL = 'http://attacker.example'

    expect(() => buildTrustedActivationUrl('recognizable-raw-token')).toThrow(
      'PARENT_ACTIVATION_ORIGIN_INVALID'
    )
  })

  it('trusts the docker-compose e2e hostname alongside localhost -- fixed value, never a real prod NEXTAUTH_URL', () => {
    process.env.NEXTAUTH_URL = 'http://app-e2e:3000'

    const url = buildTrustedActivationUrl('recognizable-raw-token')

    expect(url.origin).toBe('http://app-e2e:3000')
  })

  it('rejects activation-link construction when no trusted origin is configured', () => {
    delete process.env.NEXTAUTH_URL

    expect(() => buildTrustedActivationUrl('recognizable-raw-token')).toThrow(
      'PARENT_ACTIVATION_ORIGIN_INVALID'
    )
  })

  it('escapes user-controlled names and provides text and HTML alternatives', () => {
    process.env.NEXTAUTH_URL = 'https://nexus.test'

    const email = buildParentActivationEmail({
      parentName: '<img src=x onerror=alert(1)>',
      childFirstName: 'Lina\r\nBcc: victim@example.test',
      rawToken: 'recognizable-raw-token',
    })

    expect(email.subject).not.toMatch(/[\r\n]/)
    expect(email.html).not.toContain('<img src=x')
    expect(email.html).not.toContain('onerror=')
    expect(email.html).not.toContain('Bcc:')
    expect(email.text).not.toContain('Bcc:')
    expect(email.text).not.toMatch(/mot de passe temporaire/i)
    expect(email.html).toContain('https://nexus.test/auth/activate')
  })

  it('keeps a script tag out even from nested/malformed input a single tag-shaped regex pass would miss', () => {
    process.env.NEXTAUTH_URL = 'https://nexus.test'

    const email = buildParentActivationEmail({
      parentName: '<scr<script>ipt>alert(1)</script>',
      childFirstName: 'Lina',
      rawToken: 'recognizable-raw-token',
    })

    expect(email.html.toLowerCase()).not.toMatch(/<script/)
    expect(email.html).toContain('https://nexus.test/auth/activate')
  })

  it('applies non-cache and no-referrer headers to success and error responses', () => {
    for (const status of [200, 400, 401, 404, 429, 500]) {
      const response = withActivationSecurityHeaders(
        NextResponse.json({ success: status < 400 }, { status })
      )

      expect(response.headers.get('Cache-Control')).toContain('private')
      expect(response.headers.get('Cache-Control')).toContain('no-store')
      expect(response.headers.get('Cache-Control')).toContain('max-age=0')
      expect(response.headers.get('Pragma')).toBe('no-cache')
      expect(response.headers.get('Expires')).toBe('0')
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    }
  })

  it('requires activation for Parent and Eleve accounts only while pending', () => {
    expect(isAccountActivationRequired('PARENT', null)).toBe(true)
    expect(isAccountActivationRequired('ELEVE', null)).toBe(true)
    expect(isAccountActivationRequired('COACH', null)).toBe(false)
    expect(isAccountActivationRequired('PARENT', new Date())).toBe(false)
  })
})

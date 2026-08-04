import fs from 'fs'
import path from 'path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Parent email activation architecture boundary', () => {
  it('uses the centralized mailer and never the legacy welcome-email transport', () => {
    const route = read('app/api/bilan-gratuit/route.ts')
    const activation = read('lib/auth/parent-activation.ts')

    expect(route).toContain("from '@/lib/auth/parent-activation'")
    expect(route).not.toContain("import('@/lib/email')")
    expect(activation).toContain("from '@/lib/email/mailer'")
  })

  it('never derives activation links from client-controlled forwarding headers', () => {
    const files = [
      read('app/api/bilan-gratuit/route.ts'),
      read('app/api/auth/resend-activation/route.ts'),
      read('lib/auth/parent-activation.ts'),
    ].join('\n')

    expect(files).not.toMatch(/headers\.get\(['"](?:host|origin|referer|x-forwarded-host|x-forwarded-proto)/i)
    expect(files).not.toContain('request.headers.get')
  })

  it('applies no-store and no-referrer at the Next.js boundary', () => {
    const config = read('next.config.mjs')
    for (const route of [
      '/api/bilan-gratuit',
      '/api/auth/resend-activation',
      '/api/auth/activate',
      '/api/student/activate',
      '/auth/activate',
    ]) {
      expect(config).toContain(route)
    }
    expect(config).toContain("value: 'no-referrer'")
  })

  it('keeps the student route as a thin role-bound adapter over the canonical controller', () => {
    const canonical = read('app/api/auth/activate/route.ts')
    const student = read('app/api/student/activate/route.ts')
    const token = read('lib/auth/activation-token.ts')
    const service = read('lib/services/student-activation.service.ts')

    expect(canonical).toContain("from '@/lib/auth/activation-controller'")
    expect(student).toContain("handleActivationPost(request, 'student')")
    expect(student).not.toContain('completeStudentActivation(')
    expect(token).toContain("randomBytes(32)")
    expect(token).toContain("createHash('sha256')")
    expect(service).not.toContain("createHash('sha256')")
    expect(service).not.toContain('randomBytes(')
  })
})

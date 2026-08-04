import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const ROOT = process.cwd()

const SENSITIVE_CONTROLLERS = [
  'auth.ts',
  'lib/auth/activation-controller.ts',
  'app/api/auth/resend-activation/route.ts',
  'app/api/auth/reset-password/route.ts',
  'app/api/auth/sessions/revoke/route.ts',
  'app/api/bilan-gratuit/route.ts',
  'app/api/parent/children/route.ts',
  'app/api/parent/children/[studentId]/activation/route.ts',
  'app/api/admin/test-email/route.ts',
  'app/api/contact/route.ts',
  'app/api/newsletter/route.ts',
  'app/api/stages/[stageSlug]/inscrire/route.ts',
  'app/api/assessments/submit/route.ts',
  'app/api/reservation/route.ts',
  'app/api/notify/email/route.ts',
  'app/api/assistante/quotes/pdf/route.ts',
  'app/api/bilan-pallier2-maths/route.ts',
  'app/api/admin/directeur/stats/route.ts',
  'app/api/admin/recompute-ssn/route.ts',
  'app/api/sessions/book/route.ts',
  'app/api/sessions/cancel/route.ts',
  'app/api/admin/users/route.ts',
  'app/api/student/credits/route.ts',
  'app/api/student/sessions/route.ts',
] as const

function source(path: string) {
  return readFileSync(join(ROOT, path), 'utf8')
}

describe('S3 distributed rate-limit architecture boundary', () => {
  test.each(SENSITIVE_CONTROLLERS)('%s uses the central sensitive guard', (path) => {
    expect(source(path)).toContain('guardSensitiveRateLimit')
  })

  test('no production route calls the synchronous memory-only guard', () => {
    const { spawnSync } = jest.requireActual<typeof import('node:child_process')>('node:child_process')
    const result = spawnSync('rg', [
      '-l',
      '--glob', 'route.ts',
      String.raw`\b(guardRateLimit|checkRateLimit)\s*\(`,
      'app/api',
    ], { cwd: ROOT, encoding: 'utf8' })
    expect([0, 1]).toContain(result.status)
    expect(result.stdout.trim()).toBe('')
  })

  test('production routes use neither the legacy facade nor direct generic guards', () => {
    const files = execFileSync('rg', ['--files', 'app/api', '-g', 'route.ts'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split('\n').filter(Boolean)
    const violations = files.filter((path) => {
      const content = source(path)
      return content.includes('@/lib/middleware/rateLimit')
        || /\bguardRateLimitAsync\s*\(/.test(content)
        || /\bcheckRateLimitAsync\s*\(/.test(content)
    })
    expect(violations).toEqual([])
  })

  test('every asynchronous rate-limit decision is awaited or returned', () => {
    const files = execFileSync('rg', ['--files', 'app', 'lib', '-g', '*.ts', '-g', '*.tsx'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split('\n').filter(Boolean)
    const asyncNames = new Set(['guardRateLimitAsync', 'guardSensitiveRateLimit', 'checkRateLimitAsync'])
    const violations: string[] = []

    for (const path of files) {
      const file = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && asyncNames.has(node.expression.text)) {
          const parent = node.parent
          if (!ts.isAwaitExpression(parent) && !ts.isReturnStatement(parent)) {
            const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1
            violations.push(`${path}:${line}:${node.expression.text}`)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(file)
    }
    expect(violations).toEqual([])
  })

  test('Redis is the only production distributed adapter', () => {
    const productionSources = [
      source('lib/rate-limit/index.ts'),
      source('lib/rate-limit/runtime.ts'),
      source('lib/env-validation.ts'),
      source('docker-compose.prod.yml'),
    ].join('\n')
    expect(productionSources).not.toMatch(/upstash/i)
    expect(productionSources).toContain("RATE_LIMIT_BACKEND")
  })

  test('production source never embeds Mailpit, raw PII keys or a memory fallback', () => {
    const rateLimitSource = [
      source('lib/rate-limit/index.ts'),
      source('lib/rate-limit/runtime.ts'),
      source('lib/rate-limit/keys.ts'),
      source('lib/rate-limit/sensitive.ts'),
    ].join('\n')
    expect(rateLimitSource).not.toMatch(/mailpit|createHash\(['"]sha256|falls? back to memory/i)
    expect(rateLimitSource).toContain('RATE_LIMIT_PRODUCTION_MEMORY_REFUSED')
  })
})

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
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
  'app/api/student/sessions/route.ts',
] as const

function source(path: string) {
  return readFileSync(join(ROOT, path), 'utf8')
}

// Pure Node.js recursive file listing -- this test previously shelled out to
// `rg` via spawnSync/execFileSync. That was the one thing distinguishing it
// from every other purely in-process test in this suite, and was the prime
// suspect for a jest-worker crash ("Converting circular structure to JSON"
// at jest-worker's messageParent) that reproduced 100% of the time in CI
// (maxWorkers=2, --coverage, 700+ suites) and 0% of the time locally under
// the identical command -- consistent with a subprocess-spawn interaction
// under CI's resource constraints, not a defect in this test's own logic.
// Removing the subprocess entirely removes the suspect mechanism outright.
function listFiles(dir: string, matchesName: (name: string) => boolean): string[] {
  const results: string[] = []
  // Mirrors the generated/build-artifact directory names in .gitignore that
  // could plausibly appear under app/ or lib/ -- rg (used here previously)
  // honored .gitignore by default; this walker doesn't parse it, but
  // excluding these directory names by hand keeps the same practical
  // exclusion for the realistic case (a stray build/coverage output) even
  // though there's no such directory under app/lib today.
  const skip = new Set(['node_modules', '.next', '.git', '.claude', 'coverage', '.nyc_output', 'dist', 'build', 'out', '.turbo'])
  const walk = (current: string) => {
    for (const entry of readdirSync(join(ROOT, current), { withFileTypes: true })) {
      if (skip.has(entry.name)) continue
      const relative = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(relative)
      } else if (matchesName(entry.name)) {
        results.push(relative)
      }
    }
  }
  walk(dir)
  return results
}

const isRouteFile = (name: string) => name === 'route.ts'
const isTsFile = (name: string) => name.endsWith('.ts') || name.endsWith('.tsx')

describe('S3 distributed rate-limit architecture boundary', () => {
  test.each(SENSITIVE_CONTROLLERS)('%s uses the central sensitive guard', (path) => {
    expect(source(path)).toContain('guardSensitiveRateLimit')
  })

  test('no production route calls the synchronous memory-only guard', () => {
    const pattern = /\b(guardRateLimit|checkRateLimit)\s*\(/
    const violations = listFiles('app/api', isRouteFile).filter((path) => pattern.test(source(path)))
    expect(violations).toEqual([])
  })

  test('production routes use neither the legacy facade nor direct generic guards', () => {
    const files = listFiles('app/api', isRouteFile)
    const violations = files.filter((path) => {
      const content = source(path)
      return content.includes('@/lib/middleware/rateLimit')
        || /\bguardRateLimitAsync\s*\(/.test(content)
        || /\bcheckRateLimitAsync\s*\(/.test(content)
    })
    expect(violations).toEqual([])
  })

  test('every asynchronous rate-limit decision is awaited or returned', () => {
    const files = [...listFiles('app', isTsFile), ...listFiles('lib', isTsFile)]
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

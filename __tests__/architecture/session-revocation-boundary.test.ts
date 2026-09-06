import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

function sourceFiles(directory: string): string[] {
  return readdirSync(resolve(process.cwd(), directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(relative)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relative] : []
  })
}

describe('JWT session revocation architecture boundary', () => {
  it('keeps Prisma out of the Edge middleware configuration', () => {
    const edgeConfig = read('auth.config.ts') + read('middleware.ts')
    expect(edgeConfig).not.toContain("from '@/lib/prisma'")
    expect(edgeConfig).not.toContain('prisma.user')
    expect(read('middleware.ts')).toContain("finalResponse.headers.delete('set-cookie')")
  })

  it('validates every Node session through the canonical token validator', () => {
    const auth = read('auth.ts')
    expect(auth).toContain("from '@/lib/auth/session-revocation'")
    expect(auth).toContain('validateSessionToken')
    expect(auth).toContain('issueSessionToken')
    expect(read('lib/auth/session-claims.ts')).toContain('sessionVersion')
  })

  it('guards the shared dashboard layout after the coarse Edge check', () => {
    const layout = read('app/dashboard/layout.tsx')
    expect(layout).toContain("from '@/auth'")
    expect(layout).toContain('await auth()')
    expect(layout).toContain('<Sidebar user={session.user} />')
    expect(layout).toContain('<Navbar user={session.user} />')
    expect(read('components/navigation/Sidebar.tsx')).not.toContain('await auth()')
    expect(read('components/navigation/Navbar.tsx')).not.toContain('await auth()')
  })

  it('validates non-dashboard admin pages and auth redirects in Node', () => {
    expect(read('app/admin/directeur/layout.tsx')).toContain('await auth()')
    expect(read('app/auth/signin/page.tsx')).toContain('await auth()')
    expect(read('auth.config.ts')).not.toContain('isLoggedIn && isOnAuth')
    expect(read('middleware.ts')).not.toContain("isLoggedIn && pathname.startsWith('/auth')")
  })

  it('logs out through the Auth.js API outside the Edge middleware', () => {
    const button = read('components/navigation/LogoutButton.tsx')
    expect(button).toContain("from 'next-auth/react'")
    expect(button).not.toContain('logout-action')
    expect(existsSync(resolve(process.cwd(), 'lib/auth/logout-action.ts'))).toBe(false)
  })

  it('keeps private responses out of browser and intermediary caches', () => {
    const config = read('next.config.mjs')
    expect(config).toContain("value: 'private, no-store, max-age=0, must-revalidate'")
    expect(config).toContain("{ key: 'Pragma', value: 'no-cache' }")
    expect(config).toContain("{ key: 'Expires', value: '0' }")
  })

  it('funnels canonical API guards through the validated Node auth export', () => {
    expect(read('lib/guards.ts')).toContain("import { auth } from '@/auth'")
    expect(read('lib/bilans/api/parent-reports.ts')).toContain("import { auth } from '@/auth'")
    expect(read('lib/bilans/api/legacy-parent-pdf.ts')).toContain("import { auth } from '@/auth'")
  })

  it('forbids protected code from decoding or validating JWTs outside the canonical server primitive', () => {
    const files = [...sourceFiles('app'), ...sourceFiles('lib')]
    const legacyBypasses = files.filter((file) =>
      /getServerSession\s*\(|getToken\s*\(|from ['"]@\/auth\.config['"]/.test(read(file))
    )
    const directJwtImports = files.filter((file) =>
      /from ['"]next-auth\/jwt['"]/.test(read(file))
    ).sort()

    expect(legacyBypasses).toEqual([])
    expect(directJwtImports).toEqual([
      'lib/auth/session-claims.ts',
      'lib/auth/session-revocation.ts',
    ])
  })

  it('provides one explicit authenticated revocation controller', () => {
    expect(existsSync(resolve(process.cwd(), 'app/api/auth/sessions/revoke/route.ts'))).toBe(true)
    const route = read('app/api/auth/sessions/revoke/route.ts')
    expect(route).toContain('revokeAllUserSessions')
    expect(route).toContain('await auth()')
  })

  it.each([
    'app/api/auth/reset-password/route.ts',
    'app/api/admin/users/route.ts',
    'app/api/assistante/coaches/manage/[id]/route.ts',
    'lib/services/student-activation.service.ts',
    'lib/families/create-family.ts',
    'scripts/create-stmg-students.ts',
  ])('revokes sessions in the same mutation boundary: %s', (file) => {
    expect(read(file)).toContain('sessionVersion')
  })
})

describe('exhaustive User security mutation inventory', () => {
  it('classifies every production User mutation and versions every sensitive update', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const ts = await import('typescript')
    const root = process.cwd()
    const roots = ['app', 'lib', 'prisma', 'scripts']
    const mutationMethods = new Set(['update', 'updateMany', 'upsert', 'delete', 'deleteMany'])
    const files: string[] = []

    const visitDirectory = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (['node_modules', '.next', 'migrations', '__tests__'].includes(entry.name)) continue
        const absolute = path.join(directory, entry.name)
        if (entry.isDirectory()) visitDirectory(absolute)
        else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(absolute)
      }
    }
    for (const relativeRoot of roots) visitDirectory(path.join(root, relativeRoot))
    files.sort()

    const descriptors: string[] = []
    const callText = new Map<string, string>()
    const createCalls: string[] = []

    for (const absolute of files) {
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      const sourceText = fs.readFileSync(absolute, 'utf8')
      const source = ts.createSourceFile(
        absolute,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        absolute.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      )
      const ordinals = new Map<string, number>()
      const walk = (node: import('typescript').Node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const method = node.expression.name.text
          const owner = node.expression.expression
          if (ts.isPropertyAccessExpression(owner) && owner.name.text === 'user') {
            if (method === 'create') createCalls.push(node.getText(source))
            if (mutationMethods.has(method)) {
              const ordinal = (ordinals.get(method) ?? 0) + 1
              ordinals.set(method, ordinal)
              const descriptor = `${relative}:${method}#${ordinal}`
              descriptors.push(descriptor)
              callText.set(descriptor, node.getText(source))
            }
          }
        }
        ts.forEachChild(node, walk)
      }
      walk(source)

      expect(sourceText).not.toMatch(/(?:executeRaw|queryRaw)[\s\S]{0,300}\bUPDATE\s+["']?(?:users|User)\b/i)
    }

    const approved = [
      'app/api/admin/users/route.ts:delete#1',
      'app/api/admin/users/route.ts:update#1',
      'app/api/assistante/coaches/manage/[id]/route.ts:delete#1',
      'app/api/assistante/coaches/manage/[id]/route.ts:update#1',
      'app/api/auth/resend-activation/route.ts:updateMany#1',
      'app/api/auth/reset-password/route.ts:update#1',
      'app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts:update#1',
      // Phone reservation/release writes do not grant access; consuming proof changes credentials.
      ...Array.from({ length: 4 }, (_, i) => `lib/auth/parent-phone.ts:updateMany#${i + 1}`),
      // RGPD erasure clears credentials and revokes sessions in the phone-carrier transaction.
      'lib/rgpd/parent-phone-anonymisation.ts:updateMany#1',
      // Registration updates display names and completion date only.
      'lib/families/parent-registration.ts:updateMany#1',
      'lib/auth/pending-account-lifecycle.ts:delete#1',
      'lib/auth/pending-account-lifecycle.ts:deleteMany#1',
      'lib/auth/pending-account-lifecycle.ts:updateMany#1',
      'lib/auth/session-revocation.ts:update#1',
      'lib/bilans/family-landing/access.ts:update#1',
      ...Array.from({ length: 4 }, (_, i) => `lib/families/create-family.ts:update#${i + 1}`),
      'lib/bilans/staff/parent-contact-service.ts:update#1',
      'lib/bilans/staff/parent-contact-service.ts:update#2',
      'lib/bilans/staff/parent-contact-service.ts:update#3',
      'lib/services/student-activation.service.ts:update#1',
      'lib/services/student-activation.service.ts:update#2',
      'lib/services/student-activation.service.ts:updateMany#1',
      'lib/services/student-activation.service.ts:updateMany#2',
      ...Array.from({ length: 3 }, (_, index) => `prisma/seed-demo-student.ts:upsert#${index + 1}`),
      'prisma/seed.ts:updateMany#1',
      ...Array.from({ length: 12 }, (_, index) => `prisma/seed.ts:upsert#${index + 1}`),
      ...Array.from({ length: 8 }, (_, index) => `scripts/create-audit-profiles.ts:upsert#${index + 1}`),
      'scripts/create-stmg-students.ts:update#1',
      'scripts/mega-e2e-validation.ts:delete#1',
      'scripts/mega-e2e-validation.ts:delete#2',
      'scripts/seed-e2e-db.ts:upsert#1',
      'scripts/seed-nsi-pratique-students.ts:upsert#1',
      'scripts/seed-parent-dashboard-e2e.ts:deleteMany#1',
      'scripts/seed-parent-dashboard-e2e.ts:upsert#1',
      ...Array.from({ length: 7 }, (_, index) => `scripts/seed-qa-profiles.ts:upsert#${index + 1}`),
      'scripts/test-performance.ts:upsert#1',
    ].sort()

    expect(descriptors.sort()).toEqual(approved)

    const pendingLifecycle = read('lib/auth/pending-account-lifecycle.ts')
    expect(pendingLifecycle).toContain("plan.action === 'INVALIDATE_EXPIRED_TOKEN'")
    expect(pendingLifecycle).toContain("plan.action === 'PURGE_GRAPH'")
    expect(pendingLifecycle).toContain('validatePlanAgainstGraph')
    expect(pendingLifecycle).toContain('password: null')
    expect(pendingLifecycle).toContain('activatedAt: null')
    expect(pendingLifecycle).toContain('client.$transaction')

    const versioned = [
      'lib/rgpd/parent-phone-anonymisation.ts:updateMany#1',
      'lib/auth/parent-phone.ts:updateMany#2',
      'app/api/admin/users/route.ts:update#1',
      'app/api/assistante/coaches/manage/[id]/route.ts:update#1',
      'app/api/auth/reset-password/route.ts:update#1',
      'lib/auth/session-revocation.ts:update#1',
      'lib/bilans/family-landing/access.ts:update#1',
      'lib/families/create-family.ts:update#2',
      'lib/bilans/staff/parent-contact-service.ts:update#1',
      'lib/bilans/staff/parent-contact-service.ts:update#2',
      'lib/bilans/staff/parent-contact-service.ts:update#3',
      'lib/services/student-activation.service.ts:update#1',
      'lib/services/student-activation.service.ts:update#2',
      'lib/services/student-activation.service.ts:updateMany#1',
      'lib/services/student-activation.service.ts:updateMany#2',
      ...Array.from({ length: 3 }, (_, index) => `prisma/seed-demo-student.ts:upsert#${index + 1}`),
      'prisma/seed.ts:updateMany#1',
      ...Array.from({ length: 9 }, (_, index) => `prisma/seed.ts:upsert#${index + 1}`),
      ...Array.from({ length: 8 }, (_, index) => `scripts/create-audit-profiles.ts:upsert#${index + 1}`),
      'scripts/create-stmg-students.ts:update#1',
      'scripts/seed-nsi-pratique-students.ts:upsert#1',
      ...Array.from({ length: 7 }, (_, index) => `scripts/seed-qa-profiles.ts:upsert#${index + 1}`),
    ]
    for (const descriptor of versioned) {
      expect(callText.get(descriptor)).toMatch(/sessionVersion\s*:[\s\S]{0,120}\{\s*increment\s*:\s*1\s*\}/)
    }
    for (const createCall of createCalls) {
      expect(createCall).not.toMatch(/sessionVersion\s*:\s*\{\s*increment/)
    }
  })

  it('keeps legacy family entry points mutation-free and delegates identity changes', () => {
    for (const path of ['app/api/assistante/students/route.ts', 'app/api/assistante/families/route.ts', 'lib/bilans/saisie-papier/famille.ts']) {
      const source = read(path)
      expect(source).toContain("@/lib/families/create-family")
      expect(source).not.toMatch(/\.user\.(?:create|update|upsert|delete)/)
    }
  })

  it('keeps the session revoke controller same-origin, current-user-only and private', async () => {
    const fs = await import('node:fs')
    const source = fs.readFileSync('app/api/auth/sessions/revoke/route.ts', 'utf8')
    expect(source).toMatch(/export async function POST\(request: NextRequest\)/)
    expect(source).toMatch(/checkCsrf\(request\)/)
    expect(source).toMatch(/revokeAllUserSessions\(session\.user\.id\)/)
    expect(source).not.toMatch(/request\.(?:json|text|formData)\(/)
    expect(source).toContain("'Cache-Control': 'private, no-store, max-age=0'")
    expect(source).not.toMatch(/export async function (?:GET|PUT|PATCH|DELETE)/)
  })
})

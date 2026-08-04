import fs from 'node:fs'
import path from 'node:path'

describe('active Parent seed boundary', () => {
  it('never seeds the dashboard Parent with a password but without activation', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/seed-parent-dashboard-e2e.ts'),
      'utf8',
    )
    const parentBlock = source.slice(
      source.indexOf('const parentUser ='),
      source.indexOf('const parentProfile ='),
    )
    expect(parentBlock).toContain('password: hashedPassword')
    expect(parentBlock).toContain('role: UserRole.PARENT')
    expect(parentBlock).toContain('activatedAt:')
  })
})

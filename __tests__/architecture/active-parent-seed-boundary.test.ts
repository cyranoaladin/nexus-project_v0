import fs from 'node:fs'
import path from 'node:path'

describe('active Parent seed boundary', () => {
  it.each([
    {
      file: 'scripts/seed-parent-dashboard-e2e.ts',
      start: 'const parentUser =',
      end: 'const parentProfile =',
    },
    {
      file: 'scripts/seed-e2e-db.ts',
      start: 'const parent = await prisma.user.create',
      end: 'const student = await prisma.user.create',
    },
  ])('never seeds an active Parent with a password but without activation in $file', ({ file, start, end }) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
    const parentBlock = source.slice(source.indexOf(start), source.indexOf(end))
    expect(parentBlock).toContain('password: hashedPassword')
    expect(parentBlock).toContain('role: UserRole.PARENT')
    expect(parentBlock).toContain('activatedAt:')
  })
})

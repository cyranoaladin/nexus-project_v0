import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

function writeRoute(root: string, routeFile: string, source: string) {
  const fullPath = join(root, routeFile);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, source);
}

function inventoryRows(markdown: string) {
  const rows = new Map<string, { risk: string; methods: string }>();
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| `app/api/') || !line.includes('/route.ts` |')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    rows.set(cells[0].replace(/`/g, ''), {
      methods: cells[1],
      risk: cells[8],
    });
  }
  return rows;
}

function runAuditOnFixtures(fixtures: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'nexus-audit-fixtures-'));
  try {
    mkdirSync(join(root, 'docs/security'), { recursive: true });
    for (const [routeFile, source] of Object.entries(fixtures)) {
      writeRoute(root, routeFile, source);
    }

    execFileSync(process.execPath, [join(process.cwd(), 'scripts/security/audit-api-guards.mjs')], {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: 'pipe',
    });

    return inventoryRows(readFileSync(join(root, 'docs/security/API_GUARD_INVENTORY.md'), 'utf8'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('audit-api-guards route classification', () => {
  it('keeps dynamic sensitive routes without ownership at P0', () => {
    const rows = runAuditOnFixtures({
      'app/api/documents/[id]/route.ts': `
        import { auth } from '@/auth';
        export async function GET() {
          const session = await auth();
          if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
          return Response.json({ ok: true });
        }
      `,
    });

    expect(rows.get('app/api/documents/[id]/route.ts')).toEqual(expect.objectContaining({ risk: 'P0' }));
  });

  it('does not treat comment-only rate limit mentions as a public route control', () => {
    const rows = runAuditOnFixtures({
      'app/api/assessments/comment-only/route.ts': `
        import { z } from 'zod';
        const schema = z.object({ email: z.string().email() });
        export async function POST(request: Request) {
          // TODO: add rateLimit before launch.
          schema.parse(await request.json());
          return Response.json({ ok: true });
        }
      `,
    });

    expect(rows.get('app/api/assessments/comment-only/route.ts')).toEqual(expect.objectContaining({ risk: 'P0' }));
  });

  it('classifies public sensitive routes as P0 even with Zod and rate limit (validation ≠ authorization)', () => {
    const rows = runAuditOnFixtures({
      'app/api/assessments/submit/route.ts': `
        import { z } from 'zod';
        import { guardRateLimitAsync } from '@/lib/rate-limit';
        const schema = z.object({ email: z.string().email() });
        export async function POST(request: Request) {
          const blocked = await guardRateLimitAsync(request, { preset: 'api' });
          if (blocked) return blocked;
          schema.parse(await request.json());
          return Response.json({ ok: true });
        }
      `,
    });

    expect(rows.get('app/api/assessments/submit/route.ts')).toEqual(expect.objectContaining({ risk: 'P0' }));
  });

  it('does not promote disabled ClicToPay webhook beyond P1', () => {
    const rows = runAuditOnFixtures({
      'app/api/payments/clictopay/webhook/route.ts': `
        export async function POST() {
          return Response.json({ code: 'CLICTOPAY_NOT_CONFIGURED' }, { status: 501 });
        }
      `,
    });

    expect(rows.get('app/api/payments/clictopay/webhook/route.ts')).toEqual(expect.objectContaining({ risk: 'P1' }));
  });

  it('keeps fixed public documents at P2, not OK', () => {
    const rows = runAuditOnFixtures({
      'app/api/public-documents/corrige/route.ts': `
        const FILE_NAME = 'corrige.pdf';
        export async function GET() {
          return new Response(FILE_NAME);
        }
      `,
    });

    expect(rows.get('app/api/public-documents/corrige/route.ts')).toEqual(expect.objectContaining({ risk: 'P2' }));
  });

  it('follows route reexports before classifying guards', () => {
    const rows = runAuditOnFixtures({
      'app/api/coach/reexport/[studentId]/route.ts': `
        export { POST } from './handler';
      `,
      'app/api/coach/reexport/[studentId]/handler.ts': `
        import { requireRole } from '@/lib/guards';
        import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
        export async function POST() {
          const session = await requireRole('COACH');
          await assertCoachCanAccessStudent({ coachUserId: session.user.id, studentId: 'student-1' });
          return Response.json({ ok: true });
        }
      `,
    });

    expect(rows.get('app/api/coach/reexport/[studentId]/route.ts')?.methods).toBe('POST');
    expect(rows.get('app/api/coach/reexport/[studentId]/route.ts')?.risk).not.toBe('P0');
    expect(rows.get('app/api/coach/reexport/[studentId]/route.ts')?.risk).not.toBe('OK');
  });

  it('keeps staff-only sensitive mutations out of P0 but not OK', () => {
    const rows = runAuditOnFixtures({
      'app/api/admin/documents/route.ts': `
        import { requireAnyRole } from '@/lib/guards';
        export async function POST() {
          await requireAnyRole(['ADMIN', 'ASSISTANTE']);
          return Response.json({ ok: true });
        }
      `,
    });

    expect(rows.get('app/api/admin/documents/route.ts')?.risk).not.toBe('P0');
    expect(rows.get('app/api/admin/documents/route.ts')?.risk).not.toBe('OK');
  });

  it('detects staff roles regardless of order (ASSISTANTE, ADMIN)', () => {
    const rows = runAuditOnFixtures({
      'app/api/assistante/billing/route.ts': `
        import { requireAnyRole } from '@/lib/guards';
        export async function POST() {
          await requireAnyRole(['ASSISTANTE', 'ADMIN']);
          return Response.json({ ok: true });
        }
      `,
    });

    expect(rows.get('app/api/assistante/billing/route.ts')?.risk).not.toBe('P0');
  });

  it('resolves re-exports from index.ts barrel files', () => {
    const rows = runAuditOnFixtures({
      'app/api/coach/barrel/[studentId]/route.ts': `
        export { GET } from './handlers';
      `,
      'app/api/coach/barrel/[studentId]/handlers/index.ts': `
        import { requireRole } from '@/lib/guards';
        import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
        export async function GET() {
          const session = await requireRole('COACH');
          await assertCoachCanAccessStudent({ coachUserId: session.user.id, studentId: 'student-1' });
          return Response.json({ ok: true });
        }
      `,
    });

    expect(rows.get('app/api/coach/barrel/[studentId]/route.ts')?.risk).not.toBe('P0');
  });
});

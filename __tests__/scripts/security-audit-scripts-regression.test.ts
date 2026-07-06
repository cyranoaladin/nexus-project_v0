import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

const ROOT = process.cwd();
const API_ROOT = join(ROOT, 'app/api');
const INVENTORY_PATH = join(ROOT, 'docs/security/API_GUARD_INVENTORY.md');
const MATRIX_PATH = join(ROOT, 'docs/go-live/api-security-matrix.full.md');

const EXPECTED_P1_ROUTES = new Set([
  '/api/payments/clictopay/webhook',
  '/api/assessments/submit',
  '/api/bilan-gratuit',
  '/api/lamis/teacher-report',
  '/api/stages/[stageSlug]/inscrire',
  '/api/student/activate',
]);

function walkRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkRouteFiles(fullPath));
    } else if (entry === 'route.ts') {
      files.push(relative(ROOT, fullPath));
    }
  }
  return files;
}

function parseInventoryRows(markdown: string) {
  const rows = new Map<string, { risk: string }>();
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| `app/api/') || !line.includes('/route.ts` |')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    rows.set(cells[0].replace(/`/g, ''), { risk: cells[8] });
  }
  return rows;
}

function writeRoute(root: string, routeFile: string, source: string) {
  const fullPath = join(root, routeFile);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, source);
}

function runAuditOnFixtures(fixtures: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'nexus-rc-audit-fixtures-'));
  try {
    mkdirSync(join(root, 'docs/security'), { recursive: true });
    for (const [routeFile, source] of Object.entries(fixtures)) {
      writeRoute(root, routeFile, source);
    }

    execFileSync(process.execPath, [join(ROOT, 'scripts/security/audit-api-guards.mjs')], {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: 'pipe',
    });

    return parseInventoryRows(readFileSync(join(root, 'docs/security/API_GUARD_INVENTORY.md'), 'utf8'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function parseMatrixRows(markdown: string) {
  const rows = new Map<string, { priority: string }>();
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| P') && !line.startsWith('| OK')) continue;
    if (!line.includes('| `/api/')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    rows.set(cells[1].replace(/`/g, ''), { priority: cells[0] });
  }
  return rows;
}

describe('security audit scripts RC regression guards', () => {
  it('keeps the generated inventory route count aligned with app/api route files', () => {
    const routeFiles = walkRouteFiles(API_ROOT);
    const inventoryRows = parseInventoryRows(readFileSync(INVENTORY_PATH, 'utf8'));

    expect(inventoryRows.size).toBe(routeFiles.length);
    expect(routeFiles.length).toBe(178);
  });

  it('keeps the six explicit release-candidate P1 routes visible in the inventory and matrix', () => {
    const inventoryRows = parseInventoryRows(readFileSync(INVENTORY_PATH, 'utf8'));
    const matrixRows = parseMatrixRows(readFileSync(MATRIX_PATH, 'utf8'));

    const actualP1Routes = [...matrixRows.entries()]
      .filter(([, row]) => row.priority === 'P1')
      .map(([route]) => route)
      .sort();

    expect(new Set(actualP1Routes)).toEqual(EXPECTED_P1_ROUTES);

    for (const route of EXPECTED_P1_ROUTES) {
      const routeFile = `app${route}/route.ts`;
      expect(inventoryRows.get(routeFile)?.risk).toBe('P1');
      expect(matrixRows.get(route)?.priority).toBe('P1');
    }
  });

  it('does not mark public sensitive P1 surfaces as OK in the generated matrix', () => {
    const matrixRows = parseMatrixRows(readFileSync(MATRIX_PATH, 'utf8'));

    for (const route of EXPECTED_P1_ROUTES) {
      expect(matrixRows.get(route)?.priority).not.toBe('OK');
      expect(matrixRows.get(route)?.priority).not.toBe('P2');
    }
  });

  it('keeps public sensitive mutations with Zod and rate limit at P1', () => {
    const rows = runAuditOnFixtures({
      'app/api/assessments/submit/route.ts': `
        import { z } from 'zod';
        import { guardRateLimitAsync } from '@/lib/rate-limit';
        const schema = z.object({ subject: z.string(), grade: z.string() }).strict();
        export async function POST(request: Request) {
          const blocked = await guardRateLimitAsync(request, { key: 'assessment' });
          if (blocked) return blocked;
          schema.parse(await request.json());
          return Response.json({ ok: true });
        }
      `,
    });

    expect(rows.get('app/api/assessments/submit/route.ts')?.risk).toBe('P1');
  });

  it('keeps disabled 501 webhooks at P1', () => {
    const rows = runAuditOnFixtures({
      'app/api/payments/clictopay/webhook/route.ts': `
        export async function POST() {
          return Response.json({ code: 'CLICTOPAY_NOT_CONFIGURED' }, { status: 501 });
        }
      `,
    });

    expect(rows.get('app/api/payments/clictopay/webhook/route.ts')?.risk).toBe('P1');
  });

  it('does not mark staff-looking routes without an explicit role guard as OK', () => {
    const rows = runAuditOnFixtures({
      'app/api/admin/config/route.ts': `
        import { auth } from '@/auth';
        export async function GET() {
          const session = await auth();
          if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
          return Response.json({ config: { publicOnly: true } });
        }
      `,
    });

    expect(rows.get('app/api/admin/config/route.ts')?.risk).not.toBe('OK');
  });

  it('does not mark authenticated PII routes without ownership as OK', () => {
    const rows = runAuditOnFixtures({
      'app/api/student/profile/route.ts': `
        import { auth } from '@/auth';
        export async function GET() {
          const session = await auth();
          if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
          return Response.json({ email: 'redacted@example.test' });
        }
      `,
    });

    expect(rows.get('app/api/student/profile/route.ts')?.risk).not.toBe('OK');
  });

  it('keeps dynamic sensitive routes without ownership above OK', () => {
    const rows = runAuditOnFixtures({
      'app/api/student/documents/[id]/download/route.ts': `
        import { auth } from '@/auth';
        export async function GET() {
          const session = await auth();
          if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
          return new Response('pdf');
        }
      `,
    });

    const risk = rows.get('app/api/student/documents/[id]/download/route.ts')?.risk;
    expect(['P0', 'P1', 'P2']).toContain(risk);
    expect(risk).not.toBe('OK');
  });

  it('keeps the internal rate-limit probe OK only as an explicit non-PII internal route', () => {
    const matrixRows = parseMatrixRows(readFileSync(MATRIX_PATH, 'utf8'));

    expect(matrixRows.get('/api/internal/rate-limit-probe')?.priority).toBe('OK');
  });
});

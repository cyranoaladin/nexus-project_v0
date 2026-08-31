import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const SCANNER = path.join(ROOT, 'scripts/security/check-legacy-search-consumers.mjs');

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(path.join(tmpdir(), 'legacy-search-gate-'));
});

afterEach(() => {
  chmodSync(workspace, 0o755);
  rmSync(workspace, { recursive: true, force: true });
});

function write(relativePath: string, content: string) {
  const target = path.join(workspace, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function run(mode: 'source' | 'artifact', root = workspace) {
  const result = spawnSync(process.execPath, [SCANNER, `--${mode}-root`, root], { encoding: 'utf8' });
  return { status: result.status ?? -1, output: `${result.stdout}\n${result.stderr}` };
}

describe('legacy staff GET search consumer gate', () => {
  test('accepts strict POST JSON consumers for both retired paths', () => {
    write('components/Safe.ts', `
      fetch('/api/quotes/leads/search', { method: 'POST', body: JSON.stringify({ query }) });
      fetch('/api/assistante/students', { method: 'POST', body: JSON.stringify({ query }) });
    `);
    const result = run('source');
    expect(result.status).toBe(0);
    expect(result.output).toContain('LEGACY_GET_SEARCH_CONSUMERS=0');
  });

  test.each([
    [`fetch('/api/quotes/leads/search?q=' + value)`, 'DEFAULT_GET'],
    [`fetch('/api/quotes/leads/search', { method: 'GET' })`, 'EXPLICIT_GET'],
    [`new Request('/api/quotes/leads/search?q=' + value)`, 'DEFAULT_GET'],
    [`fetch('/api/assistante/students?search=' + value)`, 'DEFAULT_GET'],
    [`fetch('/api/assistante/students?search=' + value, { method: 'POST' })`, 'QUERY_PII'],
  ])('rejects retired transport: %s', (consumer, reason) => {
    write('components/Unsafe.ts', consumer);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain(reason);
    expect(result.output).not.toContain('private@example.test');
  });

  test('follows URL and URLSearchParams constructions', () => {
    write('lib/unsafe.ts', `
      const leadUrl = new URL('/api/quotes/leads/search', location.origin);
      leadUrl.searchParams.set('q', privateValue);
      fetch(leadUrl);
      const params = new URLSearchParams();
      params.set('search', privateValue);
      fetch('/api/assistante/students?' + params.toString());
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('QUERY_PII');
  });

  test('does not let explicit POST hide query PII added through URL.searchParams', () => {
    write('lib/unsafe.ts', `
      const leadUrl = new URL('/api/quotes/leads/search', location.origin);
      leadUrl.searchParams.set('q', privateValue);
      fetch(leadUrl, { method: 'POST' });
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('QUERY_PII');
  });

  test('scans executable documentation fences but ignores plain compatibility prose', () => {
    write('docs/runtime.md', `
The historical contract was GET /api/quotes/leads/search?q= and is retired.

\`\`\`ts
fetch('/api/quotes/leads/search?q=' + privateValue)
\`\`\`
    `);
    expect(run('source').status).toBe(1);

    write('docs/runtime.md', 'The historical contract was GET /api/quotes/leads/search?q= and is retired.\n');
    expect(run('source').status).toBe(0);
  });

  test('parses shell and Python documentation fences with their textual scanner', () => {
    write('docs/runtime.md', `
\`\`\`bash
curl -X POST /api/quotes/leads/search
\`\`\`
\`\`\`python
print("safe documentation")
\`\`\`
    `);
    expect(run('source').status).toBe(0);
  });

  test('falls back conservatively for intentionally partial JavaScript documentation', () => {
    write('docs/partial.md', `\`\`\`ts\nconst fragment = {\n\`\`\``);
    expect(run('source').status).toBe(0);

    write('docs/partial.md', `\`\`\`ts\nfetch('/api/quotes/leads/search?q=' + privateValue\n\`\`\``);
    expect(run('source').status).toBe(1);
  });

  test('normalizes a script shebang line without hiding its consumers', () => {
    write('scripts/tool.ts', `import 'server-only';\n#!/usr/bin/env tsx\nfetch('/api/quotes/leads/search', { method: 'POST' });`);
    expect(run('source').status).toBe(0);
    write('scripts/tool.ts', `import 'server-only';\n#!/usr/bin/env tsx\nfetch('/api/quotes/leads/search?q=' + privateValue);`);
    expect(run('source').status).toBe(1);
  });

  test('allows only the exact 405 route implementations and exact denial tests', () => {
    write('app/api/assistante/students/route.ts', `
      export async function GET(request: Request) {
        const { searchParams } = new URL(request.url);
        if (searchParams.has('search')) return Response.json({ error: 'SEARCH_REQUIRES_POST' }, { status: 405 });
        return Response.json({ students: [] });
      }
    `);
    write('app/api/quotes/leads/search/route.ts', `
      export async function GET() {
        return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }
    `);
    write('__tests__/api/assistante.students-search-retired.route.test.ts', `
      const response = await GET(new Request('http://localhost/api/assistante/students?search=denied'));
      expect(response.status).toBe(405);
      const listing = await GET(new Request('http://localhost/api/assistante/students?page=1'));
      expect(listing.status).toBe(200);
    `);
    write('__tests__/api/staff-safe-search-consumers.route.test.ts', `
      const response = await retiredLeadGet(new Request('http://localhost/api/quotes/leads/search?q=denied'));
      expect(response.status).toBe(405);
    `);
    expect(run('source').status).toBe(0);
  });

  test('does not extend the denial allowlist to a same-named file or a test without 405 proof', () => {
    write('scripts/app/api/quotes/leads/search/route.ts', `fetch('/api/quotes/leads/search?q=' + value)`);
    expect(run('source').status).toBe(1);

    rmSync(path.join(workspace, 'scripts'), { recursive: true });
    write('__tests__/api/staff-safe-search-consumers.route.test.ts', `
      fetch('/api/quotes/leads/search?q=' + value);
      expect(response.status).toBe(200);
    `);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `fetch('/api/quotes/leads/search?q='+e)`,
    `fetch('\\x2fapi\\x2fquotes\\x2fleads\\x2fsearch\\x3fq\\x3d'+e)`,
    `fetch('%2Fapi%2Fassistante%2Fstudents%3Fsearch%3D'+e)`,
    `new Request('/api/assistante/students?search='+e)`,
  ])('rejects minified or encoded artifact consumer %#', (consumer) => {
    write('.next/static/chunks/app.js', consumer);
    const result = run('artifact');
    expect(result.status).toBe(1);
    expect(result.output).toContain('LEGACY_GET_SEARCH_CONSUMERS=1');
  });

  test('does not mistake a compiled 405 route for an outbound artifact consumer', () => {
    write('.next/standalone/.next/server/app/api/quotes/leads/search/route.js', `
      function GET(){return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405})}
    `);
    expect(run('artifact').status).toBe(0);
  });

  test.each(['source', 'artifact'] as const)('%s scan fails closed for missing and empty roots', (mode) => {
    const missing = run(mode, path.join(workspace, 'missing'));
    expect(missing.status).toBe(2);
    expect(missing.output).toContain('SCAN_ROOT_MISSING');

    const empty = path.join(workspace, 'empty');
    mkdirSync(empty);
    const emptyResult = run(mode, empty);
    expect(emptyResult.status).toBe(2);
    expect(emptyResult.output).toContain('SCAN_ROOT_EMPTY');
  });

  test('fails closed for an unreadable source entry when permissions apply', () => {
    write('components/locked/consumer.ts', `fetch('/api/quotes/leads/search', { method: 'POST' })`);
    const locked = path.join(workspace, 'components/locked');
    chmodSync(locked, 0o000);
    const result = run('source');
    chmodSync(locked, 0o755);
    if (process.getuid?.() === 0) expect(result.status).toBe(0);
    else {
      expect(result.status).toBe(2);
      expect(result.output).toContain('SCAN_ROOT_UNREADABLE');
    }
  });

  test('repository wiring governs source, CI, artifact audit and the four runtime UI surfaces', () => {
    const pkg = require(path.join(ROOT, 'package.json')) as { scripts: Record<string, string> };
    const ci = require('node:fs').readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    const verifier = require('node:fs').readFileSync(path.join(ROOT, 'scripts/release/verify-standalone-artifact.mjs'), 'utf8');
    const e2e = require('node:fs').readFileSync(path.join(ROOT, 'e2e/auth/candidat-individuel-pipeline.spec.ts'), 'utf8');

    expect(pkg.scripts['security:legacy-search-consumers']).toContain('check-legacy-search-consumers.mjs');
    expect(pkg.scripts['security:legacy-search-consumers:artifact']).toContain('--artifact-root');
    expect(pkg.scripts['artifact:audit']).toContain('security:legacy-search-consumers:artifact');
    expect(ci).toContain('npm run security:legacy-search-consumers');
    expect(ci).toContain('npm run security:legacy-search-consumers:artifact');
    expect(verifier).toContain('scanLegacySearchConsumers');
    expect(e2e).toContain('assertNoLegacyGetSearchRequests');
    for (const marker of ['general-devis', 'stage-planning', 'candidate-inline', 'candidate-contextual']) {
      expect(e2e).toContain(`legacySearchCheckpoint('${marker}'`);
    }
  });
});

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const SCANNER = path.join(ROOT, 'scripts/security/check-legacy-search-consumers.mjs');

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(path.join(tmpdir(), 'legacy-search-gate-'));
  writeGovernedBaseline();
});

afterEach(() => {
  chmodSync(workspace, 0o755);
  rmSync(workspace, { recursive: true, force: true });
});

function write(relativePath: string, content: string) {
  const target = path.join(workspace, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content
    .replaceAll('__LEAD_SEARCH__', '/api/quotes/leads/search')
    .replaceAll('__STUDENT_DIRECTORY__', '/api/assistante/students')
    .replaceAll('__LEAD_HEX_QUERY__', '\\x2fapi\\x2fquotes\\x2fleads\\x2fsearch' + '\\x3fq\\x3d')
    .replaceAll('__LEAD_PERCENT_QUERY__', '%2Fapi%2Fquotes%2Fleads%2Fsearch' + '%3Fq%3D')
    .replaceAll('__STUDENT_PERCENT_QUERY__', '%2Fapi%2Fassistante%2Fstudents' + '%3Fsearch%3D'));
}

function writeGovernedBaseline() {
  write('app/api/assistante/students/route.ts', `
    export async function GET(request: Request) {
      try {
        if (!request.headers.has('authorization')) return Response.json({ error: 'Forbidden' }, { status: 403 });
        const { searchParams } = new URL(request.url);
        if (searchParams.has('search')) {
          return Response.json(
            { error: 'SEARCH_REQUIRES_POST' },
            { status: 405, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
          );
        }
        return Response.json({ students: [] });
      } catch {
        return Response.json({ error: 'SEARCH_UNAVAILABLE' }, { status: 500 });
      }
    }
  `);
  write('app/api/quotes/leads/search/route.ts', `
    export async function GET() {
      return Response.json(
        { error: 'METHOD_NOT_ALLOWED' },
        { status: 405, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }
  `);
  write('__tests__/api/assistante.students-search-retired.route.test.ts', `
    test('retired search is denied', async () => {
      const response = await GET(new Request('http://localhost__STUDENT_DIRECTORY__?search=denied'));
      expect(response.status).toBe(405);
    });
  `);
  write('__tests__/api/staff-safe-search-consumers.route.test.ts', `
    test('retired search is denied', async () => {
      const response = await retiredLeadGet(new Request('http://localhost__LEAD_SEARCH__?q=denied'));
      expect(response.status).toBe(405);
    });
  `);
}

function run(mode: 'source' | 'artifact', root = workspace) {
  const result = spawnSync(process.execPath, [SCANNER, `--${mode}-root`, root], { encoding: 'utf8' });
  return { status: result.status ?? -1, output: `${result.stdout}\n${result.stderr}` };
}

describe('legacy staff GET search consumer gate', () => {
  test('accepts strict POST JSON consumers for both retired paths', () => {
    write('components/Safe.ts', `
      fetch('__LEAD_SEARCH__', { method: 'POST', body: JSON.stringify({ query }) });
      fetch('__STUDENT_DIRECTORY__', { method: 'POST', body: JSON.stringify({ query }) });
    `);
    const result = run('source');
    expect(result.status).toBe(0);
    expect(result.output).toContain('LEGACY_GET_SEARCH_CONSUMERS=0');
  });

  test.each([
    'root-consumer.ts',
    'hooks/useLegacySearch.ts',
    'services/legacy-search.mts',
    'src/runtime/legacy-search.cts',
  ])('scans runtime code from the canonical root: %s', (relativePath) => {
    write(relativePath, `fetch('__LEAD_SEARCH__?q=' + privateValue)`);
    expect(run('source').status).toBe(1);
  });

  test.each([
    [`fetch('__LEAD_SEARCH__?q=' + value)`, 'DEFAULT_GET'],
    [`fetch('__LEAD_SEARCH__', { method: 'GET' })`, 'EXPLICIT_GET'],
    [`new Request('__LEAD_SEARCH__?q=' + value)`, 'DEFAULT_GET'],
    [`fetch('__STUDENT_DIRECTORY__?search=' + value)`, 'DEFAULT_GET'],
    [`fetch('__STUDENT_DIRECTORY__?search=' + value, { method: 'POST' })`, 'QUERY_PII'],
  ])('rejects retired transport: %s', (consumer, reason) => {
    write('components/Unsafe.ts', consumer);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain(reason);
    expect(result.output).not.toContain('private@example.test');
  });

  test('follows URL and URLSearchParams constructions', () => {
    write('lib/unsafe.ts', `
      const leadUrl = new URL('__LEAD_SEARCH__', location.origin);
      leadUrl.searchParams.set('q', privateValue);
      fetch(leadUrl);
      const params = new URLSearchParams();
      params.set('search', privateValue);
      fetch('__STUDENT_DIRECTORY__?' + params.toString());
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('QUERY_PII');
  });

  test('does not let explicit POST hide query PII added through URL.searchParams', () => {
    write('lib/unsafe.ts', `
      const leadUrl = new URL('__LEAD_SEARCH__', location.origin);
      leadUrl.searchParams.set('q', privateValue);
      fetch(leadUrl, { method: 'POST' });
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('QUERY_PII');
  });

  test.each([
    `axios.get('__LEAD_SEARCH__?q=' + privateValue)`,
    `request.get('__LEAD_SEARCH__?q=' + privateValue)`,
    `page.request.get('__LEAD_SEARCH__?q=' + privateValue)`,
    `api.get('__LEAD_SEARCH__?q=' + privateValue)`,
    `got('__LEAD_SEARCH__?q=' + privateValue)`,
    `got.get('__LEAD_SEARCH__?q=' + privateValue)`,
    `ky('__LEAD_SEARCH__?q=' + privateValue)`,
    `ky.get('__LEAD_SEARCH__?q=' + privateValue)`,
    `$fetch('__LEAD_SEARCH__?q=' + privateValue)`,
    `axios('__LEAD_SEARCH__', { method: 'GET' })`,
    `axios({ url: '__LEAD_SEARCH__?q=' + privateValue, method: 'GET' })`,
  ])('rejects additional default/GET transport %#', (consumer) => {
    write('services/consumer.ts', consumer);
    expect(run('source').status).toBe(1);
  });

  test('tracks append and conservative dynamic builders/string concatenation', () => {
    write('hooks/useSearch.ts', `
      const base = '/api/quotes';
      const segments = [base, 'leads', 'search'];
      const params = new URLSearchParams();
      params.append('q', privateValue);
      const target = buildStaffUrl(segments.join('/'), params.toString());
      client.get(target);
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('QUERY_PII');
  });

  test.each([
    `request('__LEAD_SEARCH__?q=' + privateValue)`,
    `new ProxyRequest('__STUDENT_DIRECTORY__?search=' + privateValue)`,
    `const options = { endpoint: '__LEAD_SEARCH__?q=' + privateValue }; client(options)`,
    `const leaked = '__STUDENT_DIRECTORY__?search=' + privateValue`,
  ])('rejects unknown wrappers and standalone legacy query constants %#', (consumer) => {
    write('src/indirect.ts', consumer);
    expect(run('source').status).toBe(1);
  });

  test('rejects an imported legacy query constant at its defining source', () => {
    write('lib/legacy-endpoint.ts', `export const legacyEndpoint = '__LEAD_SEARCH__?q=' + privateValue`);
    write('components/consumer.ts', `import { legacyEndpoint } from '../lib/legacy-endpoint'; request(legacyEndpoint)`);
    expect(run('source').status).toBe(1);
  });

  test('never trusts POST-looking options on unknown wrappers', () => {
    write('src/indirect.ts', `request('__LEAD_SEARCH__', { method: 'POST', body: payload })`);
    expect(run('source').status).toBe(1);

    write('src/indirect.ts', `request('__LEAD_SEARCH__', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })`);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `legacyGet('__LEAD_SEARCH__', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })`,
    `function test(target) { return customClient(target) }
     test('__LEAD_SEARCH__?q=' + privateValue)`,
  ])('never infers safe semantics for custom wrappers %#', (consumer) => {
    write('src/custom-wrapper.ts', consumer);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `__LEAD_SEARCH__/?q=`,
    `__LEAD_SEARCH__?q`,
    `__LEAD_SEARCH__?%71`,
    `__LEAD_SEARCH__%3Fq%3D`,
    `__STUDENT_DIRECTORY__/?search=`,
    `__STUDENT_DIRECTORY__?search`,
    `__STUDENT_DIRECTORY__?%73earch`,
    `__STUDENT_DIRECTORY__%3Fsearch%3D`,
  ])('normalizes legacy URL boundary variant %#', (target) => {
    write('src/boundary.ts', `request(${JSON.stringify(target)})`);
    expect(run('source').status).toBe(1);
  });

  test('allows POST methods on axios, got, ky and $fetch only without query PII', () => {
    write('src/safe.ts', `
      axios.post('__LEAD_SEARCH__', { query: privateValue });
      got.post('__LEAD_SEARCH__', { json: { query: privateValue } });
      ky.post('__LEAD_SEARCH__', { json: { query: privateValue } });
      $fetch('__LEAD_SEARCH__', { method: 'POST', body: { query: privateValue } });
    `);
    expect(run('source').status).toBe(0);
  });

  test('scans executable documentation fences but ignores plain compatibility prose', () => {
    write('docs/runtime.md', `
The historical contract was GET __LEAD_SEARCH__?q= and is retired.

\`\`\`ts
fetch('__LEAD_SEARCH__?q=' + privateValue)
\`\`\`
    `);
    expect(run('source').status).toBe(1);

    write('docs/runtime.md', 'The historical contract was GET __LEAD_SEARCH__?q= and is retired.\n');
    expect(run('source').status).toBe(0);
  });

  test('parses shell and Python documentation fences with their textual scanner', () => {
    write('docs/runtime.md', `
\`\`\`bash
curl -X POST __LEAD_SEARCH__
\`\`\`
\`\`\`python
print("safe documentation")
\`\`\`
    `);
    expect(run('source').status).toBe(0);
  });

  test.each([
    `\`\`\`bash\ncurl \\\n+      '__LEAD_SEARCH__?q='\n\`\`\``,
    `\`\`\`bash\nwget \\\n+      '__STUDENT_DIRECTORY__?search='\n\`\`\``,
    `\`\`\`python\nrequests.get(\n  '__LEAD_SEARCH__?q='\n)\n\`\`\``,
    `\`\`\`python\nhttpx.get(\n  '__STUDENT_DIRECTORY__?search='\n)\n\`\`\``,
    `\`\`\`python\nurllib.request.urlopen(\n  '__LEAD_SEARCH__?q='\n)\n\`\`\``,
  ])('rejects multiline executable documentation transport %#', (markdown) => {
    write('docs/multiline.md', markdown);
    expect(run('source').status).toBe(1);
  });

  test('does not let a preceding safe shell POST lend its method to a legacy GET command', () => {
    write('docs/command-boundary.md', `
\`\`\`bash
curl -X POST '__LEAD_SEARCH__' && \\
  echo safe
curl '__LEAD_SEARCH__'
\`\`\`
    `);
    expect(run('source').status).toBe(1);
  });

  test('falls back conservatively for intentionally partial JavaScript documentation', () => {
    write('docs/partial.md', `\`\`\`ts\nconst fragment = {\n\`\`\``);
    expect(run('source').status).toBe(0);

    write('docs/partial.md', `\`\`\`ts\nfetch('__LEAD_SEARCH__?q=' + privateValue\n\`\`\``);
    expect(run('source').status).toBe(1);
  });

  test('normalizes a script shebang line without hiding its consumers', () => {
    write('scripts/tool.ts', `import 'server-only';\n#!/usr/bin/env tsx\nfetch('__LEAD_SEARCH__', { method: 'POST' });`);
    expect(run('source').status).toBe(0);
    write('scripts/tool.ts', `import 'server-only';\n#!/usr/bin/env tsx\nfetch('__LEAD_SEARCH__?q=' + privateValue);`);
    expect(run('source').status).toBe(1);
  });

  test('allows only the exact 405 route implementations and exact denial tests', () => {
    write('app/api/assistante/students/route.ts', `
      export async function GET(request: Request) {
        try {
          const { searchParams } = new URL(request.url);
          if (searchParams.has('search')) return Response.json(
            { error: 'SEARCH_REQUIRES_POST' },
            { status: 405, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
          );
          return Response.json({ students: [] });
        } catch {
          return Response.json({ error: 'SEARCH_UNAVAILABLE' }, { status: 500 });
        }
      }
    `);
    write('app/api/quotes/leads/search/route.ts', `
      export async function GET() {
        return Response.json(
          { error: 'METHOD_NOT_ALLOWED' },
          { status: 405, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
        );
      }
    `);
    write('__tests__/api/assistante.students-search-retired.route.test.ts', `
      test('retired search is denied', async () => {
        const response = await GET(new Request('http://localhost__STUDENT_DIRECTORY__?search=denied'));
        expect(response.status).toBe(405);
        const listing = await GET(new Request('http://localhost__STUDENT_DIRECTORY__?page=1'));
        expect(listing.status).toBe(200);
      });
    `);
    write('__tests__/api/staff-safe-search-consumers.route.test.ts', `
      test('retired search is denied', async () => {
        const response = await retiredLeadGet(new Request('http://localhost__LEAD_SEARCH__?q=denied'));
        expect(response.status).toBe(405);
      });
    `);
    expect(run('source').status).toBe(0);
  });

  test.each([
    'app/api/assistante/students/route.ts',
    'app/api/quotes/leads/search/route.ts',
  ])('fails closed when governed retired route is missing: %s', (relativePath) => {
    rmSync(path.join(workspace, relativePath));
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('GOVERNED_ROUTE_MISSING');
  });

  test('rejects a reopened lead GET route even when it retains a decoy 405 branch', () => {
    write('app/api/quotes/leads/search/route.ts', `
      export async function GET(request: Request) {
        if (new URL(request.url).searchParams.has('retired')) {
          return Response.json({ error: 'METHOD_NOT_ALLOWED' }, {
            status: 405,
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
          });
        }
        return Response.json({ items: [] }, { status: 200 });
      }
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('GOVERNED_LEAD_ROUTE_INVALID');
  });

  test('rejects fake response facades in both governed routes', () => {
    write('app/api/quotes/leads/search/route.ts', `
      export async function GET() {
        return Facade.json({ error: 'METHOD_NOT_ALLOWED' }, {
          status: 405, headers: { 'Cache-Control': 'private, no-store' },
        });
      }
    `);
    expect(run('source').status).toBe(1);

    writeGovernedBaseline();
    write('app/api/assistante/students/route.ts', `
      export async function GET(request: Request) {
        try {
          const { searchParams } = new URL(request.url);
          if (searchParams.has('search')) return Facade.json({ error: 'SEARCH_REQUIRES_POST' }, {
            status: 405, headers: { 'Cache-Control': 'private, no-store' },
          });
          return Response.json({ students: [] });
        } catch { return Response.json({ error: 'SEARCH_UNAVAILABLE' }, { status: 500 }); }
      }
    `);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `return Response.json({ error: 'SEARCH_REQUIRES_POST' }, { status: 200, headers: { 'Cache-Control': 'private, no-store' } });`,
    `return Response.json({ error: 'SEARCH_REQUIRES_POST' }, { status: 405, headers: { 'Cache-Control': 'private' } });`,
    `return Response.json({ error: 'WRONG_CODE' }, { status: 405, headers: { 'Cache-Control': 'private, no-store' } });`,
  ])('rejects reopened or weakened student search denial %#', (denial) => {
    write('app/api/assistante/students/route.ts', `
      export async function GET(request: Request) {
        const { searchParams } = new URL(request.url);
        if (searchParams.has('search')) { ${denial} }
        return Response.json({ students: [] });
      }
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('GOVERNED_STUDENT_ROUTE_INVALID');
  });

  test('rejects an unreachable student denial decoy around a reopened listing', () => {
    write('app/api/assistante/students/route.ts', `
      export async function GET(request: Request) {
        if (false) {
          const { searchParams } = new URL(request.url);
          if (searchParams.has('search')) {
            return Response.json({ error: 'SEARCH_REQUIRES_POST' }, {
              status: 405,
              headers: { 'Cache-Control': 'private, no-store, max-age=0' },
            });
          }
          return Response.json({ students: [] });
        }
        return Response.json({ students: [] }, { status: 200 });
      }
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('GOVERNED_STUDENT_ROUTE_INVALID');
  });

  test('rejects a header-conditioned search success before the governed denial', () => {
    write('app/api/assistante/students/route.ts', `
      export async function GET(request: Request) {
        if (request.headers.has('x-search-bypass') && new URL(request.url).searchParams.has('search')) {
          return Response.json({ students: [] }, { status: 200 });
        }
        const { searchParams } = new URL(request.url);
        if (searchParams.has('search')) {
          return Response.json({ error: 'SEARCH_REQUIRES_POST' }, {
            status: 405,
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
          });
        }
        return Response.json({ students: [] });
      }
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('GOVERNED_STUDENT_ROUTE_INVALID');
  });

  test('rejects an unknown-status helper return before the governed denial', () => {
    write('app/api/assistante/students/route.ts', `
      export async function GET(request: Request) {
        try {
          if (request.headers.has('x-bypass')) return listStudents();
          const { searchParams } = new URL(request.url);
          if (searchParams.has('search')) return Response.json({ error: 'SEARCH_REQUIRES_POST' }, {
            status: 405, headers: { 'Cache-Control': 'private, no-store' },
          });
          return Response.json({ students: [] });
        } catch { return Response.json({ error: 'SEARCH_UNAVAILABLE' }, { status: 500 }); }
      }
    `);
    expect(run('source').status).toBe(1);
  });

  test('rejects an unconditional success between derivation and denial', () => {
    write('app/api/assistante/students/route.ts', `
      export async function GET(request: Request) {
        const { searchParams } = new URL(request.url);
        return Response.json({ students: [] }, { status: 200 });
        if (searchParams.has('search')) {
          return Response.json({ error: 'SEARCH_REQUIRES_POST' }, {
            status: 405,
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
          });
        }
        return Response.json({ students: [] });
      }
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('GOVERNED_STUDENT_ROUTE_INVALID');
  });

  test('rejects a later alternate search success branch', () => {
    write('app/api/assistante/students/route.ts', `
      export async function GET(request: Request) {
        const { searchParams } = new URL(request.url);
        if (searchParams.has('search')) {
          return Response.json({ error: 'SEARCH_REQUIRES_POST' }, {
            status: 405,
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
          });
        }
        if (searchParams.get('search')) return Response.json({ students: [] }, { status: 200 });
        return Response.json({ students: [] });
      }
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('GOVERNED_STUDENT_ROUTE_INVALID');
  });

  test.each([
    `
      if (request.headers.has('x-bypass')) return Response.json({ students: [] }, { status: 200 });
      try { GOVERNED_TRY } catch { return Response.json({ error: 'SEARCH_UNAVAILABLE' }, { status: 500 }); }
    `,
    `
      try { GOVERNED_TRY } catch { return Response.json({ students: [] }, { status: 200 }); }
    `,
    `
      try { GOVERNED_TRY } catch { return Response.json({ error: 'SEARCH_UNAVAILABLE' }, { status: 500 }); }
      finally { return Response.json({ students: [] }, { status: 200 }); }
    `,
  ])('rejects outer try/catch dominance bypass %#', (body) => {
    const governedTry = `
      const { searchParams } = new URL(request.url);
      if (searchParams.has('search')) return Response.json(
        { error: 'SEARCH_REQUIRES_POST' },
        { status: 405, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
      return Response.json({ students: [] });
    `;
    write('app/api/assistante/students/route.ts', `
      export async function GET(request: Request) {
        ${body.replace('GOVERNED_TRY', governedTry)}
      }
    `);
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('GOVERNED_STUDENT_ROUTE_INVALID');
  });

  test.each([
    '__tests__/api/assistante.students-search-retired.route.test.ts',
    '__tests__/api/staff-safe-search-consumers.route.test.ts',
  ])('fails closed when exact denial test is missing: %s', (relativePath) => {
    rmSync(path.join(workspace, relativePath));
    const result = run('source');
    expect(result.status).toBe(1);
    expect(result.output).toContain('GOVERNED_DENIAL_TEST_MISSING');
  });

  test('does not extend the denial allowlist to a same-named file or a test without 405 proof', () => {
    write('scripts/app/api/quotes/leads/search/route.ts', `fetch('__LEAD_SEARCH__?q=' + value)`);
    expect(run('source').status).toBe(1);

    rmSync(path.join(workspace, 'scripts'), { recursive: true });
    write('__tests__/api/staff-safe-search-consumers.route.test.ts', `
      fetch('__LEAD_SEARCH__?q=' + value);
      expect(response.status).toBe(200);
    `);
    expect(run('source').status).toBe(1);
  });

  test('does not broadly exempt direct consumers or unproved fixtures in the scanner test file', () => {
    write('__tests__/scripts/check-legacy-search-consumers.test.ts', `
      test('runtime consumer', () => request('__LEAD_SEARCH__?q=' + privateValue));
    `);
    expect(run('source').status).toBe(1);

    write('__tests__/scripts/check-legacy-search-consumers.test.ts', `
      test('unproved fixture', () => {
        write('src/unsafe.ts', "request('__STUDENT_DIRECTORY__?search=' + privateValue)");
      });
    `);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `
      const denied = retiredLeadGet(new Request('http://localhost__LEAD_SEARCH__?q=denied'));
      // expect(denied.status).toBe(405)
      const response = { status: 405 };
      expect(response.status).toBe(405);
    `,
    `
      const denied = retiredLeadGet(new Request('http://localhost__LEAD_SEARCH__?q=denied'));
      const decoy = "expect(denied.status).toBe(405)";
    `,
    `
      const denied = retiredLeadGet(new Request('http://localhost__LEAD_SEARCH__?q=denied'));
      const unrelated = await safePost();
      expect(unrelated.status).toBe(405);
    `,
  ])('rejects lexical or unrelated 405 denial-test decoy %#', (testBody) => {
    write('__tests__/api/staff-safe-search-consumers.route.test.ts', `
      test('decoy', async () => { ${testBody} });
    `);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `fetch('__LEAD_SEARCH__?q='+e)`,
    `fetch('__LEAD_HEX_QUERY__'+e)`,
    `fetch('__STUDENT_PERCENT_QUERY__'+e)`,
    `new Request('__STUDENT_DIRECTORY__?search='+e)`,
    `axios.get('__LEAD_SEARCH__?q='+e)`,
    `ky('__LEAD_PERCENT_QUERY__'+e)`,
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
    write('components/locked/consumer.ts', `fetch('__LEAD_SEARCH__', { method: 'POST' })`);
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
    expect(pkg.scripts['artifact:audit']).not.toContain('security:legacy-search-consumers:artifact');
    expect(ci).toContain('npm run security:legacy-search-consumers');
    expect(ci).not.toContain('run: npm run security:legacy-search-consumers:artifact');
    expect(ci).not.toContain('run: npm run artifact:audit');
    expect((pkg.scripts.build.match(/npm run artifact:audit/g) ?? [])).toHaveLength(1);
    expect((pkg.scripts.build.match(/verify-standalone-artifact\.mjs/g) ?? [])).toHaveLength(1);
    expect((pkg.scripts['artifact:audit'].match(/security:legacy-search-consumers:artifact/g) ?? [])).toHaveLength(0);
    expect((verifier.match(/scanLegacySearchConsumers\(\{ root: buildDir, mode: 'artifact' \}\)/g) ?? [])).toHaveLength(1);
    expect(verifier).toContain('scanLegacySearchConsumers');
    expect(e2e).toContain('assertNoLegacyGetSearchRequests');
    for (const marker of ['general-devis', 'stage-planning', 'candidate-inline', 'candidate-contextual']) {
      expect(e2e).toContain(`legacySearchCheckpoint('${marker}'`);
    }
  });
});

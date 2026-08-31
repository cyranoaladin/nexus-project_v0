import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const SCANNER = path.join(ROOT, 'scripts/security/check-legacy-search-consumers.mjs');
const LEAD_SEARCH_PATH = String.fromCharCode(47,97,112,105,47,113,117,111,116,101,115,47,108,101,97,100,115,47,115,101,97,114,99,104);
const STUDENT_DIRECTORY_PATH = String.fromCharCode(47,97,112,105,47,97,115,115,105,115,116,97,110,116,101,47,115,116,117,100,101,110,116,115);
const LEAD_HEX_QUERY = String.fromCharCode(92,120,50,102,97,112,105,92,120,50,102,113,117,111,116,101,115,92,120,50,102,108,101,97,100,115,92,120,50,102,115,101,97,114,99,104,92,120,51,102,113,92,120,51,100);
const LEAD_PERCENT_QUERY = String.fromCharCode(37,50,70,97,112,105,37,50,70,113,117,111,116,101,115,37,50,70,108,101,97,100,115,37,50,70,115,101,97,114,99,104,37,51,70,113,37,51,68);
const STUDENT_PERCENT_QUERY = String.fromCharCode(37,50,70,97,112,105,37,50,70,97,115,115,105,115,116,97,110,116,101,37,50,70,115,116,117,100,101,110,116,115,37,51,70,115,101,97,114,99,104,37,51,68);

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
    .replaceAll('__LEAD_SEARCH__', LEAD_SEARCH_PATH)
    .replaceAll('__STUDENT_DIRECTORY__', STUDENT_DIRECTORY_PATH)
    .replaceAll('__LEAD_HEX_QUERY__', LEAD_HEX_QUERY)
    .replaceAll('__LEAD_PERCENT_QUERY__', LEAD_PERCENT_QUERY)
    .replaceAll('__STUDENT_PERCENT_QUERY__', STUDENT_PERCENT_QUERY));
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
      import axiosClient from 'axios';
      import gotClient from 'got';
      import kyClient from 'ky';
      import { $fetch as ofetchClient } from 'ofetch';
      axiosClient.post('__LEAD_SEARCH__', { query: privateValue });
      gotClient.post('__LEAD_SEARCH__', { json: { query: privateValue } });
      kyClient.post('__LEAD_SEARCH__', { json: { query: privateValue } });
      ofetchClient('__LEAD_SEARCH__', { method: 'POST', body: { query: privateValue } });
    `);
    expect(run('source').status).toBe(0);
  });

  test.each([
    `customCall('metadata', '__LEAD_SEARCH__')`,
    `new CustomRequest('metadata', '__LEAD_SEARCH__')`,
  ])('inspects legacy targets in every unknown call and constructor argument %#', (consumer) => {
    write('src/arg-binding.ts', consumer);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `const fetch = (_url, _options) => Promise.resolve();
     fetch('__LEAD_SEARCH__', { method: 'POST' })`,
    `const axios = { post: (_url, _body) => undefined };
     axios.post('__LEAD_SEARCH__', { query: privateValue })`,
    `function $fetch(_url, _options) {}
     $fetch('__LEAD_SEARCH__', { method: 'POST', body: { query: privateValue } })`,
  ])('rejects shadowed or untrusted transport bindings %#', (consumer) => {
    write('src/shadowed.ts', consumer);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `const window = { fetch: (_url, _options) => undefined };
     window.fetch('__LEAD_SEARCH__', { method: 'POST' })`,
    `function run(globalThis) {
       globalThis.fetch('__LEAD_SEARCH__', { method: 'POST' });
     }`,
    `const URL = class LocalUrl {};
     const endpoint = new URL('__STUDENT_DIRECTORY__');
     fetch(endpoint, { method: 'POST' })`,
  ])('rejects shadowed platform globals %#', (consumer) => {
    write('src/shadowed-platform.ts', consumer);
    expect(run('source').status).toBe(1);
  });

  test('allows unshadowed platform globals to carry a proven POST URL', () => {
    write('src/platform-post.ts', `
      const endpoint = new URL('__LEAD_SEARCH__');
      window.fetch(endpoint, { method: 'POST' });
      globalThis.fetch(endpoint, { method: 'POST' });
    `);
    expect(run('source').status).toBe(0);
  });

  test.each([
    `fetch('__LEAD_SEARCH__?' + new URLSearchParams({ q: privateValue }), { method: 'POST' })`,
    `const params = new URLSearchParams();
     params.append('q', privateValue);
     fetch('__LEAD_SEARCH__?' + params, { method: 'POST' })`,
    `import axiosClient from 'axios';
     axiosClient.post('__LEAD_SEARCH__', { safe: true }, { params: { q: privateValue } })`,
    `import { $fetch as ofetchClient } from 'ofetch';
     ofetchClient('__STUDENT_DIRECTORY__', { method: 'POST', query: { search: privateValue } })`,
  ])('rejects separately supplied JavaScript query parameters %#', (consumer) => {
    write('src/query-composition.ts', consumer);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `import axiosClient from 'axios';
     const params = { q: privateValue };
     axiosClient.post('__LEAD_SEARCH__', { safe: true }, { params })`,
    `import gotClient from 'got';
     const searchParams = { q: privateValue };
     const options = { searchParams };
     gotClient.post('__LEAD_SEARCH__', options)`,
    `import { $fetch as ofetchClient } from 'ofetch';
     const query = { search: privateValue };
     const options = { query };
     ofetchClient('__STUDENT_DIRECTORY__', { ...options, method: 'POST' })`,
    `import axiosClient from 'axios';
     const params = new URLSearchParams({ q: privateValue });
     const options = { params };
     axiosClient.post('__LEAD_SEARCH__', { safe: true }, options)`,
  ])('resolves shorthand and nested query option bindings %#', (consumer) => {
    write('src/shorthand-query.ts', consumer);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `import axiosClient from 'axios';
     const params = {};
     params.q = privateValue;
     axiosClient.post('__LEAD_SEARCH__', { safe: true }, { params })`,
    `import gotClient from 'got';
     const searchParams = {};
     searchParams['q'] = privateValue;
     gotClient.post('__LEAD_SEARCH__', { searchParams })`,
    `import kyClient from 'ky';
     const options = {};
     options.searchParams = { q: privateValue };
     kyClient.post('__LEAD_SEARCH__', options)`,
    `import { $fetch as ofetchClient } from 'ofetch';
     const options = { method: 'POST' };
     Object.assign(options, { query: { search: privateValue } });
     ofetchClient('__STUDENT_DIRECTORY__', options)`,
    `import { $fetch as ofetchClient } from 'ofetch';
     let options = { method: 'POST' };
     const query = { search: privateValue };
     options = { ...options, query };
     ofetchClient('__STUDENT_DIRECTORY__', options)`,
  ])('tracks exact object mutations used by transports %#', (consumer) => {
    write('src/mutated-options.ts', consumer);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `import { $fetch as ofetchClient } from 'ofetch';
     const options = { method: 'POST' };
     Object.assign(options, buildRuntimeOptions());
     ofetchClient('__STUDENT_DIRECTORY__', options)`,
    `import axiosClient from 'axios';
     const options = { method: 'POST' };
     options.params = buildRuntimeParams();
     axiosClient('__STUDENT_DIRECTORY__', options)`,
    `import kyClient from 'ky';
     const options = { method: 'POST' };
     options[dynamicProperty] = runtimeValue;
     kyClient.post('__STUDENT_DIRECTORY__', options)`,
  ])('fails closed for ambiguous mutated student transport options %#', (consumer) => {
    write('src/ambiguous-options.ts', consumer);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `import axiosClient from 'axios';
     axiosClient.post('__LEAD_SEARCH__', { safe: true }, { params: runtimeParams })`,
    `import kyClient from 'ky';
     kyClient.post('__STUDENT_DIRECTORY__', runtimeOptions)`,
  ])('fails both governed endpoints on unresolved query or options bindings %#', (consumer) => {
    write('src/unresolved-options.ts', consumer);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `import axiosClient from 'axios';
     const params = {};
     axiosClient.post('__LEAD_SEARCH__', { safe: true }, { params })`,
    `import { $fetch as ofetchClient } from 'ofetch';
     const query = {};
     const options = { method: 'POST', query };
     ofetchClient('__STUDENT_DIRECTORY__', options)`,
  ])('allows statically resolved empty POST query configurations %#', (consumer) => {
    write('src/resolved-empty-options.ts', consumer);
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

  test.each([
    `\`\`\`bash\nurl='__LEAD_SEARCH__?q='\ncurl "$url"\n\`\`\``,
    `\`\`\`python\nendpoint = '__STUDENT_DIRECTORY__?search='\nrequests.get(endpoint)\n\`\`\``,
  ])('rejects executable endpoint constants used by GET %#', (markdown) => {
    write('docs/constant-transport.md', markdown);
    expect(run('source').status).toBe(1);
  });

  test('allows a shell endpoint constant consumed only by an explicit POST command', () => {
    write('docs/constant-post.md', `
\`\`\`bash
url='__LEAD_SEARCH__'
curl -X POST "$url"
\`\`\`
    `);
    expect(run('source').status).toBe(0);
  });

  test.each([
    `\`\`\`python\nrequests.post('__LEAD_SEARCH__', params={'q': private_value})\n\`\`\``,
    `\`\`\`python\nparams = {'search': private_value}\nhttpx.get('__STUDENT_DIRECTORY__', params=params)\n\`\`\``,
    `\`\`\`bash\ncurl -G '__STUDENT_DIRECTORY__' --data-urlencode 'search=private'\n\`\`\``,
    `\`\`\`bash\ncurl --get '__STUDENT_DIRECTORY__' -d 'search=private'\n\`\`\``,
  ])('rejects separately supplied executable query parameters %#', (markdown) => {
    write('docs/separate-query.md', markdown);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `\`\`\`python
params = {
  'search': build_value(nested(call()))
}
requests.post(
  '__STUDENT_DIRECTORY__',
  json=payload,
  params=params,
)
\`\`\``,
    `\`\`\`python
requests.Session().get('__LEAD_SEARCH__')
\`\`\``,
    `\`\`\`python
httpx.Client().get(
  '__LEAD_SEARCH__',
)
\`\`\``,
    `\`\`\`python
endpoint = '__STUDENT_DIRECTORY__'
encoded = '%73earch'
client.send(endpoint, params={encoded: nested(value())})
\`\`\``,
    `\`\`\`python
requests.post('__LEAD_SEARCH__', json={'safe': True})
\`\`\``,
  ])('fails closed across a complete Python executable block %#', (markdown) => {
    write('docs/python-conservative.md', markdown);
    expect(run('source').status).toBe(1);
  });

  test.each([
    `curl '__STUDENT_DIRECTORY__' --url-query 'search=private'`,
    `curl --url-query=search=private '__STUDENT_DIRECTORY__'`,
    `curl '__STUDENT_DIRECTORY__' --url-query 'safe=1' --url-query 'search=private'`,
    `curl '__STUDENT_DIRECTORY__' --url-query @query.txt`,
    `curl '__STUDENT_DIRECTORY__' --url-query=+@query.txt`,
  ])('recognizes curl url-query variants %#', (command) => {
    write('docs/curl-url-query.md', `\`\`\`bash\n${command}\n\`\`\``);
    expect(run('source').status).toBe(1);
  });

  test('treats each single-pipe shell command independently', () => {
    write('docs/pipeline.md', `
\`\`\`bash
curl -X POST '__LEAD_SEARCH__' | curl '__LEAD_SEARCH__'
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
    `const Response = { json: Facade.json };
     export async function GET() {
       return Response.json({ error: 'METHOD_NOT_ALLOWED' }, {
         status: 405, headers: { 'Cache-Control': 'private, no-store' },
       });
     }`,
    `import { NextResponse } from 'fake-next-server';
     export async function GET() {
       return NextResponse.json({ error: 'METHOD_NOT_ALLOWED' }, {
         status: 405, headers: { 'Cache-Control': 'private, no-store' },
       });
     }`,
  ])('rejects shadowed or fake governed response bindings %#', (route) => {
    write('app/api/quotes/leads/search/route.ts', route);
    expect(run('source').status).toBe(1);
  });

  test('rejects a governed student route whose URL constructor is shadowed', () => {
    write('app/api/assistante/students/route.ts', `
      const URL = class LocalUrl {};
      export async function GET(request: Request) {
        try {
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

  test('rejects locally forged auth guard helpers', () => {
    write('app/api/assistante/students/route.ts', `
      const requireAnyRole = async () => ({ user: {} });
      const isErrorResponse = () => true;
      export async function GET(request: Request) {
        try {
          const sessionOrError = await requireAnyRole(['ADMIN']);
          if (isErrorResponse(sessionOrError)) return sessionOrError;
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

  test.each([
    `['ADMIN']`,
    `['ASSISTANTE']`,
    `['ADMIN', 'ASSISTANTE', 'PARENT']`,
    `['ADMIN', 'ASSISTANTE', 'ELEVE']`,
    `['ADMIN', 'ASSISTANTE', 'COACH']`,
    `['ADMIN', 'ASSISTANTE', 'UNKNOWN']`,
  ])('rejects a governed role set other than exactly ADMIN and ASSISTANTE %#', (roles) => {
    write('app/api/assistante/students/route.ts', `
      import { isErrorResponse as isGuardError, requireAnyRole as requireStaff } from '@/lib/guards';
      export async function GET(request: Request) {
        try {
          const sessionOrError = await requireStaff(${roles});
          if (isGuardError(sessionOrError)) return sessionOrError;
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

  test('accepts the exact governed role set in either order with imported aliases', () => {
    write('app/api/assistante/students/route.ts', `
      import { isErrorResponse as isGuardError, requireAnyRole as requireStaff } from '@/lib/guards';
      export async function GET(request: Request) {
        try {
          const sessionOrError = await requireStaff(['ASSISTANTE', 'ADMIN']);
          if (isGuardError(sessionOrError)) return sessionOrError;
          const { searchParams } = new URL(request.url);
          if (searchParams.has('search')) return Response.json({ error: 'SEARCH_REQUIRES_POST' }, {
            status: 405, headers: { 'Cache-Control': 'private, no-store' },
          });
          return Response.json({ students: [] });
        } catch { return Response.json({ error: 'SEARCH_UNAVAILABLE' }, { status: 500 }); }
      }
    `);
    expect(run('source').status).toBe(0);
  });

  test.each([
    `let sessionOrError = await requireStaff(['ADMIN', 'ASSISTANTE']);
     if (isGuardError(sessionOrError)) return sessionOrError;`,
    `let sessionOrError = await requireStaff(['ADMIN', 'ASSISTANTE']);
     sessionOrError = Response.json({ items: [] }, { status: 200 });
     if (isGuardError(sessionOrError)) return sessionOrError;`,
    `const sessionOrError = await requireStaff(['ADMIN', 'ASSISTANTE']);
     const alias = sessionOrError;
     if (isGuardError(sessionOrError)) return sessionOrError;`,
    `const sessionOrError = await requireStaff(['ADMIN', 'ASSISTANTE']);
     sessionOrError.status = 200;
     if (isGuardError(sessionOrError)) return sessionOrError;`,
  ])('requires an adjacent immutable canonical RBAC result %#', (guardSetup) => {
    write('app/api/assistante/students/route.ts', `
      import { isErrorResponse as isGuardError, requireAnyRole as requireStaff } from '@/lib/guards';
      export async function GET(request: Request) {
        try {
          ${guardSetup}
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
      const route = '__LEAD_SEARCH__';
      async function GET(){await fetch(route);return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405})}
    `);
    write('.next/standalone/.next/server/app/api/assistante/students/route.js', `
      const route = '__STUDENT_DIRECTORY__?search=retired';
      async function GET(){await fetch(route);return Response.json({error:'SEARCH_REQUIRES_POST'},{status:405})}
    `);
    expect(run('artifact').status).toBe(0);
  });

  test('still rejects identical legacy GET consumers outside the two exact compiled providers', () => {
    write('.next/standalone/.next/server/app/api/other/route.js', `
      const route = '__LEAD_SEARCH__';
      async function GET(){await fetch(route);return Response.json({ok:true})}
    `);
    const result = run('artifact');
    expect(result.status).toBe(1);
    expect(result.output).toContain('LEGACY_GET_SEARCH_CONSUMERS=1');
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

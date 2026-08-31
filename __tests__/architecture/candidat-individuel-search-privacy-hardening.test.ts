import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const TEMPLATES = ['nginx/nginx.conf', 'nginx/nginx.local.conf'] as const;
const LOCATION_CONFIGS = [...TEMPLATES, 'ops/nginx/nexus-sensitive-locations.conf'] as const;
const SEARCH_PATHS = [
  '/api/assistante/candidat-individuel/students/search',
  '/api/assistante/candidat-individuel/leads/search',
  '/api/quotes/leads/search',
  '/api/assistante/stages/planning/students/search',
] as const;
const DANGEROUS_LOG_VARIABLES = ['$request_uri', '$args', '$query_string', '$request_body'] as const;

function source(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function withoutComments(config: string): string {
  return config.replace(/#.*$/gm, '');
}

function exactLocationBody(config: string, endpoint: string): string | null {
  const escaped = endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return config.match(new RegExp(`location\\s*=\\s*${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`))?.[1] ?? null;
}

describe('search PII Nginx and Playwright hardening', () => {
  test.each(TEMPLATES)('%s preserves redirect query strings without logging them', (template) => {
    const config = source(template);
    expect(withoutComments(config)).toMatch(/\breturn\s+30[18]\s+[^;]*\$request_uri\s*;/);
    for (const directive of withoutComments(config).match(/\b(?:log_format|access_log|error_log)\b[^;]*;/g) ?? []) {
      for (const variable of DANGEROUS_LOG_VARIABLES) expect(directive).not.toContain(variable);
    }
  });

  test.each(TEMPLATES)('%s preserves status visibility through the safe access log', (template) => {
    const config = withoutComments(source(template));
    expect(config).toContain('log_format nexus_safe');
    expect(config).toContain('$status');
    const accessLogs = config.match(/\baccess_log\b[^;]*;/g) ?? [];
    expect(accessLogs.length).toBeGreaterThan(0);
    for (const directive of accessLogs) {
      expect(directive).toMatch(/^access_log\s+(?:off|\S+\s+nexus_safe)\s*;$/);
    }
  });

  test.each(LOCATION_CONFIGS)('%s disables raw error logs for every exact staff search endpoint', (template) => {
    const config = source(template);
    for (const endpoint of SEARCH_PATHS) {
      const body = exactLocationBody(config, endpoint);
      expect(body).not.toBeNull();
      const activeBody = withoutComments(body ?? '');
      expect(activeBody).toMatch(/\berror_log\s+\/dev\/null\s+crit\s*;/);
      expect(activeBody).toMatch(/\bproxy_pass\b/);
      for (const directive of activeBody.match(/\baccess_log\b[^;]*;/g) ?? []) {
        expect(directive).toMatch(/^access_log\s+(?:off|\S+\s+nexus_safe)\s*;$/);
      }
    }
  });

  test('runtime guard passes the deployable templates and fails closed on an unsafe error-log surface', () => {
    const guard = path.join(ROOT, 'scripts/security/check-search-nginx-privacy.mjs');
    const safe = spawnSync(process.execPath, [guard, ...TEMPLATES], { cwd: ROOT, encoding: 'utf8' });
    expect({ status: safe.status, stdout: safe.stdout, stderr: safe.stderr }).toEqual({
      status: 0,
      stdout: 'OK: search Nginx privacy guard\n',
      stderr: '',
    });

    const directory = mkdtempSync(path.join(tmpdir(), 'nexus-nginx-privacy-'));
    const unsafe = path.join(directory, 'unsafe.conf');
    writeFileSync(unsafe, [
      "log_format nexus_safe '$request_method $uri $status';",
      'server {',
      ...SEARCH_PATHS.map((endpoint, index) => [
        `location = ${endpoint} {`,
        index === 0 ? 'error_log /tmp/raw-error.log warn;' : 'error_log /dev/null crit;',
        'proxy_pass http://app;',
        '}',
      ].join('\n')),
      '}',
      '',
    ].join('\n'));
    try {
      const rejected = spawnSync(process.execPath, [guard, unsafe], { cwd: ROOT, encoding: 'utf8' });
      expect(rejected.status).not.toBe(0);
      expect(rejected.stdout).not.toContain('/tmp/raw-error.log');
      expect(rejected.stderr).not.toContain('/tmp/raw-error.log');
      expect(rejected.stdout).toBe('');
      expect(rejected.stderr).toBe('FAIL: unsafe search Nginx privacy configuration\n');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('runtime guard ignores commented directives and rejects locations satisfied only by comments', () => {
    const guard = path.join(ROOT, 'scripts/security/check-search-nginx-privacy.mjs');
    const directory = mkdtempSync(path.join(tmpdir(), 'nexus-nginx-comments-'));
    const commented = path.join(directory, 'commented.conf');
    writeFileSync(commented, [
      "log_format nexus_safe '$request_method $uri $status';",
      'access_log /tmp/access.log nexus_safe;',
      'server {',
      ...SEARCH_PATHS.map((endpoint) => [
        `location = ${endpoint} {`,
        '# error_log /dev/null crit;',
        '# proxy_pass http://app;',
        '}',
      ].join('\n')),
      '}',
      '',
    ].join('\n'));
    try {
      const rejected = spawnSync(process.execPath, [guard, commented], { cwd: ROOT, encoding: 'utf8' });
      expect(rejected.status).not.toBe(0);
      expect(rejected.stdout).toBe('');
      expect(rejected.stderr).toBe('FAIL: unsafe search Nginx privacy configuration\n');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('authenticated Playwright disables artifacts and closes the context before privacy scanning', () => {
    const config = source('playwright.auth.config.ts');
    const spec = source('e2e/auth/candidat-individuel-pipeline.spec.ts');
    expect(config).not.toMatch(/\brecordHar\s*:/);
    expect(spec).not.toMatch(/\brecordHar\s*:/);
    expect(spec).toContain("test.use({ trace: 'off', screenshot: 'off', video: 'off' })");

    const contextClose = spec.indexOf('await page.context().close()');
    const artifactScan = spec.indexOf('scanSearchPrivacyArtifacts(', contextClose);
    expect(contextClose).toBeGreaterThan(-1);
    expect(artifactScan).toBeGreaterThan(contextClose);
  });
});

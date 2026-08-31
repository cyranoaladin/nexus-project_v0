import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

function safeLogFormat(source: string): string {
  const match = source.match(/log_format\s+nexus_safe[\s\S]*?;/);
  if (!match) throw new Error('NGINX_SAFE_LOG_FORMAT_MISSING');
  return match[0];
}

describe('candidat individuel search privacy freeze', () => {
  const nginxSources = [
    'nginx/nginx.conf',
    'nginx/nginx.local.conf',
    'ops/nginx/nexus-safe-log.conf',
  ].map(read);
  const handler = read('lib/quotes/candidat-individuel-staff-search-route.server.ts');
  const e2e = read('e2e/auth/candidat-individuel-pipeline.spec.ts');

  test('all deployable access-log formats use URI-only fields and a sanitized referrer', () => {
    for (const source of nginxSources) {
      const format = safeLogFormat(source);
      expect(format).toContain('$request_method $nexus_safe_uri $server_protocol');
      expect(format).not.toMatch(/\$(?:request_uri|args|query_string|request_body|request)(?:\b|[^a-z_])/);
      expect(source).toContain('map $uri $nexus_safe_uri');
      expect(source).toContain('default [PRESENT];');
      expect(source).not.toContain('default $http_referer;');
    }
  });

  test('search API sources never log bodies, queries, raw errors, or serializeError', () => {
    const routeSources = [
      'app/api/assistante/candidat-individuel/students/search/route.ts',
      'app/api/assistante/candidat-individuel/leads/search/route.ts',
      'app/api/assistante/stages/planning/students/search/route.ts',
      'app/api/quotes/leads/search/route.ts',
    ].map(read).join('\n');
    expect(routeSources).not.toMatch(/serializeError|console\.|searchParams|request\.url|nextUrl|logger\./);
    expect(handler).not.toMatch(/serializeError|console\.(?:log|info|warn)|catch\s*\(\s*(?:error|err)/);
    expect(handler.match(/console\.error\(/g)).toHaveLength(1);
    expect(handler).toContain("console.error({ operation, code: 'SEARCH_UNAVAILABLE', status:");
  });

  test('the browser privacy test disables sensitive artifacts and scans every leak surface', () => {
    expect(e2e).toContain("from '../helpers/search-privacy'");
    expect(e2e).toContain("trace: 'off', screenshot: 'off', video: 'off'");
    expect(e2e).toContain('attachSearchPrivacyObserver');
    expect(e2e).toContain('inspectDataLayer');
    expect(e2e).toContain('scanSearchPrivacyArtifacts');
  });
});

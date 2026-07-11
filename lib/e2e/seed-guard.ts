/**
 * Guard predicate for the e2e seed script.
 *
 * Legitimate invocation contexts:
 *   - gate-all.sh local:   127.0.0.1:5435/nexus_e2e
 *   - CI (.github/ci.yml): localhost:5433/nexus_e2e
 *   - docker-compose.e2e:  postgres-e2e:5432/nexus_e2e
 *
 * Rule: db MUST be nexus_e2e, host MUST be local or compose-internal.
 * Port is informational (logged, not checked).
 */

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres-e2e']);

export function isAllowedSeedTarget(url: string): { ok: boolean; host: string; port: string; db: string } {
  try {
    // postgresql://user:pass@host:port/db → replace scheme for URL parsing
    const parsed = new URL(url.replace(/^postgresql:/, 'http:'));
    const host = parsed.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
    const port = parsed.port || '5432';
    const db = parsed.pathname.replace(/^\//, '').split('?')[0];
    return { ok: ALLOWED_HOSTS.has(host) && db === 'nexus_e2e', host, port, db };
  } catch {
    return { ok: false, host: '(parse error)', port: '', db: '' };
  }
}

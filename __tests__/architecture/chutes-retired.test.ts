import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Chutes is retired from the platform's model integrations. This guard keeps
 * active code, deployment manifests and env templates free of any Chutes
 * endpoint, credential variable or client. It is not a text purge: historical
 * documents, the persisted `chutesRequestId` column name (a storage contract)
 * and the provider-exclusion module itself are outside its scope.
 */
const FORBIDDEN = /chutes\.ai|CHUTES_(?:API|BASE|FINGERPRINT)|chutes-client|ChutesClient|chutesClient|chutes-mcp/i;
const ROOTS = ['app', 'components', 'lib', 'services', 'scripts'];
const FILES = ['docker-compose.prod.yml', 'docker-compose.npc.yml', 'docker-compose.yml', '.env.example'];
const ALLOWED = new Set(['lib/llm/provider-exclusion.ts']);
const SKIP_DIRS = new Set(['node_modules', '.next', 'generated', '.git']);

function walk(root: string): string[] {
  const absolute = resolve(process.cwd(), root);
  let entries;
  try { entries = readdirSync(absolute, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const relative = `${root}/${entry.name}`;
    if (entry.isDirectory()) return walk(relative);
    return /\.(?:ts|tsx|js|mjs|cjs|json|ya?ml|sh|py|env|example)$/.test(entry.name) ? [relative] : [];
  });
}

describe('Chutes retirement guard', () => {
  it('has no active Chutes endpoint, credential variable or client', () => {
    const files = [...ROOTS.flatMap(walk), ...FILES.filter((file) => {
      try { return statSync(resolve(process.cwd(), file)).isFile(); } catch { return false; }
    })];
    const offenders = files
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => FORBIDDEN.test(readFileSync(resolve(process.cwd(), file), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('keeps the provider exclusion module as the single place that names the provider', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/llm/provider-exclusion.ts'), 'utf8');
    expect(source).toMatch(/Object\.freeze\(\['chutes'\]\)/);
  });
});

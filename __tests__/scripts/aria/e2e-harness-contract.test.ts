import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ARIA disposable browser qualification harness', () => {
  it('wires fixture, app and browser containers in fail-closed dependency order', () => {
    const compose = source('docker-compose.e2e.yml');
    expect(compose).toMatch(/aria-fixture-e2e:/);
    expect(compose).toMatch(/http:\/\/aria-fixture-e2e:4010\/health/);
    expect(compose).toMatch(/ARIA_MODEL_BASE_URL:\s*http:\/\/aria-fixture-e2e:4010\/v1/);
    expect(compose).toMatch(/ARIA_RAG_ENGINE_BASE_URL:\s*http:\/\/aria-fixture-e2e:4010/);
    expect(compose).toMatch(/ARIA_RAG_ACTIVE_MANIFEST_SHA256:\s*debbfb31c0a95e3e16ff33772f0626856e8dc01c52faab8270820b7f4374608a/);
    expect(compose).toMatch(/E2E_DISPOSABLE_STACK:\s*"1"/);
    expect(compose).not.toMatch(/SKIP_MIDDLEWARE/);
    expect(compose).not.toMatch(/aria-e2e-(?:admin|model|rag|identity).*-disposable/);
    expect(compose).toMatch(/\$\{ARIA_E2E_FIXTURE_ADMIN_TOKEN:\?/);
    expect(compose).toMatch(/\$\{ARIA_E2E_MODEL_API_KEY:\?/);
    expect(compose).toMatch(/\$\{RAG_BFF_SERVICE_TOKEN:\?/);
    expect(compose).toMatch(/\$\{NEXUS_INTERNAL_TOKEN_SECRET:\?/);
    const runtimeSecrets = source('scripts/aria/e2e-runtime-secrets.sh');
    expect(runtimeSecrets).toMatch(/openssl\s+rand\s+-hex\s+32/);
  });

  it('keeps the disposable PostgreSQL boundary private to its Docker network', () => {
    const compose = source('docker-compose.e2e.yml');
    const postgresBlock = compose.slice(
      compose.indexOf('  postgres-e2e:'),
      compose.indexOf('  # ─── 2. Redis'),
    );
    expect(postgresBlock).not.toMatch(/\n\s+ports:/);
    expect(compose).toMatch(
      /DATABASE_URL:\s*postgresql:\/\/postgres:postgres@postgres-e2e:5432\/nexus_e2e\?schema=public/,
    );
  });

  it('fails the E2E data setup when correctness-relevant persistence fails', () => {
    const dbHelpers = source('e2e/helpers/db.ts');
    expect(dbHelpers).not.toMatch(/\.catch\(\(\) => (?:undefined|null|\{\})\)/);
    expect(dbHelpers).toContain('ARIA_E2E_PARENT_CHILD_CLEANUP_INCOMPLETE');
  });

  it('packages runtime manifest data and the dedicated Playwright configuration', () => {
    expect(source('Dockerfile.e2e')).toMatch(/\/app\/data\/aria\s+\.\/data\/aria/);
    expect(source('Dockerfile.playwright')).toMatch(/playwright\.aria\.config\.ts/);
    expect(source('scripts/e2e-entrypoint.sh')).toMatch(/export E2E_DISPOSABLE_STACK=1/);
  });

  it('keeps browser-only sources out of the application image cache boundary', () => {
    expect(existsSync(resolve(process.cwd(), 'Dockerfile.e2e.dockerignore'))).toBe(true);
    const ignore = source('Dockerfile.e2e.dockerignore');
    expect(ignore).toMatch(/^e2e$/m);
    expect(ignore).toMatch(/^__tests__$/m);
    expect(ignore).toMatch(/^docs$/m);
    expect(ignore).toMatch(/^assets\/\*$/m);
    expect(ignore).toMatch(/^!assets\/campaigns\/pre-rentree-2026\/documents-final\/manifest\.json$/m);
    expect(source('Dockerfile.playwright')).toMatch(/COPY e2e \.\/e2e/);
  });

  it('uses allowlisted quoted Playwright arguments and reports teardown failures', () => {
    const entrypoint = source('scripts/playwright-entrypoint.sh');
    expect(entrypoint).toMatch(/PLAYWRIGHT_CONFIG/);
    expect(entrypoint).toMatch(/PLAYWRIGHT_PROJECT/);
    expect(entrypoint).toMatch(/args=\(/);
    expect(entrypoint).toMatch(/"\$\{args\[@\]\}"/);
    expect(entrypoint).not.toMatch(/PLAYWRIGHT_ARGS/);
    expect(source('scripts/run-e2e-ephemeral.sh')).not.toMatch(/\|\|\s*true/);
  });

  it('routes all ARIA browser commands through the disposable Docker wrapper', () => {
    expect(existsSync(resolve(process.cwd(), 'scripts/aria/run-e2e-suite.sh'))).toBe(true);
    const packageJson = JSON.parse(source('package.json')) as { scripts: Record<string, string> };
    expect(packageJson.scripts['test:aria:e2e:desktop']).toBe(
      'bash scripts/aria/run-e2e-suite.sh aria-desktop',
    );
    expect(packageJson.scripts['test:aria:e2e:mobile']).toBe(
      'bash scripts/aria/run-e2e-suite.sh aria-mobile',
    );
    expect(packageJson.scripts['test:aria:a11y']).toBe(
      'bash scripts/aria/run-e2e-suite.sh aria-a11y',
    );
    const wrapper = source('scripts/aria/run-e2e-suite.sh');
    expect(wrapper).toMatch(/--exit-code-from\s+playwright/);
    expect(wrapper).toMatch(/docker\s+compose\s+-f\s+docker-compose\.e2e\.yml\s+cp/);
    expect(wrapper).toMatch(/find\s+"\$artifact_dir"\s+-mindepth\s+1\s+-delete/);
    expect(wrapper).not.toMatch(/\|\|\s*true/);
  });

  it('has one real-backend suite without browser interception of conversation execution', () => {
    expect(existsSync(resolve(process.cwd(), 'e2e/auth/aria.chat.spec.ts'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'e2e/auth/student-aria.spec.ts'))).toBe(false);
    const conversation = source('e2e/aria/conversation.spec.ts');
    const visualA11y = source('e2e/aria/visual-a11y.spec.ts');
    expect(conversation).not.toMatch(/page\.route/);
    expect(conversation).toContain('ARIA_E2E_FIRST_DELTA_MISSING');
    expect(conversation).toContain("expect(replay.metadata.disposition).toBe('REPLAY')");
    expect(visualA11y).not.toMatch(/page\.route|route\.fulfill/);
    const helpers = source('e2e/aria/helpers.ts');
    expect(helpers).not.toMatch(/_rsc|isCancelledNextPrefetch/);
    expect(helpers).toMatch(/hydration/i);
    const ariaE2E = `${conversation}\n${visualA11y}`;
    expect(ariaE2E).toMatch(/@axe-core\/playwright/);
  });

  it('binds E001 through E026 exactly once and renders all eight states at every required viewport', () => {
    const browserSuites = [
      source('e2e/aria/conversation.spec.ts'),
      source('e2e/aria/visual-a11y.spec.ts'),
    ].join('\n');
    const identifiers = browserSuites.match(/\bE\d{3}\b/g) ?? [];
    expect(identifiers.sort()).toEqual(
      Array.from({ length: 26 }, (_, index) => `E${String(index + 1).padStart(3, '0')}`),
    );
    const visual = source('e2e/aria/visual-a11y.spec.ts');
    for (const viewport of ['390x844', '768x1024', '1366x768', '1440x900']) {
      expect(visual).toContain(viewport);
    }
    for (const state of [
      'ready', 'streaming', 'citations-visible', 'history-loaded',
      'feedback-submitted', 'rag-unavailable', 'timeout-error', 'course-unavailable',
    ]) {
      expect(visual).toContain(`'${state}'`);
    }
  });
});

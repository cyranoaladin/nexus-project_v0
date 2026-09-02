import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadConfiguredAriaServableManifest } from '@/lib/aria/infrastructure/rag/manifest';

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
    const playwrightImage = source('Dockerfile.playwright');
    expect(playwrightImage).toMatch(/playwright\.aria\.config\.ts/);
    expect(playwrightImage).toContain('COPY scripts/e2e ./scripts/e2e');
    expect(source('scripts/e2e-entrypoint.sh')).toMatch(/export E2E_DISPOSABLE_STACK=1/);
  });

  it('loads the exact digest and manifest root configured by the disposable app service', () => {
    const compose = source('docker-compose.e2e.yml');
    const root = /ARIA_RAG_SERVABLE_MANIFEST_ROOT:\s*\/app\/(\S+)/.exec(compose)?.[1];
    const digest = /ARIA_RAG_ACTIVE_MANIFEST_SHA256:\s*([0-9a-f]{64})/.exec(compose)?.[1];
    expect(root).toBeDefined();
    expect(digest).toBeDefined();
    expect(root).toBe('data/aria/testing/rag');
    const dockerfile = source('Dockerfile.e2e');
    expect(dockerfile).toContain(`${digest}.json`);
    expect(dockerfile).toContain(`${digest}.aria-rag-manifest`);

    const projectedRoot = mkdtempSync(join(tmpdir(), 'aria-e2e-runtime-manifest-'));
    try {
      writeFileSync(
        join(projectedRoot, `${digest}.aria-rag-manifest`),
        readFileSync(resolve(process.cwd(), root!, `${digest}.json`)),
      );
      expect(loadConfiguredAriaServableManifest({
        ARIA_RAG_SERVABLE_MANIFEST_ROOT: projectedRoot,
        ARIA_RAG_ACTIVE_MANIFEST_SHA256: digest,
      })).toMatchObject({ manifest_sha256: digest });
    } finally {
      rmSync(projectedRoot, { recursive: true, force: true });
    }
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
    expect(entrypoint).toMatch(/aria-desktop\|aria-mobile\|aria-a11y\|aria-smoke/);
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
    expect(packageJson.scripts['aria:smoke:production-artifact']).toBe(
      'bash scripts/aria/run-e2e-suite.sh aria-smoke',
    );
    const wrapper = source('scripts/aria/run-e2e-suite.sh');
    expect(wrapper).toMatch(/--exit-code-from\s+playwright/);
    expect(wrapper).toMatch(/docker\s+compose\s+-f\s+docker-compose\.e2e\.yml\s+cp/);
    expect(wrapper).toMatch(/find\s+"\$artifact_dir"\s+-mindepth\s+1\s+-delete/);
    expect(wrapper).toContain('[ -L "$artifact_dir" ]');
    expect(wrapper).toContain('npm run aria:visual-evidence:write');
    expect(wrapper).toContain('if [ "$project" = "aria-mobile" ]');
    expect(wrapper).not.toMatch(/\|\|\s*true/);
  });

  it('ARIA_E2E_ARTIFACT_HEAD_BINDS_THE_SOURCE_SNAPSHOT_AT_RUN_START', () => {
    const wrapper = source('scripts/aria/run-e2e-suite.sh');
    const capturedHead = wrapper.indexOf('run_head="$(git rev-parse HEAD)"');
    const execution = wrapper.indexOf('up --build --abort-on-container-exit');
    const sealedHead = wrapper.lastIndexOf('printf \'%s\\n\' "$run_head" > "$artifact_dir/head.sha"');
    const primaryFailure = wrapper.indexOf('if [ "$test_status" -ne 0 ]');
    const visualSeal = wrapper.indexOf('npm run aria:visual-evidence:write');
    expect(capturedHead).toBeGreaterThanOrEqual(0);
    expect(execution).toBeGreaterThan(capturedHead);
    expect(sealedHead).toBeGreaterThan(execution);
    expect(primaryFailure).toBeGreaterThan(sealedHead);
    expect(wrapper).toContain('[ "$current_head" != "$run_head" ]');
    expect(visualSeal).toBeGreaterThan(wrapper.indexOf('if [ "$source_status" -ne 0 ]'));
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

  it('ARIA_XSS_BROWSER_REQUEST_ASSERTION_ALLOWLISTS_ONLY_HTTP_TRANSPORTS', () => {
    const conversation = source('e2e/aria/conversation.spec.ts');
    const fixture = source('scripts/e2e/aria-fixture-provider.ts');
    expect(fixture).toContain('vbscript:msgbox(1)');
    expect(conversation).toContain("protocol === 'http:' || protocol === 'https:'");
    expect(conversation).not.toContain("url.startsWith('javascript:') || url.startsWith('data:')");
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

  it('ARIA_VISUAL_CAPTURE_RUNS_LAYOUT_AXE_SCREENSHOT_ATTACHMENT', () => {
    const visual = source('e2e/aria/visual-a11y.spec.ts');
    const capture = visual.slice(
      visual.indexOf('async function captureState'),
      visual.indexOf('async function qualifyVisualViewport'),
    );
    const layout = capture.indexOf('await assertQualifiedLayout(page)');
    const axe = capture.indexOf('await assertNoSeriousOrCriticalA11y(page)');
    const screenshot = capture.indexOf('await page.screenshot(');
    const attachment = capture.indexOf('await testInfo.attach(');
    expect(layout).toBeGreaterThanOrEqual(0);
    expect(axe).toBeGreaterThan(layout);
    expect(screenshot).toBeGreaterThan(axe);
    expect(attachment).toBeGreaterThan(screenshot);
    expect(capture).toContain("contentType: 'image/png'");
    expect(capture).toContain("scale: 'css'");
  });

  it('ARIA_CHAT_AXE_SCAN_IS_SCOPED_TO_THE_ACTIVE_DIALOG_WITHOUT_DISABLED_RULES', () => {
    const visual = source('e2e/aria/visual-a11y.spec.ts');
    const assertion = visual.slice(
      visual.indexOf('async function assertNoSeriousOrCriticalA11y'),
      visual.indexOf("test.describe.serial('ARIA-B visual and accessibility qualification'"),
    );
    expect(assertion).toContain(".include('[role=\"dialog\"]')");
    expect(assertion).not.toMatch(/disableRules|withRules|options\s*\(/);
  });

  it('ARIA_VISUAL_DIAGNOSTICS_COVER_INITIAL_NAVIGATION', () => {
    const visual = source('e2e/aria/visual-a11y.spec.ts');
    const qualify = visual.slice(
      visual.indexOf('async function qualifyVisualViewport'),
      visual.indexOf('async function assertNoSeriousOrCriticalA11y'),
    );
    const diagnostics = qualify.indexOf('captureBrowserDiagnostics(page)');
    const navigation = qualify.indexOf("loginAndOpenAria(page, 'ariaNsi')");
    expect(diagnostics).toBeGreaterThanOrEqual(0);
    expect(navigation).toBeGreaterThan(diagnostics);
  });
});

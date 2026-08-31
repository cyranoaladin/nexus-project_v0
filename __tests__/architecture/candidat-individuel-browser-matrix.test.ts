import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertCandidateStudentAnchorSemantics } from '@/scripts/testing/candidat-keyboard-semantics';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8');

describe('candidat individuel governed browser matrix', () => {
  const chromeVersion = '152.0.7977.64';
  const bundledChromiumVersion = '145.0.7632.6';
  const chromeDebSha256 = '4eae0736a812d9bc851cd2937f7af00e47dbaf8305845eed452703ff009873c7';

  it('pins and checksum-verifies the exact Google Chrome package without a latest fallback', () => {
    const installerPath = 'scripts/e2e/install-governed-chrome.sh';
    expect(existsSync(join(root, installerPath))).toBe(true);
    const installer = read(installerPath);

    expect(installer).toContain(`CHROME_VERSION='${chromeVersion}'`);
    expect(installer).toContain("CHROME_PACKAGE_VERSION='152.0.7977.64-1'");
    expect(installer).toContain(chromeDebSha256);
    expect(installer).toContain('google-chrome-stable_152.0.7977.64-1_amd64.deb');
    expect(installer).toContain('sha256sum --check --strict');
    expect(installer).toContain("sed -E 's/^Google Chrome[[:space:]]+//; s/[[:space:]]+$//'");
    expect(installer).toContain("dpkg --print-architecture");
    expect(installer).toContain("CACHE_ROOT=");
    expect(installer).toContain("nexus-governed-browsers");
    expect(installer).toContain('if [ ! -f "$deb_path" ]');
    const cacheMissEnd = installer.indexOf('\nfi', installer.indexOf('if [ ! -f "$deb_path" ]'));
    expect(cacheMissEnd).toBeGreaterThan(-1);
    expect(installer.slice(cacheMissEnd)).toContain('verify_deb "$deb_path"');
    expect(installer).not.toMatch(/_current_|apt-get install[^\n]*google-chrome|channel:\s*['\"]chrome/);
  });

  it('does not globally preload fonts that candidate dashboard routes may not consume', () => {
    const rootLayout = read('app/layout.tsx');
    expect(rootLayout.match(/localFont\(\{/g)).toHaveLength(5);
    expect(rootLayout.match(/preload:\s*false/g)).toHaveLength(5);
  });

  it('launches each explicit binary and compares browser.version exactly before candidate specs', () => {
    const config = read('playwright.candidat-individuel.config.ts');
    const preflight = read('e2e/auth/candidat-individuel-browser-preflight.setup.ts');

    expect(config).toContain("name: 'preflight-bundled-chromium'");
    expect(config).toContain("name: 'preflight-google-chrome-152'");
    expect(config).toContain("name: 'candidate-bundled-chromium'");
    expect(config).toContain("name: 'candidate-google-chrome-152'");
    expect(config).toContain("dependencies: ['preflight-bundled-chromium']");
    expect(config).toContain("dependencies: ['preflight-google-chrome-152']");
    expect(config).toContain("executablePath: chromium.executablePath()");
    expect(config).toContain("executablePath: '/usr/bin/google-chrome-stable'");
    expect(config).toContain(`expectedBrowserVersion: '${bundledChromiumVersion}'`);
    expect(config).toContain(`expectedBrowserVersion: '${chromeVersion}'`);
    expect(config).toContain("trace: 'off'");
    expect(config).toContain("screenshot: 'off'");
    expect(config).toContain("video: 'off'");
    expect(config).not.toMatch(/channel:\s*['\"]chrome/);
    expect(preflight).toContain('browser.version()');
    expect(preflight).toContain('toBe(expectedBrowserVersion)');
  });

  it('runs the candidate suite in both governed lanes from CI after provisioning', () => {
    const workflow = read('.github/workflows/ci.yml');
    const authJobStart = workflow.indexOf('\n  e2e-auth:');
    const authJobEnd = workflow.indexOf('\n  security:', authJobStart);
    const authJob = workflow.slice(authJobStart, authJobEnd);
    const installerPosition = authJob.indexOf('scripts/e2e/install-governed-chrome.sh');
    const candidatePosition = authJob.indexOf('--config=playwright.candidat-individuel.config.ts');

    expect(authJobStart).toBeGreaterThan(-1);
    expect(authJobEnd).toBeGreaterThan(authJobStart);
    expect(installerPosition).toBeGreaterThan(-1);
    expect(candidatePosition).toBeGreaterThan(installerPosition);
    expect(authJob).toContain('timeout-minutes: 90');
    expect(authJob).toContain('timeout-minutes: 25');
    expect(authJob).toContain('timeout-minutes: 35');
    expect(authJob).toContain('~/.cache/nexus-governed-browsers');
    expect(authJob).toContain('governed-chrome-152.0.7977.64-deb-sha256-4eae0736a812d9bc851cd2937f7af00e47dbaf8305845eed452703ff009873c7');
    expect(authJob).toContain('~/.cache/ms-playwright');
    expect(authJob).toContain('playwright-1.58.1-chromium-1208');
    expect(authJob.match(/uses: actions\/cache@0057852bfaa89a56745cba8c7296529d2fc39830/g)).toHaveLength(2);
    expect(authJob).not.toContain('restore-keys:');
    expect(authJob).toContain("--project=candidate-bundled-chromium");
    expect(authJob).toContain("--project=candidate-google-chrome-152");
    expect(authJob).toContain("--grep-invert 'Candidat individuel'");
  });

  it('governs lifecycle, interaction, responsive, diagnostics and quarantine coverage', () => {
    const spec = read('e2e/auth/candidat-individuel-pipeline.spec.ts');
    const diagnostics = read('e2e/helpers/candidat-browser-diagnostics.ts');
    const lifecycle = read('e2e/helpers/candidat-browser-lifecycle.ts');
    const lifecycleStart = spec.indexOf("test('cycle navigateur gouverné");
    const lifecycleEnd = spec.indexOf('\n  test(', lifecycleStart + 10);
    const creationStart = spec.indexOf('test("le CTA ADMIN crée une famille réelle');
    const creationEnd = spec.indexOf('\n  test(', creationStart + 10);
    const navigationStart = spec.indexOf("test('navigation ADMIN et ASSISTANTE");
    const navigationEnd = spec.indexOf('\n  test(', navigationStart + 10);
    const lifecycleScenario = spec.slice(lifecycleStart, lifecycleEnd);
    const creationScenario = spec.slice(creationStart, creationEnd);
    const navigationScenario = spec.slice(navigationStart, navigationEnd);

    expect(lifecycleStart).toBeGreaterThan(-1);
    expect(lifecycleEnd).toBeGreaterThan(lifecycleStart);
    expect(creationStart).toBeGreaterThan(-1);
    expect(creationEnd).toBeGreaterThan(creationStart);
    expect(navigationStart).toBeGreaterThan(-1);
    expect(navigationEnd).toBeGreaterThan(navigationStart);
    expect(spec).toContain('cycle navigateur gouverné');
    expect(lifecycleScenario).toContain('testInfo.setTimeout(140_000)');
    expect(lifecycleScenario).toMatch(/await \w+\.waitForTimeout\(61_000\)/);
    expect(spec).toContain("import { hardReloadWithoutCache } from '../helpers/candidat-browser-lifecycle'");
    expect(lifecycleScenario).toContain('await hardReloadWithoutCache(freshPage)');
    expect(spec).toContain("page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 })");
    expect(lifecycleScenario).not.toMatch(/\.reload\s*\(/);
    const lifecycleShutdownNetworkIdle = lifecycleScenario.lastIndexOf("await freshPage.waitForLoadState('networkidle')");
    const lifecycleShutdownHealth = lifecycleScenario.lastIndexOf("await freshPage.goto('/api/health', { waitUntil: 'domcontentloaded' })");
    const lifecycleContextClose = lifecycleScenario.lastIndexOf('await freshContext.close()');
    expect(lifecycleShutdownNetworkIdle).toBeGreaterThan(-1);
    expect(lifecycleShutdownHealth).toBeGreaterThan(lifecycleShutdownNetworkIdle);
    expect(lifecycleContextClose).toBeGreaterThan(lifecycleShutdownHealth);
    expect(lifecycle).toContain("session.send('Network.setCacheDisabled', { cacheDisabled: true })");
    expect(lifecycle).toContain("session.send('Network.setCacheDisabled', { cacheDisabled: false })");
    expect(lifecycle).toContain('const cleanupErrors: unknown[] = []');
    expect(lifecycle).toContain('[primaryError, ...cleanupErrors]');
    expect(lifecycle).toContain('.cause = primaryError');
    expect(spec).toMatch(/width:\s*1440/);
    expect(spec).toMatch(/width:\s*768/);
    expect(spec).toMatch(/width:\s*390/);
    expect(lifecycleScenario).toMatch(/\w+\.keyboard\.press\('Tab'\)/);
    expect(lifecycleScenario).toMatch(/\w+\.keyboard\.press\('Enter'\)/);
    expect(lifecycleScenario).toMatch(/\w+\.keyboard\.press\('Space'\)/);
    expect(lifecycleScenario).toContain('leadSearch.pressSequentially(identity.parentFirstName');
    expect(lifecycleScenario).toContain('studentSearch.pressSequentially(identity.studentFirstName');
    expect(creationScenario).toContain("getByRole('button', { name: 'Annuler la création', exact: true })");
    expect(creationScenario).toContain('await expect(safeCancelButton).toBeFocused()');
    expect(creationScenario).toContain('await expect(confirmCreationButton).toBeFocused()');
    expect(creationScenario).toContain("await page.keyboard.press('Tab')");
    expect(creationScenario).toContain("await page.keyboard.press('Space')");
    expect(spec).toContain("message.type() !== 'error' && message.type() !== 'warning'");
    expect(spec).toContain('consoleAndPageErrors');
    expect(spec).toContain("await page.goto('/api/health', { waitUntil: 'domcontentloaded' })");
    expect(spec).not.toContain("page.goto('about:blank')");
    expect(navigationScenario.indexOf("await page.waitForLoadState('networkidle')"))
      .toBeGreaterThan(-1);
    expect(navigationScenario.indexOf("await page.waitForLoadState('networkidle')"))
      .toBeLessThan(navigationScenario.indexOf("await page.goto('/api/health', { waitUntil: 'domcontentloaded' })"));
    expect(navigationScenario.indexOf("await page.goto('/api/health', { waitUntil: 'domcontentloaded' })"))
      .toBeGreaterThan(-1);
    expect(navigationScenario.indexOf("await page.goto('/api/health', { waitUntil: 'domcontentloaded' })"))
      .toBeLessThan(navigationScenario.indexOf('await context.clearCookies()'));
    expect(spec).toContain("record.kind === 'console' || record.kind === 'pageerror'");
    expect(spec).toContain("request.method() === 'POST'");
    expect(diagnostics).toContain("EXPECTED_REQUEST_ABORT");
    expect(spec).not.toMatch(/test\.(?:skip|fixme)|describe\.skip/);
  });

  it('gouverne par AST les ancres candidat et ignore commentaires ou chaines globales', () => {
    const component = read('components/dashboard/staff/StudentsManagementWorkspace.tsx');
    expect(assertCandidateStudentAnchorSemantics(component)).toEqual([
      'Utiliser pour ce devis',
      'Utiliser pour un devis candidat individuel',
    ]);

    const decoy = `
      const copy = 'Utiliser pour ce devis';
      // <a href={getCandidateSimulatorPath(staffRole)}>Utiliser pour un devis candidat individuel</a>
      export function Decoy() { return <div>Sans action candidat</div>; }
    `;
    expect(() => assertCandidateStudentAnchorSemantics(decoy)).toThrow('CANDIDATE_ANCHOR_COUNT_INVALID');

    for (const tag of ['Button', 'Link']) {
      expect(() => assertCandidateStudentAnchorSemantics(`
        export function Invalid() {
          return <${tag} href={getCandidateSimulatorPath(staffRole)}>Utiliser pour ce devis</${tag}>;
        }
      `)).toThrow('CANDIDATE_ACTION_NOT_NATIVE_ANCHOR');
    }

    expect(() => assertCandidateStudentAnchorSemantics(`
      export function Invalid() {
        return <a href={getCandidateSimulatorPath(staffRole)} onKeyDown={() => undefined}>Utiliser pour ce devis</a>;
      }
    `)).toThrow('CANDIDATE_ANCHOR_CUSTOM_KEYBOARD_HANDLER');
  });
});

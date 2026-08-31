import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
    expect(installer).toContain("dpkg --print-architecture");
    expect(installer).not.toMatch(/_current_|apt-get install[^\n]*google-chrome|channel:\s*['\"]chrome/);
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
    expect(authJob).toContain('timeout-minutes: 60');
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
    const creationEnd = spec.indexOf("\n  test('workflow contextuel", creationStart);
    const contextualStart = creationEnd;
    const contextualEnd = spec.indexOf("\n  test('pages Élèves normales", contextualStart);
    const lifecycleScenario = spec.slice(lifecycleStart, lifecycleEnd);
    const creationScenario = spec.slice(creationStart, creationEnd);
    const contextualScenario = spec.slice(contextualStart, contextualEnd);

    expect(lifecycleStart).toBeGreaterThan(-1);
    expect(lifecycleEnd).toBeGreaterThan(lifecycleStart);
    expect(creationStart).toBeGreaterThan(-1);
    expect(creationEnd).toBeGreaterThan(creationStart);
    expect(contextualEnd).toBeGreaterThan(contextualStart);
    expect(spec).toContain('cycle navigateur gouverné');
    expect(lifecycleScenario).toContain('testInfo.setTimeout(140_000)');
    expect(lifecycleScenario).toMatch(/await \w+\.waitForTimeout\(61_000\)/);
    expect(spec).toContain("import { hardReloadWithoutCache } from '../helpers/candidat-browser-lifecycle'");
    expect(lifecycleScenario).toContain('await hardReloadWithoutCache(freshPage)');
    expect(lifecycleScenario).not.toMatch(/\.reload\s*\(/);
    expect(lifecycle).toContain("session.send('Network.setCacheDisabled', { cacheDisabled: true })");
    expect(lifecycle).toContain("session.send('Network.setCacheDisabled', { cacheDisabled: false })");
    expect(lifecycle).toContain('finally');
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
    expect(contextualScenario).toContain("getByRole('link', { name: 'Utiliser pour ce devis', exact: true })");
    expect(contextualScenario).toContain("await page.keyboard.press('Shift+Tab')");
    expect(contextualScenario).toContain("await page.keyboard.press('Tab')");
    expect(contextualScenario).toContain("await page.keyboard.press('Enter')");
    expect(spec).toContain("message.type() !== 'error' && message.type() !== 'warning'");
    expect(spec).toContain('consoleAndPageErrors');
    expect(spec).toContain("record.kind === 'console' || record.kind === 'pageerror'");
    expect(spec).toContain("request.method() === 'POST'");
    expect(diagnostics).toContain("EXPECTED_REQUEST_ABORT");
    expect(spec).not.toMatch(/test\.(?:skip|fixme)|describe\.skip/);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8');

describe('ephemeral E2E bootstrap contract', () => {
  it('pins the Playwright runner to the same approved Node and npm contract', () => {
    const dockerfile = read('Dockerfile.playwright');

    expect(dockerfile).toContain('NODE_VERSION=22.23.1');
    expect(dockerfile).toContain('7a8cb04b4a1df4eaf432125324b81b29a088e73570a23259a8de1c65d07fc129');
    expect(dockerfile).toContain('sha256sum --check');
    expect(dockerfile).toContain('npm@10.9.8');
    expect(dockerfile).toContain('FROM mcr.microsoft.com/playwright:v1.58.1-noble');
    expect(dockerfile).toContain('test "$(node --version)" = "v22.23.1"');
    expect(dockerfile).toContain('test "$(npm --version)" = "10.9.8"');
  });

  it('fails closed before starting the application when migrate, seed, or verification fails', () => {
    const entrypoint = read('scripts/e2e-entrypoint.sh');
    const seedPosition = entrypoint.indexOf('scripts/seed-e2e-db.ts');
    const verifyPosition = entrypoint.indexOf('scripts/verify-e2e-seed.ts');
    const serverPosition = entrypoint.indexOf('exec node server.js');

    expect(entrypoint).toContain('set -euo pipefail');
    expect(entrypoint).not.toContain('prisma db seed');
    expect(entrypoint).not.toContain('|| echo');
    expect(seedPosition).toBeGreaterThan(-1);
    expect(verifyPosition).toBeGreaterThan(seedPosition);
    expect(serverPosition).toBeGreaterThan(verifyPosition);
  });

  it('ships every TypeScript resolution input needed by the runtime seed', () => {
    const dockerfile = read('Dockerfile.e2e');
    const seed = read('scripts/seed-e2e-db.ts');
    const migrationHelper = read('scripts/migrate-eam.ts');

    expect(dockerfile).toMatch(/COPY --from=builder \/app\/tsconfig\.json \.\/tsconfig\.json/);
    expect(seed).not.toMatch(/from ['"]@\//);
    expect(migrationHelper).not.toMatch(/from ['"]@\//);
  });

  it('ships the canonical HTML-to-PDF runtime in the application image', () => {
    const dockerfile = read('Dockerfile.e2e');

    expect(dockerfile).toMatch(/RUN apk add --no-cache chromium/);
    expect(dockerfile).toContain('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser');
  });

  it('requires a verified shared credentials manifest before Playwright starts', () => {
    const appEntrypoint = read('scripts/e2e-entrypoint.sh');
    const playwrightEntrypoint = read('scripts/playwright-entrypoint.sh');
    const credentialsHelper = read('e2e/helpers/credentials.ts');
    const compose = read('docker-compose.e2e.yml');

    expect(existsSync(join(root, 'scripts/verify-e2e-seed.ts'))).toBe(true);
    expect(appEntrypoint).toContain('/app/e2e-shared/.credentials.json');
    expect(playwrightEntrypoint).toContain('ERROR: credentials manifest');
    expect(playwrightEntrypoint).not.toContain('WARNING: No credentials');
    expect(playwrightEntrypoint).not.toContain('cp /app/e2e-shared/.credentials.json');
    expect(credentialsHelper).toContain('process.env.E2E_CREDENTIALS_PATH');
    expect(compose).toContain('E2E_CREDENTIALS_PATH: /app/e2e-shared/.credentials.json');
  });

  it('seeds the coach-to-student relation required by the NPC workflow', () => {
    const seed = read('scripts/seed-e2e-db.ts');

    expect(seed).toContain('prisma.coachStudentAssignment.create');
    expect(seed).toContain('coachId: coach.coachProfile.id');
    expect(seed).toContain('studentId: primaryStudent.id');
    expect(seed).toContain("title: 'NPC E2E — copie affectée'");
    expect(seed).toContain("title: 'NPC E2E — copie hors affectation'");
  });

  it('isolates rate-limit cleanup to the disposable E2E Redis service', () => {
    const compose = read('docker-compose.e2e.yml');
    const resetHelper = read('e2e/helpers/rate-limit.ts');

    expect(compose).toContain('E2E_DISPOSABLE_REDIS_URL: redis://redis-e2e:6379/0');
    expect(resetHelper).toContain("url.hostname !== 'redis-e2e'");
    expect(resetHelper).toContain("process.env.E2E_DISPOSABLE_STACK !== '1'");
    expect(resetHelper).toContain('flushDb');
  });

  it('uses the hermetic E2E config for both full and targeted runs', () => {
    const entrypoint = read('scripts/playwright-entrypoint.sh');
    expect(entrypoint.match(/npx playwright test --config playwright\.config\.e2e\.ts/g)).toHaveLength(2);
  });

  it('enforces the quarantine guard in CI and runs the hermetic suite without retries', () => {
    const workflow = read('.github/workflows/ci.yml');
    const config = read('playwright.config.e2e.ts');

    expect(workflow).toContain('npm run check:test-quarantines');
    expect(workflow).toContain("E2E_DISPOSABLE_STACK: '1'");
    expect(config).toMatch(/retries:\s*0/);
  });

  it('collects every hermetic E2E tree and excludes only the two documented external lanes', () => {
    const config = read('playwright.config.e2e.ts');

    expect(config).toContain("'__tests__/e2e/**/*.spec.ts'");
    expect(config).toContain("'e2e/**/*.spec.ts'");
    expect(config).toContain("'e2e/candidate-diagnostic.spec.ts'");
    expect(config).toContain("'e2e/real/coach-resource-student.spec.ts'");
    expect(config).not.toContain("'e2e/auth/**/*.spec.ts'");
    expect(config).not.toContain("'e2e/axe-spot-check.spec.ts'");
  });

  it('marks every historical auth launcher as disposable before importing mutating helpers', () => {
    const gateAll = read('scripts/gate-all.sh');
    const gateAuth = read('scripts/gate-auth-e2e.sh');
    const packageJson = read('package.json');

    expect(gateAll).toContain('export E2E_DISPOSABLE_STACK=1');
    expect(gateAuth).toContain('export E2E_DISPOSABLE_STACK=1');
    expect(packageJson).toMatch(/"test:e2e:full":\s*"npm run test:e2e:ephemeral"/);
  });

  it('derives disposable payment fixtures from the operational catalog', () => {
    const dbHelper = read('e2e/helpers/db.ts');

    expect(dbHelper).toContain("getOperationalSubscriptionPlan('HYBRIDE')");
    expect(dbHelper).not.toMatch(/amount:\s*450\b/);
    expect(dbHelper).not.toMatch(/(?:subtotal|total|paidAmount|unitPrice):\s*450000\b/);
  });

  it('always tears the disposable stack down, including after a failing test run', () => {
    expect(existsSync(join(root, 'scripts/run-e2e-ephemeral.sh'))).toBe(true);
    const runner = read('scripts/run-e2e-ephemeral.sh');
    const packageJson = read('package.json');

    expect(runner).toContain('trap cleanup EXIT INT TERM');
    expect(runner).toContain('down -v --remove-orphans');
    expect(packageJson).toContain('bash scripts/run-e2e-ephemeral.sh');
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8');

describe('ephemeral E2E bootstrap contract', () => {
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
});

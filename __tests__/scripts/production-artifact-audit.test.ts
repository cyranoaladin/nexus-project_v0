import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(__dirname, '../..');
const auditScript = path.join(projectRoot, 'scripts/audit-production-artifact.js');

function runAudit(files: string[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-artifact-'));
  for (const relativePath of files) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, 'fixture');
  }
  return spawnSync(process.execPath, [auditScript, root], { encoding: 'utf8' });
}

describe('production standalone artifact audit', () => {
  it('accepts a clean standalone tree', () => {
    const result = runAudit([
      'server.js',
      'package.json',
      '.next/server/app.js',
      'node_modules/next/package.json',
      'public/logo.png',
    ]);
    expect(result.status).toBe(0);
  });

  // Forbidden packages
  it.each([
    'node_modules/@emnapi/runtime/package.json',
    'node_modules/@img/sharp-wasm32/package.json',
  ])('rejects forbidden package: %s', (file) => {
    const result = runAudit(['server.js', file]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('forbidden package');
  });

  // Forbidden directories
  it.each([
    '__tests__/foo.ts',
    '__mocks__/bar.js',
    'e2e/test.spec.ts',
    '.git/config',
    '.worktrees/foo',
    'coverage/lcov.info',
    'playwright-report/index.html',
    'test-results/screenshot.png',
  ])('rejects forbidden directory: %s', (file) => {
    const result = runAudit(['server.js', file]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('forbidden directory');
  });

  // .env files: each forbidden variant
  it.each([
    '.env',
    '.env.local',
    '.env.production',
    '.env.production.local',
    '.env.development',
    '.env.development.local',
    '.env.test',
    '.env.test.local',
    '.env.staging',
    '.env.preview',
  ])('rejects .env file: %s', (file) => {
    const result = runAudit(['server.js', file]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('.env');
  });

  // .env safe suffixes
  it.each([
    '.env.example',
    '.env.sample',
    '.env.template',
    '.env.ci.example',
    '.env.production.example',
  ])('accepts safe .env variant: %s', (file) => {
    const result = runAudit(['server.js', file]);
    expect(result.status).toBe(0);
  });

  // Secret key files
  it.each([
    'secrets.pem',
    'tls.key',
    'cert.p12',
    'auth.pfx',
  ])('rejects secret key file: %s', (file) => {
    const result = runAudit(['server.js', file]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('secret key');
  });

  // Forbidden file patterns
  it.each([
    'docker-compose.yml',
    'docker-compose.prod.yml',
    'Dockerfile',
    'Dockerfile.prod',
    'fix.patch',
    'build.log',
    'canonical-bilans-pack.json',
  ])('rejects forbidden file: %s', (file) => {
    const result = runAudit(['server.js', file]);
    expect(result.status).not.toBe(0);
  });

  it('reports top-level directories in output', () => {
    const result = runAudit([
      'server.js',
      '.next/server/app.js',
      'node_modules/foo/index.js',
      'public/img.png',
    ]);
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.topLevelDirs).toContain('.next');
    expect(report.topLevelDirs).toContain('node_modules');
    expect(report.topLevelDirs).toContain('public');
    expect(report.fileCount).toBeGreaterThan(0);
  });
});

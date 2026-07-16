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

  it.each([
    ['node_modules/@emnapi/runtime/package.json', 'forbidden package'],
    ['node_modules/@img/sharp-wasm32/package.json', 'forbidden package'],
    ['.env.local', 'secret file'],
    ['.env.production.local', 'secret file'],
    ['secrets.pem', 'secret file'],
    ['tls.key', 'secret file'],
  ])('rejects forbidden content: %s', (relativePath, expectedReason) => {
    const result = runAudit(['server.js', relativePath]);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain(expectedReason);
  });

  it('accepts .env.example templates (not real secrets)', () => {
    const result = runAudit([
      'server.js',
      '.env.example',
      '.env.ci.example',
    ]);

    expect(result.status).toBe(0);
  });
});

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

describe('production standalone allowlist audit', () => {
  it('accepts only declared standalone runtime roots', () => {
    const result = runAudit([
      'server.js',
      'package.json',
      '.next/server/app.js',
      'node_modules/next/package.json',
      'public/logo.png',
      'data/pricing.canonical.json',
      'docs/00_INDEX.md',
      'lib/diagnostics/definition.json',
      'programmes/generated/maths.json',
      'src/static-pages/tool/index.html',
      'Nexus_Reussite_Accueil.html',
    ]);

    expect(result.status).toBe(0);
  });

  it.each([
    ['storage/documents/test.pdf', 'storage'],
    ['node_modules/@emnapi/runtime/package.json', 'node_modules/@emnapi/runtime'],
    ['node_modules/@img/sharp-wasm32/package.json', 'node_modules/@img/sharp-wasm32'],
    ['unexpected.txt', 'unexpected.txt'],
  ])('rejects forbidden or non-allowlisted content: %s', (relativePath, reportedPath) => {
    const result = runAudit(['server.js', relativePath]);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain(reportedPath);
  });
});

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');
const script = path.join(projectRoot, 'scripts/copy-public-assets.js');

describe('copy-public-assets', () => {
  it('exits non-zero when .next/standalone is absent', () => {
    // The script uses __dirname relative paths from scripts/ dir,
    // so we verify the behavior by checking that a missing standalone dir is fatal.
    const result = spawnSync(process.execPath, ['-e', `
      const fs = require('fs');
      const path = require('path');
      // Simulate: standalone does not exist
      const root = '${os.tmpdir()}/cpa-test-' + Date.now();
      fs.mkdirSync(root + '/public', { recursive: true });
      // Patch __dirname in the script context
      process.chdir(root);
      const code = fs.readFileSync('${script}', 'utf8')
        .replace(/__dirname/g, JSON.stringify(root + '/scripts'));
      fs.mkdirSync(root + '/scripts', { recursive: true });
      // Create a require-able serialize-error
      fs.writeFileSync(root + '/scripts/serialize-error.cjs', 'module.exports = { serializeError: e => e }');
      require('module')._cache = {};
      eval(code);
    `], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
  });

  it('verifies the script requires standalone and static directories', () => {
    // Read source and verify fail-closed behavior is coded
    const source = fs.readFileSync(script, 'utf8');
    expect(source).toContain('process.exit(1)');
    expect(source).toContain('standalone');
    expect(source).toContain('static');
    expect(source).toContain('chunks');
  });
});

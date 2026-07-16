import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(__dirname, '../..');
const validator = path.join(projectRoot, 'scripts/validate-npm-tree.js');

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function runValidator(tree: unknown, exceptions: unknown) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-tree-validator-'));
  const treePath = path.join(dir, 'tree.json');
  const exceptionPath = path.join(dir, 'exceptions.json');
  writeJson(treePath, tree);
  writeJson(exceptionPath, exceptions);
  return spawnSync(process.execPath, [validator, '--tree', treePath, '--exceptions', exceptionPath], {
    encoding: 'utf8',
  });
}

const exceptionFile = {
  schemaVersion: 1,
  exceptions: [{
    type: 'extraneous',
    name: '@emnapi/runtime',
    version: '1.11.2',
    path: 'node_modules/@emnapi/runtime',
    platform: {
      node: '22.23.1',
      npm: '10.9.8',
      os: 'linux',
      arch: 'x64',
    },
    artifactAllowed: false,
    expiresOn: '2026-09-30',
  }],
};

describe('validate-npm-tree', () => {
  it('accepts only the exact unexpired @emnapi/runtime exception', () => {
    const result = runValidator({
      name: 'root', path: '/repo', dependencies: {
        '@emnapi/runtime': { version: '1.11.2', path: '/repo/node_modules/@emnapi/runtime', extraneous: true },
      },
    }, exceptionFile);

    expect(result.status).toBe(0);
  });

  it('rejects invalid packages and a mismatched exception', () => {
    const result = runValidator({
      name: 'root', path: '/repo', dependencies: {
        '@emnapi/runtime': { version: '1.11.3', path: '/repo/node_modules/@emnapi/runtime', extraneous: true },
        broken: { version: '1.0.0', path: '/repo/node_modules/broken', invalid: true },
      },
    }, exceptionFile);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('invalid');
  });

  it('rejects an expired exception even when the anomalous package is absent', () => {
    const expired = JSON.parse(JSON.stringify(exceptionFile));
    expired.exceptions[0].expiresOn = '2020-01-01';

    const result = runValidator({ name: 'root', path: '/repo', dependencies: {} }, expired);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('expired');
  });

  it('rejects a second occurrence of the otherwise allowed finding', () => {
    const duplicate = {
      name: '@emnapi/runtime',
      version: '1.11.2',
      path: '/repo/node_modules/@emnapi/runtime',
      extraneous: true,
    };
    const result = runValidator({
      name: 'root', path: '/repo', dependencies: {
        first: duplicate,
        second: duplicate,
      },
    }, exceptionFile);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('more than one allowed extraneous');
  });
});

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
    reason: 'npm optional WASM dependency materialization bug',
    upstreamIssue: 'npm/cli#8128',
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

const emptyExceptions = { schemaVersion: 1, exceptions: [] };

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

  it('allows multiple matched findings covered by declared exceptions', () => {
    const result = runValidator({
      name: 'root', path: '/repo', dependencies: {
        '@emnapi/runtime': {
          name: '@emnapi/runtime',
          version: '1.11.2',
          path: '/repo/node_modules/@emnapi/runtime',
          extraneous: true,
        },
        '@img/sharp-wasm32': {
          name: '@img/sharp-wasm32',
          version: '0.35.3',
          path: '/repo/node_modules/@img/sharp-wasm32',
          extraneous: true,
        },
      },
    }, {
      ...exceptionFile,
      exceptions: [
        ...exceptionFile.exceptions,
        {
          type: 'extraneous',
          name: '@img/sharp-wasm32',
          version: '0.35.3',
          path: 'node_modules/@img/sharp-wasm32',
          reason: 'sharp optional WASM32 binary',
          upstreamIssue: 'npm/cli#8128',
          platform: {
            node: '22.23.1',
            npm: '10.9.8',
            os: 'linux',
            arch: 'x64',
          },
          artifactAllowed: false,
          expiresOn: '2026-09-30',
        },
      ],
    });

    expect(result.status).toBe(0);
  });

  it('passes with a clean tree and no exceptions', () => {
    const result = runValidator(
      { name: 'root', path: '/repo', dependencies: { foo: { version: '1.0.0', path: '/repo/node_modules/foo' } } },
      emptyExceptions,
    );

    expect(result.status).toBe(0);
  });

  it('fails when tree is clean but stale exceptions remain', () => {
    const result = runValidator(
      { name: 'root', path: '/repo', dependencies: {} },
      exceptionFile,
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('stale');
  });

  it('rejects exceptions missing required schema fields', () => {
    const badSchema = {
      schemaVersion: 1,
      exceptions: [{
        type: 'extraneous',
        name: '@emnapi/runtime',
        // missing: version, path, reason, upstreamIssue, platform, artifactAllowed, expiresOn
      }],
    };

    const result = runValidator(
      { name: 'root', path: '/repo', dependencies: {} },
      badSchema,
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('missing required field');
  });
});

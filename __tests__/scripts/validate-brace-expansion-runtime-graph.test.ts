import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const validator = join(root, 'scripts/security/validate-brace-expansion-attestation.mjs');
const generator = join(root, 'scripts/generate-runtime-sbom.js');
let fixtureDirectory = '';
let baselineSbom: Record<string, unknown>;

beforeAll(() => {
  fixtureDirectory = mkdtempSync(join(root, '.tmp-brace-runtime-graph-'));
  const baselinePath = join(fixtureDirectory, 'baseline.cdx.json');
  const generated = spawnSync(process.execPath, [generator, '--output', baselinePath], {
    cwd: root,
    encoding: 'utf8',
  });
  if (generated.status !== 0) {
    throw new Error(generated.stderr || generated.stdout);
  }
  baselineSbom = JSON.parse(readFileSync(baselinePath, 'utf8'));

  writeFileSync(join(fixtureDirectory, 'production-audit.json'), JSON.stringify({
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
        total: 0,
      },
    },
  }));
  writeFileSync(join(fixtureDirectory, 'npm-audit.json'), JSON.stringify({
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 36,
        critical: 0,
        total: 36,
      },
    },
    vulnerabilities: {
      'brace-expansion': {
        name: 'brace-expansion',
        severity: 'high',
        via: [{
          name: 'brace-expansion',
          severity: 'high',
          url: 'https://github.com/advisories/GHSA-mh99-v99m-4gvg',
        }],
        nodes: [
          'node_modules/brace-expansion',
          'node_modules/cacache/node_modules/brace-expansion',
        ],
      },
    },
  }));
});

afterAll(() => {
  rmSync(fixtureDirectory, { recursive: true, force: true });
});

function cloneBaseline() {
  return JSON.parse(JSON.stringify(baselineSbom)) as {
    components: Array<Record<string, unknown>>;
  };
}

function runValidator(sbom: Record<string, unknown>, name: string) {
  const runtimePath = join(fixtureDirectory, `${name}.cdx.json`);
  writeFileSync(runtimePath, `${JSON.stringify(sbom, null, 2)}\n`);
  const repositoryPath = (path: string) => relative(root, path);

  return spawnSync(process.execPath, [
    validator,
    '--mode', 'npm',
    '--attestation', 'security/brace-expansion-backport-attestation.json',
    '--lockfile', 'package-lock.json',
    '--now', '2026-07-31T18:00:00.000Z',
    '--report', repositoryPath(join(fixtureDirectory, 'npm-audit.json')),
    '--production-audit', repositoryPath(join(fixtureDirectory, 'production-audit.json')),
    '--runtime-sbom', repositoryPath(runtimePath),
  ], {
    cwd: root,
    encoding: 'utf8',
  });
}

describe('brace-expansion runtime graph revocation', () => {
  it('revokes the attestation when a runtime dependency version changes', () => {
    const changed = cloneBaseline();
    changed.components[0].version = `${changed.components[0].version}-changed`;

    const result = runValidator(changed, 'changed-version');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('RUNTIME_GRAPH_DIGEST_CHANGED');
  });

  it('rejects brace-expansion when it becomes runtime-exposed', () => {
    const exposed = cloneBaseline();
    exposed.components[0].components = [
      ...((exposed.components[0].components as Array<Record<string, unknown>>) || []),
      { type: 'library', name: 'brace-expansion', version: '1.1.18' },
    ];

    const result = runValidator(exposed, 'runtime-exposure');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('RUNTIME_EXPOSURE_DETECTED');
  });
});

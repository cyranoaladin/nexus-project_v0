import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const script = join(root, 'scripts/security/runtime-sbom-digest.mjs');
let fixtureDirectory = '';

type Sbom = {
  components: Array<Record<string, unknown>>;
};

beforeAll(() => {
  fixtureDirectory = mkdtempSync(join(root, '.tmp-runtime-sbom-digest-'));
});

afterAll(() => {
  rmSync(fixtureDirectory, { recursive: true, force: true });
});

function run(sbom: Sbom, name: string) {
  const sbomPath = join(fixtureDirectory, `${name}.cdx.json`);
  const canonicalPath = join(fixtureDirectory, `${name}.canonical.json`);
  writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    script,
    '--sbom', sbomPath,
    '--canonical-output', canonicalPath,
  ], {
    cwd: root,
    encoding: 'utf8',
  });

  return {
    ...result,
    canonical: result.status === 0 ? readFileSync(canonicalPath, 'utf8') : '',
  };
}

function fixture(version = 'v1.2.3'): Sbom {
  return {
    components: [
      {
        type: 'library',
        group: '@scope',
        name: 'package',
        version,
        purl: 'pkg:npm/%40scope/package@1.2.3',
        hashes: [{ alg: 'SHA-512', content: 'volatile' }],
        properties: [{ name: 'cdx:npm:package:development', value: 'true' }],
        components: [
          {
            type: 'library',
            name: 'nested',
            version: '2.0.0',
            scope: 'optional',
          },
        ],
      },
      {
        type: 'library',
        group: '@scope',
        name: 'package',
        version: '1.2.3',
        comment: 'normalized duplicate',
      },
      {
        type: 'library',
        name: 'Cafe\u0301',
        version: '3.0.0',
        timestamp: '2026-07-31T00:00:00.000Z',
      },
    ],
  };
}

describe('runtime SBOM semantic digest', () => {
  it('canonicalizes recursively, normalizes NFC and numeric v prefixes, deduplicates, and sorts', () => {
    const result = run(fixture(), 'canonical');
    const expected = `${JSON.stringify({
      schema: 'nexus-runtime-component-set-recursive/v1',
      components: [
        { name: '@scope/package', version: '1.2.3' },
        { name: 'Caf\u00e9', version: '3.0.0' },
        { name: 'nested', version: '2.0.0' },
      ],
    })}\n`;

    expect(result.status).toBe(0);
    expect(result.canonical).toBe(expected);
    expect(JSON.parse(result.stdout)).toEqual({
      digest: createHash('sha256').update(expected, 'utf8').digest('hex'),
      componentCount: 3,
      schema: 'nexus-runtime-component-set-recursive/v1',
    });
  });

  it('ignores volatile CycloneDX metadata', () => {
    const first = run(fixture(), 'volatile-a');
    const secondFixture = fixture();
    secondFixture.components[0].hashes = [];
    secondFixture.components[0].properties = [];
    secondFixture.components[0].purl = 'pkg:npm/volatile-value';
    secondFixture.components[0].scope = 'required';
    const second = run(secondFixture, 'volatile-b');

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(JSON.parse(first.stdout).digest).toBe(JSON.parse(second.stdout).digest);
  });

  it('changes the digest when a real runtime dependency version changes', () => {
    const first = run(fixture(), 'version-a');
    const second = run(fixture('1.2.4'), 'version-b');

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(JSON.parse(first.stdout).digest).not.toBe(JSON.parse(second.stdout).digest);
  });

  it.each([
    [{ name: '', version: '1.0.0' }, 'RUNTIME_COMPONENT_NAME_INVALID'],
    [{ name: 'missing-version' }, 'RUNTIME_COMPONENT_VERSION_INVALID'],
  ])('fails closed for an invalid component', (component, expectedError) => {
    const result = run({ components: [component] }, expectedError);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(expectedError);
  });
});

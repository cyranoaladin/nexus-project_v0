import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(__dirname, '../../..');

describe('brace-expansion dependency remediation', () => {
  it('installs a native graph without dependency patch hooks', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
    ) as {
      scripts?: Record<string, string>;
      overrides?: Record<string, unknown>;
    };

    expect(manifest.scripts?.postinstall).toBeUndefined();
    expect(manifest.overrides?.['brace-expansion']).toBeUndefined();
    expect(
      fs.existsSync(
        path.join(
          repositoryRoot,
          'scripts/security/apply-brace-expansion-compat.mjs',
        ),
      ),
    ).toBe(false);
  });

  it('rejects every installed brace-expansion version below 5.0.8', () => {
    expect(() => execFileSync(
      process.execPath,
      ['scripts/security/verify-brace-expansion-remediation.mjs'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      },
    )).not.toThrow();
  });

  it('contains no historical minimatch line requiring an adapter', () => {
    const lockfile = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, 'package-lock.json'), 'utf8'),
    ) as {
      packages?: Record<string, { version?: string }>;
    };
    const installedVersions = Object.entries(lockfile.packages ?? {})
      .filter(([packagePath]) => packagePath.endsWith('node_modules/minimatch'))
      .map(([, metadata]) => metadata.version);

    expect(installedVersions.length).toBeGreaterThan(0);
    expect(
      installedVersions.every((version) => (
        typeof version === 'string'
        && Number.parseInt(version.split('.')[0], 10) >= 10
      )),
    ).toBe(true);
  });

  it('loads the upstream 5.0.8 memory bound and truncates hostile input', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const braceExpansion = require('brace-expansion') as {
      EXPANSION_MAX_LENGTH?: number;
      expand?: (
        pattern: string,
        options?: { max?: number; maxLength?: number },
      ) => string[];
    };

    expect(braceExpansion.EXPANSION_MAX_LENGTH).toBe(4_000_000);
    expect(braceExpansion.expand).toBeInstanceOf(Function);

    const expanded = braceExpansion.expand?.(
      '{a,b}'.repeat(120),
      { max: 2_000, maxLength: 12_000 },
    );

    expect(expanded).toBeDefined();
    expect(
      expanded?.reduce((length, item) => length + item.length, 0),
    ).toBeLessThanOrEqual(12_000);
  });
});

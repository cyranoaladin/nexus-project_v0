import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const validator = join(root, 'scripts/security/validate-brace-expansion-attestation.mjs');
const attestation = join(root, 'security/brace-expansion-backport-attestation.json');
const lockfile = join(root, 'package-lock.json');
const now = '2026-08-23T12:00:00Z';

function osvReport(extra = false) {
  const packages = [
    {
      package: { name: 'brace-expansion', version: '1.1.18' },
      vulnerabilities: [{ id: 'GHSA-mh99-v99m-4gvg', aliases: ['CVE-2026-14257'] }],
    },
    {
      package: { name: 'brace-expansion', version: '2.1.4' },
      vulnerabilities: [{ id: 'GHSA-mh99-v99m-4gvg', aliases: ['CVE-2026-14257'] }],
    },
  ];
  if (extra) {
    packages.push({
      package: { name: 'other-package', version: '1.0.0' },
      vulnerabilities: [{ id: 'GHSA-unexpected-0000', aliases: ['CVE-2099-0000'] }],
    });
  }
  return { results: [{ packages }] };
}

function npmReport(extra = false) {
  const vulnerabilities: Record<string, unknown> = {};
  if (extra) {
    vulnerabilities.mathlive = {
      via: [{
        name: 'mathlive',
        severity: 'high',
        url: 'https://github.com/advisories/GHSA-unexpected-0000',
      }],
      nodes: ['node_modules/mathlive'],
    };
  }
  return {
    vulnerabilities,
    metadata: {
      vulnerabilities: extra
        ? { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 }
        : { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    },
  };
}

describe('brace-expansion attestation validator', () => {
  let directory: string;
  let sbom: string;

  beforeAll(() => {
    directory = mkdtempSync(join(root, '.tmp-brace-attestation-'));
    sbom = join(directory, 'runtime.cdx.json');
    execFileSync(process.execPath, [
      join(root, 'scripts/generate-runtime-sbom.js'),
      '--output',
      sbom,
    ], { cwd: root, stdio: 'ignore' });
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function run(mode: 'npm' | 'osv', report: unknown, overrideAttestation = attestation) {
    const reportPath = join(directory, `${mode}-${Math.random()}.json`);
    writeFileSync(reportPath, JSON.stringify(report));
    const args = [
      validator,
      '--mode', mode,
      '--attestation', relative(root, overrideAttestation),
      '--lockfile', 'package-lock.json',
      '--now', now,
      '--report', relative(root, reportPath),
    ];
    if (mode === 'npm') {
      const productionPath = join(directory, 'production.json');
      writeFileSync(productionPath, JSON.stringify({
        vulnerabilities: {},
        metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
      }));
      args.push(
        '--production-audit', relative(root, productionPath),
        '--runtime-sbom', relative(root, sbom),
      );
    }
    return spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  }

  it('accepts only the documented OSV findings', () => {
    const result = run('osv', osvReport());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ATTESTATION_VALID mode=osv');
  });

  it('rejects an additional OSV advisory', () => {
    const result = run('osv', osvReport(true));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ADDITIONAL_ADVISORY');
  });

  it('accepts only a zero-finding npm audit', () => {
    const result = run('npm', npmReport());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ATTESTATION_VALID mode=npm');
  });

  it('rejects any additional npm advisory', () => {
    const result = run('npm', npmReport(true));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/SCANNER_FINDING_SET_CHANGED|ADDITIONAL_ADVISORY/);
  });

  it('rejects an expired attestation', () => {
    const expiredPath = join(directory, 'expired.json');
    const expired = JSON.parse(readFileSync(attestation, 'utf8'));
    expired.validity.expiresOn = '2026-08-01';
    writeFileSync(expiredPath, JSON.stringify(expired));
    const result = run('osv', osvReport(), expiredPath);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ATTESTATION_EXPIRED');
  });
});

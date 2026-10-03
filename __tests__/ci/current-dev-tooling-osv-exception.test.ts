import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const workflow = yaml.load(readFileSync('.github/workflows/ci.yml', 'utf8')) as any;

describe('temporary OSV exception CI evidence contract', () => {
  it('makes Security Scan depend on and reject missing runtime evidence jobs', () => {
    const security = workflow.jobs.security;
    expect(security.needs).toEqual(['dependency-integrity', 'build']);
    expect(security.if).toBe('${{ always() }}');
    const gate = security.steps.find((step: { name: string }) =>
      step.name === 'Verify runtime evidence jobs');
    expect(gate.if).toContain('steps.osv_scan.outputs.code ==');
    expect(gate.run).toContain('needs.dependency-integrity.result');
    expect(gate.run).toContain('needs.build.result');
  });

  it('downloads the exact same-run SBOM and standalone for a single fail-closed OSV validator', () => {
    const security = workflow.jobs.security;
    const downloads = security.steps.filter((step: { uses?: string }) =>
      step.uses?.startsWith('actions/download-artifact@'));
    expect(downloads.map((step: { with: { name: string } }) => step.with.name))
      .toEqual(['dependency-integrity-evidence', 'nextjs-build']);
    expect(downloads.every((step: { uses: string }) =>
      step.uses.includes('37930b1c2abaa49bbe596cd826c3c89aef350131'))).toBe(true);
    expect(downloads.every((step: { if?: string }) =>
      step.if?.includes('steps.osv_scan.outputs.code =='))).toBe(true);

    const osv = security.steps.find((step: { name: string }) =>
      step.name === 'Run OSV Scanner');
    expect(osv.run).toContain('./osv-scanner --lockfile=package-lock.json');
    expect(osv.id).toBe('osv_scan');
    const clean = security.steps.find((step: { name: string }) =>
      step.name === 'Validate clean OSV result');
    expect(clean.if).toContain('steps.osv_scan.outputs.code ==');
    expect(clean.run).toContain('--mode clean-osv');
    const exception = security.steps.find((step: { name: string }) =>
      step.name === 'Validate exact temporary OSV exception');
    expect(exception.if).toContain('steps.osv_scan.outputs.code ==');
    expect(exception.run).toContain('--mode current-osv');
    expect(exception.run).toContain('--production-tree');
    expect(exception.run).toContain('--runtime-sbom');
    expect(exception.run).toContain('--artifact-root');
    expect(exception.run).toContain('--artifact-manifest');
    expect(osv.run).not.toContain('|| true');
  });

  it('uploads the production npm tree alongside the existing audit and runtime SBOM', () => {
    const integrity = workflow.jobs['dependency-integrity'];
    expect(integrity.steps.some((step: { name: string, run?: string }) =>
      step.name === 'Inventory production dependency tree' &&
      step.run?.includes('npm ls --omit=dev --all --json --long'))).toBe(true);
    const upload = integrity.steps.find((step: { name: string }) =>
      step.name === 'Upload dependency evidence');
    expect(upload.with.path).toContain('npm-tree-production.json');
  });
});

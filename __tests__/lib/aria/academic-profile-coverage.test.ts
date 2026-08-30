import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ARIA academic representation and capability coverage', () => {
  it('keeps enum drift and both coverage axes machine-readable without a 100 percent claim', () => {
    const output = execFileSync('npm', ['run', 'aria:enum-drift'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    expect(output).toContain('ACADEMIC_ENUM_DRIFT=0');
    const artifact = JSON.parse(readFileSync(resolve(
      process.cwd(),
      'docs/_generated/aria-academic-capability-coverage.v1.json',
    ), 'utf8')) as {
      academicMapRepresentationCoverage: { status: string; percentage?: number };
      ariaCapabilityCoverage: { status: string };
      dimensions: readonly { id: string; status: string }[];
      languageChoiceModel: string;
    };
    expect(artifact.academicMapRepresentationCoverage.status).toBe('INCOMPLETE');
    expect(artifact.ariaCapabilityCoverage.status).toBe('PARTIAL');
    expect(artifact.academicMapRepresentationCoverage).not.toHaveProperty('percentage', 100);
    expect(artifact.dimensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'LVA_ACTUAL_LANGUAGE', status: 'UNREPRESENTABLE' }),
      expect.objectContaining({ id: 'LVB_ACTUAL_LANGUAGE', status: 'UNREPRESENTABLE' }),
      expect.objectContaining({ id: 'CANDIDAT_LIBRE', status: 'NOT_PROVEN' }),
      expect.objectContaining({ id: 'ACADEMIC_PERIOD', status: 'UNREPRESENTABLE' }),
    ]));
    expect(artifact.languageChoiceModel).toBe('NOT_APPROVED_PENDING_DIMENSION_INVENTORY');
  });
});

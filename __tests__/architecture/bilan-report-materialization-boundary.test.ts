import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('A90.3 rendered artifact boundary', () => {
  test('GET report imports no renderer and rendered artifacts are never updated', () => {
    const route = readFileSync(resolve(process.cwd(), 'lib/bilans/api/get-report.ts'), 'utf8');
    const integrity = readFileSync(resolve(process.cwd(), 'lib/bilans/core/report-artifact-integrity.ts'), 'utf8');
    const production = [
      'lib/bilans/core/report-service.ts',
      'lib/bilans/core/report-materialization.ts',
      'lib/bilans/api/get-report.ts',
      'lib/bilans/staff/review-service.ts',
    ].map((path) => readFileSync(resolve(process.cwd(), path), 'utf8')).join('\n');
    expect(route).not.toMatch(/from ['"].*\/render\/(?:html|pdf)['"]/);
    expect(route).not.toContain('renderDeterministicBilanPdf');
    expect(route).not.toContain('report-materialization');
    expect(integrity).not.toMatch(/\/render\/(?:html|pdf)/);
    expect(production).not.toMatch(/reportMaterialization\.(?:update|updateMany|delete|deleteMany)/);
    expect(production).not.toMatch(/reportAudienceArtifact\.(?:update|updateMany|delete|deleteMany)/);
  });

  test('GET report can load while the PDF renderer is deliberately broken', () => {
    jest.isolateModules(() => {
      jest.doMock('@/lib/bilans/render/pdf', () => {
        throw new Error('BROKEN_RENDERER');
      });
      expect(() => require('@/lib/bilans/api/get-report')).not.toThrow();
    });
    jest.dontMock('@/lib/bilans/render/pdf');
  });
});

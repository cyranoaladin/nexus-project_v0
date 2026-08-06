import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('P0-C Parent Canonical report HTTP boundary', () => {
  test('keeps the student report page student-only and mounts a dedicated Parent viewer', () => {
    const studentReportPage = resolve(process.cwd(), 'app/bilan-gratuit/assessment/[id]/report/page.tsx');
    const parentChildPage = resolve(process.cwd(), 'app/dashboard/parent/enfant/[studentId]/page.tsx');
    const parentViewer = resolve(process.cwd(), 'components/bilans/ParentCanonicalReports.tsx');

    expect(readFileSync(studentReportPage, 'utf8')).not.toContain("session.user.role !== 'PARENT'");
    expect(readFileSync(parentChildPage, 'utf8')).toContain('ParentCanonicalReports');
    expect(existsSync(parentViewer)).toBe(true);
  });

  test('exposes status and reports only below dedicated Parent routes', () => {
    const listRoute = resolve(process.cwd(), 'app/api/parent/children/[studentId]/bilans/route.ts');
    const reportRoute = resolve(
      process.cwd(),
      'app/api/parent/children/[studentId]/bilans/[attemptId]/report/route.ts',
    );

    expect(existsSync(listRoute)).toBe(true);
    expect(existsSync(reportRoute)).toBe(true);
  });

  test('forbids Student or generic attempt HTTP routes in the Parent viewer', () => {
    const sources = [
      'app/dashboard/parent/enfant/[studentId]/page.tsx',
      'components/bilans/ParentCanonicalReports.tsx',
      'lib/bilans/passation/parent-report-protocol.ts',
    ].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n');

    expect(sources).not.toMatch(/\/api\/student\//);
    expect(sources).not.toMatch(/\/api\/bilans\/attempts\//);
    expect(sources).toContain('/api/parent/children/');
  });

  test('does not hard-code any active manifest slug in the Parent path', () => {
    const manifest = JSON.parse(readFileSync(
      resolve(process.cwd(), 'data/bilans/banks/wave1.manifest.json'),
      'utf8',
    )) as { banks: Array<{ slug: string }> };
    const sources = [
      'lib/bilans/api/parent-reports.ts',
      'lib/bilans/passation/parent-report-protocol.ts',
      'components/bilans/ParentCanonicalReports.tsx',
    ].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n');

    expect(manifest.banks.length).toBeGreaterThan(0);
    for (const { slug } of manifest.banks) expect(sources).not.toContain(slug);
  });
});

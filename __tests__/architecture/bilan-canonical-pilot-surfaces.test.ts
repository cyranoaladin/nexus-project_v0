import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('A121-A123 Canonical pilot surfaces', () => {
  test('mounts the start and report surfaces without importing bank correction data client-side', () => {
    const start = resolve(process.cwd(), 'components/bilans/CanonicalAssessmentStart.tsx');
    const viewer = resolve(process.cwd(), 'components/bilans/CanonicalReportViewer.tsx');
    const reportPage = resolve(process.cwd(), 'app/bilan-gratuit/assessment/[id]/report/page.tsx');
    for (const file of [start, viewer, reportPage]) expect(existsSync(file)).toBe(true);
    const clientSources = [start, viewer].map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(clientSources).not.toMatch(/isCorrect|explanation|distractorRationale|data\/bilans\/banks/);
    expect(readFileSync(viewer, 'utf8')).toContain('canonicalReportUrl');
  });

  test('exposes group-plan generation only below the authenticated staff surface', () => {
    const route = resolve(process.cwd(), 'app/dashboard/coach/bilans/group-plan/route.ts');
    expect(existsSync(route)).toBe(true);
    const source = readFileSync(route, 'utf8');
    expect(source).toContain('buildStaffGroupPlanDocument');
    expect(source).toContain('auth()');
    expect(source).not.toMatch(/app\/api\/bilans/);
  });
});

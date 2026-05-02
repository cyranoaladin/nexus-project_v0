import { computeInputChecksum } from '@/lib/reports/stage/checksums';

describe('stage report checksums', () => {
  it('is stable for identical inputs', () => {
    const input = {
      studentBilanUpdatedAt: new Date('2026-05-01T10:00:00.000Z'),
      coachReportUpdatedAt: new Date('2026-05-01T11:00:00.000Z'),
      promptVersion: 'stage_report_v1',
      templateVersion: 'premium_latex_v1',
    };

    expect(computeInputChecksum(input)).toBe(computeInputChecksum(input));
  });

  it('changes when a version changes', () => {
    const base = computeInputChecksum({
      studentBilanUpdatedAt: '2026-05-01T10:00:00.000Z',
      coachReportUpdatedAt: '2026-05-01T11:00:00.000Z',
      promptVersion: 'stage_report_v1',
      templateVersion: 'premium_latex_v1',
    });

    const changed = computeInputChecksum({
      studentBilanUpdatedAt: '2026-05-01T10:00:00.000Z',
      coachReportUpdatedAt: '2026-05-01T11:00:00.000Z',
      promptVersion: 'stage_report_v2',
      templateVersion: 'premium_latex_v1',
    });

    expect(changed).not.toBe(base);
  });
});

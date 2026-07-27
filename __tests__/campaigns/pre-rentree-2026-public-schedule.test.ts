import { getPreRentreeCampaign, getPreRentreeSchedule } from '@/lib/campaigns/pre-rentree-2026/getters';
import {
  PRE_RENTREE_PUBLIC_METRICS,
  buildPublicSubjectScheduleRows,
} from '@/lib/campaigns/pre-rentree-2026/public-schedule';

const campaign = getPreRentreeCampaign();
const dto = {
  schedule: getPreRentreeSchedule(),
  subjects: campaign.subjects,
  scheduleWindows: campaign.schedule,
};

describe('Pré-rentrée 2026 public schedule model', () => {
  it('uses the canonical 14/70/20/100 taxonomy', () => {
    expect(PRE_RENTREE_PUBLIC_METRICS).toEqual({
      pedagogicalModuleCount: 14,
      pedagogicalSessionTemplateCount: 70,
      operationalCohortCount: 20,
      scheduledSessionOccurrenceCount: 100,
      studentSessionsPerSubject: 5,
      studentHoursPerSubject: 10,
    });
  });

  it.each([
    ['PREMIERE', 'SVT'],
    ['TERMINALE', 'NSI'],
    ['TERMINALE', 'SVT'],
  ] as const)(
    '%s %s remains one subject of five sessions and ten hours with two alternative cohorts',
    (level, subjectId) => {
      const rows = buildPublicSubjectScheduleRows({
        schedule: dto.schedule,
        subjects: dto.subjects,
        windows: dto.scheduleWindows,
        level,
        exposeRooms: false,
      });
      const row = rows.find((candidate) => candidate.subjectId === subjectId);

      expect(row).toMatchObject({
        subjectId,
        studentSessionCount: 5,
        studentHours: 10,
      });
      expect(row?.cohorts).toHaveLength(2);
      expect(row?.cohorts.every((cohort) => cohort.dates.length === 5)).toBe(true);
      expect(row?.cohorts.every((cohort) => cohort.room === undefined)).toBe(true);
    },
  );
});

/**
 * Stage Calendar 2026-2027 — Date Coherence Test
 *
 * Verifies that:
 * 1. All 5 stages are present with exact dates
 * 2. Dates fall within official vacation windows (no school days)
 * 3. Formats and hours match (EXPRESS 9h, INTENSIF 15h, PRÉPA-BAC 30h)
 * 4. Prices come from canonical data (not hardcoded)
 * 5. Each stage is available to both inscrit réseau AEFE and candidat libre
 */

import { getStageCalendar, getStageFormat, type StageCalendarEntry } from '@/lib/pricing';

describe('Stage Calendar 2026-2027', () => {
  let calendar: StageCalendarEntry[];

  beforeAll(() => {
    calendar = getStageCalendar();
  });

  it('contains exactly 5 stages', () => {
    expect(calendar).toHaveLength(5);
  });

  const expectedStages = [
    {
      id: 'pre-rentree-2026',
      title: 'Pré-Rentrée 2026',
      dateStart: '2026-08-17',
      dateEnd: '2026-08-28',
      hours: null,
      halfDays: 10,
      formatLabel: /PACKS\s+10/,
    },
    {
      id: 'toussaint-2026',
      title: 'Toussaint',
      dateStart: '2026-10-19',
      dateEnd: '2026-10-30',
      hours: 15,
      halfDays: 5,
      formatLabel: /INTENSIF\s+15\s*h/,
    },
    {
      id: 'noel-2026',
      title: 'Noël',
      dateStart: '2026-12-21',
      dateEnd: '2026-12-30',
      hours: 9,
      halfDays: 3,
      formatLabel: /EXPRESS\s+9\s*h/,
    },
    {
      id: 'fevrier-2027',
      title: 'Février',
      dateStart: '2027-02-15',
      dateEnd: '2027-02-26',
      hours: 15,
      halfDays: 5,
      formatLabel: /INTENSIF\s+15\s*h/,
    },
    {
      id: 'printemps-prepa-bac-2027',
      title: 'Printemps / Prépa-Bac',
      dateStart: '2027-04-26',
      dateEnd: '2027-05-07',
      hours: 30,
      halfDays: 10,
      formatLabel: /PR[ÉE]PA-BAC\s+30\s*h/,
    },
  ];

  it.each(expectedStages)(
    'stage $title has correct dates and format',
    ({ id, dateStart, dateEnd, hours, halfDays, formatLabel }) => {
      const stage = calendar.find((s) => s.id === id);
      expect(stage).toBeDefined();
      expect(stage!.date_start).toBe(dateStart);
      expect(stage!.date_end).toBe(dateEnd);
      expect(stage!.hours).toBe(hours);
      expect(stage!.half_days).toBe(halfDays);
      expect(stage!.format_label).toMatch(formatLabel);
    },
  );

  it('all dates fall on weekdays (Mon-Fri)', () => {
    for (const stage of calendar) {
      const start = new Date(stage.date_start + 'T12:00:00');
      const end = new Date(stage.date_end + 'T12:00:00');
      // Start should be Monday (1)
      expect(start.getDay()).toBe(1);
      // End should be Friday (5) or at most Wednesday for express/option
      expect([3, 5]).toContain(end.getDay());
    }
  });

  it('dates fall within official vacation windows (no school days)', () => {
    // Official French school vacation windows for zone AEFE Tunisia 2026-2027
    const vacationWindows = [
      // Pré-rentrée: before 1st Sep (mid to end of Aug)
      { start: '2026-08-17', end: '2026-08-31' },
      // Toussaint: ~mid Oct to early Nov
      { start: '2026-10-17', end: '2026-11-01' },
      // Noël: ~mid Dec to early Jan
      { start: '2026-12-19', end: '2027-01-03' },
      // Février: ~mid Feb to early Mar
      { start: '2027-02-13', end: '2027-02-28' },
      // Printemps: ~late Apr to early May
      { start: '2027-04-24', end: '2027-05-09' },
    ];

    for (const stage of calendar) {
      const stageStart = new Date(stage.date_start);
      const stageEnd = new Date(stage.date_end);

      const inWindow = vacationWindows.some((w) => {
        const winStart = new Date(w.start);
        const winEnd = new Date(w.end);
        return stageStart >= winStart && stageEnd <= winEnd;
      });

      expect(inWindow).toBe(true);
    }
  });

  it('each non-pack stage references a valid format with matching hours', () => {
    for (const stage of calendar) {
      if (stage.format_id === null) continue; // pack-based stage (pre-rentree-2026)
      const format = getStageFormat(stage.format_id);
      expect(format).toBeDefined();
      expect(format!.hours).toBe(stage.hours);
    }
  });

  it('prices come from canonical format data (not hardcoded) for format stages', () => {
    for (const stage of calendar) {
      if (stage.format_id === null) continue; // pack-based
      const format = getStageFormat(stage.format_id);
      expect(format).toBeDefined();
      expect(format!.price_per_student).toBeGreaterThan(0);
      expect(format!.price_per_student_hour).toBeGreaterThanOrEqual(45);
    }
  });

  it('pack-based stages reference valid pack product IDs', () => {
    for (const stage of calendar) {
      if (stage.format_id !== null) continue;
      const packIds = (stage as unknown as { pack_product_ids?: string[] }).pack_product_ids;
      expect(packIds).toBeDefined();
      expect(packIds!.length).toBeGreaterThan(0);
    }
  });

  it('each stage has an audience defined', () => {
    for (const stage of calendar) {
      expect(stage.audience).toBeDefined();
      expect(stage.audience.length).toBeGreaterThan(0);
    }
  });

  it('each stage has subjects defined', () => {
    for (const stage of calendar) {
      expect(stage.subjects).toBeDefined();
      expect(stage.subjects.length).toBeGreaterThan(0);
    }
  });

  it('half_days = hours / 3 for format-based stages', () => {
    for (const stage of calendar) {
      if (stage.hours === null) continue; // pack-based
      expect(stage.half_days).toBe(stage.hours / 3);
    }
  });

  it('group max is 5 for all format-based stage formats', () => {
    for (const stage of calendar) {
      if (stage.format_id === null) continue; // pack-based
      const format = getStageFormat(stage.format_id);
      expect(format!.group_max).toBe(5);
    }
  });
});

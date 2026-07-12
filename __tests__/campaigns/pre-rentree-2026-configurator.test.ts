import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';
import {
  buildBilanUrl,
  buildSelectionSummary,
  buildWhatsAppMessage,
  getNextConfiguratorStep,
  getPreviousConfiguratorStep,
  requiresPedagogicalValidation,
  selectPackBySubjectCount,
  toggleLimitedSelection,
  type AcademicProfileSelection,
} from '@/lib/campaigns/pre-rentree-2026/configurator';

const dto = getPreRentreeLandingDTO();

describe('Pré-rentrée configurator logic', () => {
  it('builds all 45 level and subject configurations from DTO facts', () => {
    let configurationCount = 0;
    for (const level of dto.levels) {
      const availableSubjects = dto.subjects.filter((subject) =>
        subject.levels.includes(level.id),
      );

      for (let mask = 1; mask < 2 ** availableSubjects.length; mask += 1) {
        const subjectIds: string[] = availableSubjects
          .filter((_, index) => (mask & (1 << index)) !== 0)
          .map((subject) => subject.id);
        const summary = buildSelectionSummary({
          level: level.id,
          profile: {},
          subjectIds,
          levels: dto.levels,
          subjects: dto.subjects,
          packs: dto.packs,
          schedule: dto.schedule,
        });
        const pack = dto.packs.find(
          (candidate) => candidate.subjectsCount === subjectIds.length,
        );
        const selectedSlots = dto.schedule.filter(
          (slot) => slot.level === level.id && subjectIds.includes(slot.subject),
        );

        expect(summary.pack).toEqual(pack);
        expect(summary.totalHours).toBe(pack?.totalHours);
        expect(summary.sessionCount).toBe(selectedSlots.length);
        expect(summary.dates).toEqual(
          [...new Set(selectedSlots.map((slot) => slot.date))].sort(),
        );
        expect(summary.scheduleLines).toHaveLength(subjectIds.length);
        expect(summary.scheduleLines.every((line) => line.dates.length === 5)).toBe(true);
        configurationCount += 1;
      }
    }
    expect(configurationCount).toBe(45);
  });

  it('skips the profile step only for Seconde', () => {
    expect(getNextConfiguratorStep(1, 'SECONDE')).toBe(3);
    expect(getPreviousConfiguratorStep(3, 'SECONDE')).toBe(1);
    expect(getNextConfiguratorStep(1, 'PREMIERE')).toBe(2);
    expect(getNextConfiguratorStep(1, 'TERMINALE')).toBe(2);
  });

  it.each([1, 2, 3, 4])('selects the exact canonical pack for %i subjects', (count) => {
    const pack = selectPackBySubjectCount(dto.packs, count);

    expect(pack?.subjectsCount).toBe(count);
    expect(pack?.id).toBe(`pre2026-pack-${count}`);
  });

  it('does not fall back to another price when no pack matches', () => {
    expect(selectPackBySubjectCount(dto.packs, 0)).toBeNull();
    expect(selectPackBySubjectCount(dto.packs, 5)).toBeNull();
  });

  it('limits retained specialties to two without creating a third EDS', () => {
    const first = toggleLimitedSelection([], 'MATHEMATIQUES', 2);
    const second = toggleLimitedSelection(first, 'NSI', 2);
    const third = toggleLimitedSelection(second, 'PHYSIQUE_CHIMIE', 2);

    expect(second).toEqual(['MATHEMATIQUES', 'NSI']);
    expect(third).toEqual(second);
  });

  it.each([
    ['PREMIERE', { mathsProfile: 'MATHS_EDS' }],
    ['PREMIERE', { mathsProfile: 'MATHS_HORS_EDS' }],
    ['PREMIERE', { eafProfile: 'EAF_GENERALE' }],
    ['PREMIERE', { eafProfile: 'EAF_TECHNOLOGIQUE' }],
    ['TERMINALE', { retainedSpecialties: ['MATHEMATIQUES'] }],
    ['TERMINALE', { mathsOption: 'MATHS_EXPERTES' }],
    ['TERMINALE', { mathsOption: 'MATHS_COMPLEMENTAIRES' }],
  ] as Array<[string, AcademicProfileSelection]>)('flags %s profile for pedagogical validation', (level, profile) => {
    expect(requiresPedagogicalValidation(level, profile)).toBe(true);
  });

  it('builds a 40-hour summary from DTO schedule and pack data', () => {
    const subjects = dto.subjects.map((subject) => subject.id);
    const summary = buildSelectionSummary({
      level: 'TERMINALE',
      profile: { mathsOption: 'AUCUNE' },
      subjectIds: subjects,
      levels: dto.levels,
      subjects: dto.subjects,
      packs: dto.packs,
      schedule: dto.schedule,
    });

    expect(summary.pack?.id).toBe('pre2026-pack-4');
    expect(summary.totalHours).toBe(40);
    expect(summary.sessionCount).toBe(20);
    expect(summary.dates).toHaveLength(10);
    expect(summary.scheduleLines).toHaveLength(4);
    expect(summary.scheduleLines[0]?.dates).toHaveLength(5);
  });

  it('uses DTO labels for the parent-facing academic profile', () => {
    const profileLabels = Object.fromEntries([
      ...dto.academicProfiles.PREMIERE.voies,
      ...dto.academicProfiles.PREMIERE.mathsProfiles,
      ...dto.academicProfiles.PREMIERE.eafProfiles,
    ].map((option) => [option.id, option.label]));
    const summary = buildSelectionSummary({
      level: 'PREMIERE',
      profile: { voie: 'GENERALE', mathsProfile: 'MATHS_EDS', eafProfile: 'EAF_GENERALE' },
      profileLabels,
      subjectIds: ['MATHEMATIQUES'],
      levels: dto.levels,
      subjects: dto.subjects,
      packs: dto.packs,
      schedule: dto.schedule,
    });

    expect(summary.profileLabel).toBe('Voie générale, Maths EDS, EAF voie générale');
    expect(summary.profileLabel).not.toContain('_');
  });

  it('builds a validated bilan URL without price or PII', () => {
    const url = buildBilanUrl({
      packId: 'pre2026-pack-2',
      level: 'PREMIERE',
      subjectIds: ['MATHEMATIQUES', 'FRANCAIS'],
      profile: { voie: 'GENERALE', mathsProfile: 'MATHS_EDS', eafProfile: 'EAF_GENERALE' },
    });

    expect(url).toContain('programme=pre-rentree-2026');
    expect(url).toContain('pack=pre2026-pack-2');
    expect(url).not.toMatch(/price|prix|email|phone|telephone|nom=/i);
  });

  it('builds a WhatsApp message with selection facts and no PII', () => {
    const summary = buildSelectionSummary({
      level: 'PREMIERE',
      profile: { voie: 'GENERALE', mathsProfile: 'MATHS_EDS' },
      subjectIds: ['MATHEMATIQUES', 'FRANCAIS'],
      levels: dto.levels,
      subjects: dto.subjects,
      packs: dto.packs,
      schedule: dto.schedule,
    });

    const message = buildWhatsAppMessage(summary);
    expect(message).toContain('Pré-rentrée Nexus 2026');
    expect(message).toContain('20 heures');
    expect(message).toContain('Pack : 2 matières');
    expect(message).not.toContain('pre2026-pack-2');
    expect(message).toContain('lun. 17 août');
    expect(message).not.toContain('2026-08-17');
    expect(message).toContain(String(summary.pack?.deposit));
    expect(message).not.toMatch(/@|\+216|99192829/);
  });
});

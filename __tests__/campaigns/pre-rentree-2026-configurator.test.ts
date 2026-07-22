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
import { parsePreRentreeBilanPrefill } from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';

const dto = getPreRentreeLandingDTO();

describe('Pré-rentrée configurator logic', () => {
  it('builds all 48 level and subject configurations from DTO facts', () => {
    let configurationCount = 0;
    for (const level of dto.levels) {
      const availableSubjects = dto.subjects.filter((subject) =>
        subject.levels.includes(level.id),
      );

      for (let mask = 1; mask < 2 ** availableSubjects.length; mask += 1) {
        const subjectIds: string[] = availableSubjects
          .filter((_, index) => (mask & (1 << index)) !== 0)
          .map((subject) => subject.id);
        if (subjectIds.length > 4) continue;
        const profile: AcademicProfileSelection = level.id === 'TROISIEME' || level.id === 'SECONDE'
          ? {}
          : level.id === 'PREMIERE'
            ? { voie: 'GENERALE', mathsProfile: 'MATHS_EDS', eafProfile: 'EAF_GENERALE', premiereSpecialtyPlan: 'NSI_PHYSIQUE_CHIMIE' }
            : {
                retainedSpecialties: subjectIds
                  .filter((subjectId) => ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'SVT'].includes(subjectId))
                  .slice(0, 2),
                mathsOption: 'AUCUNE',
              };
        const summary = buildSelectionSummary({
          level: level.id,
          profile,
          subjectIds,
          levels: dto.levels,
          subjects: dto.subjects,
          packs: dto.offerOptions,
          schedule: dto.schedule,
        });
        const pack = dto.offerOptions.find(
          (candidate) => candidate.level === level.id && candidate.subjectsCount === subjectIds.length,
        );
        if (!pack) throw new Error(`Missing test pack for ${subjectIds.length} subjects`);
        const selectedSlots = dto.schedule.filter(
          (slot) => slot.level === level.id && subjectIds.includes(slot.subject),
        );

        expect(summary.pack).toEqual(pack);
        expect(summary.level).toBe(level.id);
        expect(summary.levelLabel).toBe(level.label);
        expect(summary.profile).toEqual(profile);
        expect(summary.subjectIds).toEqual(subjectIds);
        expect(summary.subjectLabels).toHaveLength(subjectIds.length);
        expect(summary.totalHours).toBe(pack?.totalHours);
        expect(summary.sessionCount).toBe(selectedSlots.length);
        expect(summary.sessionCount).toBe(subjectIds.length * 5);
        expect(summary.dates).toEqual(
          [...new Set(selectedSlots.map((slot) => slot.date))].sort(),
        );
        expect(summary.scheduleLines).toHaveLength(subjectIds.length);
        expect(summary.scheduleLines.every((line) => line.dates.length === 5)).toBe(true);
        expect(summary.scheduleLines.every((line) => line.startTime && line.endTime && line.week)).toBe(true);
        expect(summary.pack?.price).toBe(pack?.price);
        expect(summary.pack?.deposit).toBe(pack?.deposit);
        expect(summary.pack?.balance).toBe(pack?.balance);
        expect(summary.requiresValidation).toBe(true);

        const bilanUrl = buildBilanUrl({
          packCode: pack.code,
          level: level.id,
          subjectIds,
          profile,
        });
        const bilanParams = Object.fromEntries(new URL(bilanUrl, 'https://nexusreussite.academy').searchParams);
        const normalizedProfile = profile.retainedSpecialties?.length === 0
          ? { ...profile, retainedSpecialties: undefined }
          : profile;
        expect(parsePreRentreeBilanPrefill(bilanParams)).toEqual({
          programme: 'pre-rentree-2026',
          packCode: pack?.code,
          level: level.id,
          subjectIds,
          profile: normalizedProfile,
        });

        const whatsapp = buildWhatsAppMessage(summary);
        expect(whatsapp).toContain(`Classe de rentrée : ${level.label}`);
        expect(whatsapp).toContain(`Volume : ${pack?.totalHours} heures`);
        expect(whatsapp).toContain(`Pack : ${subjectIds.length} ${subjectIds.length === 1 ? 'matière' : 'matières'}`);
        expect(whatsapp).toContain(`Tarif indicatif : ${pack?.price} TND`);
        expect(whatsapp).toContain(`Acompte : ${pack?.deposit} TND`);
        expect(whatsapp).not.toContain(pack?.code);
        configurationCount += 1;
      }
    }
    expect(configurationCount).toBe(78);
  });

  it('skips the profile step for both Fondations levels', () => {
    expect(getNextConfiguratorStep(1, 'TROISIEME')).toBe(3);
    expect(getPreviousConfiguratorStep(3, 'TROISIEME')).toBe(1);
    expect(getNextConfiguratorStep(1, 'SECONDE')).toBe(3);
    expect(getPreviousConfiguratorStep(3, 'SECONDE')).toBe(1);
    expect(getNextConfiguratorStep(1, 'PREMIERE')).toBe(2);
    expect(getNextConfiguratorStep(1, 'TERMINALE')).toBe(2);
  });

  it.each([1, 2, 3, 4])('selects the exact canonical pack for %i subjects', (count) => {
    const pack = selectPackBySubjectCount(dto.packs, count);

    expect(pack?.subjectsCount).toBe(count);
    expect(pack?.code).toBe(`PACK_${count}`);
  });

  it('locks the four approved prices, deposits and balances from the canonical DTO', () => {
    expect(dto.packs.map((pack) => ({
      subjectsCount: pack.subjectsCount,
      totalHours: pack.totalHours,
      price: pack.price,
      deposit: pack.deposit,
      balance: pack.balance,
    }))).toEqual([
      { subjectsCount: 1, totalHours: 10, price: 480, deposit: 144, balance: 336 },
      { subjectsCount: 2, totalHours: 20, price: 900, deposit: 270, balance: 630 },
      { subjectsCount: 3, totalHours: 30, price: 1350, deposit: 405, balance: 945 },
      { subjectsCount: 4, totalHours: 40, price: 1800, deposit: 540, balance: 1260 },
    ]);
  });

  it('does not fall back to another price when no pack matches', () => {
    expect(selectPackBySubjectCount(dto.packs, 0)).toBeNull();
    expect(selectPackBySubjectCount(dto.packs, 5)).toBeNull();
  });

  it('fails closed when a selected subject, schedule or canonical pack is missing', () => {
    const base = {
      level: 'SECONDE' as const,
      profile: {},
      levels: dto.levels,
      subjects: dto.subjects,
      packs: dto.offerOptions,
      schedule: dto.schedule,
    };

    expect(() => buildSelectionSummary({ ...base, subjectIds: ['UNKNOWN'] })).toThrow(
      'Unknown campaign subject',
    );
    expect(() => buildSelectionSummary({
      ...base,
      subjectIds: ['MATHEMATIQUES'],
      schedule: dto.schedule.filter(
        (slot) => !(slot.level === 'SECONDE' && slot.subject === 'MATHEMATIQUES'),
      ),
    })).toThrow('Missing campaign schedule');
    expect(() => buildSelectionSummary({
      ...base,
      subjectIds: ['MATHEMATIQUES'],
      packs: dto.offerOptions.filter((pack) => pack.subjectsCount !== 1),
    })).toThrow('Missing canonical campaign pack');
  });

  it('limits retained specialties to two without creating a third EDS', () => {
    const first = toggleLimitedSelection([], 'MATHEMATIQUES', 2);
    const second = toggleLimitedSelection(first, 'NSI', 2);
    const third = toggleLimitedSelection(second, 'PHYSIQUE_CHIMIE', 2);

    expect(second).toEqual(['MATHEMATIQUES', 'NSI']);
    expect(third).toEqual(second);
  });

  it.each([
    ['PREMIERE', { voie: 'GENERALE', mathsProfile: 'MATHS_EDS', eafProfile: 'EAF_GENERALE', premiereSpecialtyPlan: 'NSI' }, ['MATHEMATIQUES']],
    ['PREMIERE', { voie: 'TECHNOLOGIQUE', mathsProfile: 'MATHS_HORS_EDS', eafProfile: 'EAF_TECHNOLOGIQUE', premiereSpecialtyPlan: 'PHYSIQUE_CHIMIE' }, ['FRANCAIS']],
    ['TERMINALE', { retainedSpecialties: ['MATHEMATIQUES'], mathsOption: 'MATHS_EXPERTES' }, ['MATHEMATIQUES']],
    ['TERMINALE', { retainedSpecialties: [], mathsOption: 'MATHS_COMPLEMENTAIRES' }, ['MATHEMATIQUES']],
  ] as Array<[EntryLevelCode, AcademicProfileSelection, string[]]>)('flags %s differentiated selection for pedagogical validation', (level, profile, selectedSubjects) => {
    expect(requiresPedagogicalValidation(level, profile, selectedSubjects)).toBe(true);
  });

  it('requires validation when Terminale NSI or Physics-Chemistry is not a retained specialty', () => {
    expect(requiresPedagogicalValidation('TERMINALE', { mathsOption: 'AUCUNE' }, ['NSI'])).toBe(true);
    expect(requiresPedagogicalValidation('TERMINALE', { mathsOption: 'AUCUNE' }, ['PHYSIQUE_CHIMIE'])).toBe(true);
    expect(requiresPedagogicalValidation('TERMINALE', {
      retainedSpecialties: ['NSI', 'PHYSIQUE_CHIMIE'],
      mathsOption: 'AUCUNE',
    }, ['NSI', 'PHYSIQUE_CHIMIE'])).toBe(false);
  });

  it('builds a 40-hour summary from DTO schedule and pack data', () => {
    const subjects = ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'PHILOSOPHIE'];
    const summary = buildSelectionSummary({
      level: 'TERMINALE',
      profile: { mathsOption: 'AUCUNE' },
      subjectIds: subjects,
      levels: dto.levels,
      subjects: dto.subjects,
      packs: dto.offerOptions,
      schedule: dto.schedule,
    });

    expect(summary.pack?.code).toBe('PACK_4');
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
      ...dto.academicProfiles.PREMIERE.specialtyPlans,
    ].map((option) => [option.id, option.label]));
    const summary = buildSelectionSummary({
      level: 'PREMIERE',
      profile: { voie: 'GENERALE', mathsProfile: 'MATHS_EDS', eafProfile: 'EAF_GENERALE', premiereSpecialtyPlan: 'NSI_PHYSIQUE_CHIMIE' },
      profileLabels,
      subjectIds: ['MATHEMATIQUES'],
      levels: dto.levels,
      subjects: dto.subjects,
      packs: dto.offerOptions,
      schedule: dto.schedule,
    });

    expect(summary.profileLabel).toBe('Voie générale, Maths EDS, EAF voie générale, NSI et Physique-Chimie envisagées');
    expect(summary.levelLabel).toBe('Entrée en Première');
    expect(summary.profileLabel).not.toContain('_');
  });

  it('builds a validated bilan URL without price or PII', () => {
    const url = buildBilanUrl({
      packCode: 'PACK_2',
      level: 'PREMIERE',
      subjectIds: ['MATHEMATIQUES', 'FRANCAIS'],
      profile: { voie: 'GENERALE', mathsProfile: 'MATHS_EDS', eafProfile: 'EAF_GENERALE', premiereSpecialtyPlan: 'NSI_PHYSIQUE_CHIMIE' },
    });

    expect(url).toContain('programme=pre-rentree-2026');
    expect(url).toContain('pack=PACK_2');
    expect(url).not.toMatch(/price|prix|email|phone|telephone|nom=/i);
  });

  it('builds a WhatsApp message with selection facts and no PII', () => {
    const summary = buildSelectionSummary({
      level: 'PREMIERE',
      profile: { voie: 'GENERALE', mathsProfile: 'MATHS_EDS', premiereSpecialtyPlan: 'NSI_PHYSIQUE_CHIMIE' },
      subjectIds: ['MATHEMATIQUES', 'FRANCAIS'],
      levels: dto.levels,
      subjects: dto.subjects,
      packs: dto.offerOptions,
      schedule: dto.schedule,
    });

    const message = buildWhatsAppMessage(summary);
    expect(message).toContain('Pré-rentrée Nexus 2026');
    expect(message).toContain('Classe de rentrée : Entrée en Première');
    expect(message).not.toContain('Niveau :');
    expect(message).toContain('20 heures');
    expect(message).toContain('Pack : 2 matières');
    expect(message).not.toContain('PACK_2');
    expect(message).toContain('lun. 17 août');
    expect(message).not.toContain('2026-08-17');
    expect(message).toContain(String(summary.pack?.deposit));
    expect(message).not.toMatch(/@|\+216|99192829/);
  });
});

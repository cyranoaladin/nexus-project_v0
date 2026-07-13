import {
  classifyProfileSubjectCompatibility,
  isAcademicProfileComplete,
  type AcademicProfileSelection,
} from '@/lib/campaigns/pre-rentree-2026/configurator';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';

const subjects = ['MATHEMATIQUES', 'FRANCAIS', 'NSI', 'PHYSIQUE_CHIMIE'];

function subjectCombinations(): string[][] {
  return Array.from({ length: 15 }, (_, maskIndex) => {
    const mask = maskIndex + 1;
    return subjects.filter((_, index) => (mask & (1 << index)) !== 0);
  });
}

describe('Pré-rentrée profile × subject compatibility', () => {
  it.each([
    [
      'PREMIERE',
      { voie: 'GENERALE', mathsProfile: 'MATHS_EDS', eafProfile: 'EAF_TECHNOLOGIQUE', premiereSpecialtyPlan: 'NSI' },
      ['FRANCAIS'],
      'INCOMPATIBLE',
    ],
    [
      'PREMIERE',
      { voie: 'TECHNOLOGIQUE', mathsProfile: 'MATHS_HORS_EDS', eafProfile: 'EAF_GENERALE', premiereSpecialtyPlan: 'PHYSIQUE_CHIMIE' },
      ['FRANCAIS'],
      'INCOMPATIBLE',
    ],
    [
      'TERMINALE',
      { retainedSpecialties: ['NSI'], mathsOption: 'MATHS_EXPERTES' },
      ['MATHEMATIQUES'],
      'INCOMPATIBLE',
    ],
    [
      'TERMINALE',
      { retainedSpecialties: ['MATHEMATIQUES'], mathsOption: 'MATHS_COMPLEMENTAIRES' },
      ['MATHEMATIQUES'],
      'INCOMPATIBLE',
    ],
  ] as Array<[EntryLevelCode, AcademicProfileSelection, string[], string]>)('%s blocks a certain contradiction', (level, profile, selectedSubjects, expected) => {
    expect(classifyProfileSubjectCompatibility(level, profile, selectedSubjects).status).toBe(expected);
  });

  it.each([
    [
      'PREMIERE',
      { voie: 'GENERALE', mathsProfile: 'MATHS_EDS', eafProfile: 'EAF_GENERALE', premiereSpecialtyPlan: 'AUCUNE_NSI_PC' },
      ['NSI'],
    ],
    [
      'PREMIERE',
      { voie: 'GENERALE', mathsProfile: 'MATHS_EDS', eafProfile: 'EAF_GENERALE', premiereSpecialtyPlan: 'NSI' },
      ['PHYSIQUE_CHIMIE'],
    ],
    ['TERMINALE', { retainedSpecialties: [], mathsOption: 'AUCUNE' }, ['NSI']],
    ['TERMINALE', { retainedSpecialties: [], mathsOption: 'AUCUNE' }, ['PHYSIQUE_CHIMIE']],
  ] as Array<[EntryLevelCode, AcademicProfileSelection, string[]]>)('%s sends a non-declared specialty to pedagogical review', (level, profile, selectedSubjects) => {
    expect(classifyProfileSubjectCompatibility(level, profile, selectedSubjects).status).toBe(
      'REQUIRES_PEDAGOGICAL_REVIEW',
    );
  });

  it('requires the complete declared profile before subject selection', () => {
    expect(isAcademicProfileComplete('SECONDE', {})).toBe(true);
    expect(isAcademicProfileComplete('PREMIERE', {
      voie: 'GENERALE',
      mathsProfile: 'MATHS_EDS',
      eafProfile: 'EAF_GENERALE',
    })).toBe(false);
    expect(isAcademicProfileComplete('PREMIERE', {
      voie: 'GENERALE',
      mathsProfile: 'MATHS_EDS',
      eafProfile: 'EAF_GENERALE',
      premiereSpecialtyPlan: 'NSI_PHYSIQUE_CHIMIE',
    })).toBe(true);
    expect(isAcademicProfileComplete('TERMINALE', { mathsOption: 'AUCUNE' })).toBe(true);
  });

  it('classifies the complete profile matrix without silently accepting a contradiction', () => {
    const profiles: Array<[EntryLevelCode, AcademicProfileSelection]> = [
      ['SECONDE', {}],
      ...(['GENERALE', 'TECHNOLOGIQUE'] as const).flatMap((voie) =>
        (['MATHS_EDS', 'MATHS_HORS_EDS'] as const).flatMap((mathsProfile) =>
          (['EAF_GENERALE', 'EAF_TECHNOLOGIQUE'] as const).flatMap((eafProfile) =>
            (['AUCUNE_NSI_PC', 'NSI', 'PHYSIQUE_CHIMIE', 'NSI_PHYSIQUE_CHIMIE'] as const).map(
              (premiereSpecialtyPlan) => ['PREMIERE', { voie, mathsProfile, eafProfile, premiereSpecialtyPlan }],
            ),
          ),
        ),
      ),
      ...[[], ['MATHEMATIQUES'], ['NSI'], ['PHYSIQUE_CHIMIE'], ['MATHEMATIQUES', 'NSI'], ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'], ['NSI', 'PHYSIQUE_CHIMIE']].flatMap(
        (retainedSpecialties) => (['AUCUNE', 'MATHS_EXPERTES', 'MATHS_COMPLEMENTAIRES'] as const).map(
          (mathsOption) => ['TERMINALE', { retainedSpecialties, mathsOption }],
        ),
      ),
    ] as Array<[EntryLevelCode, AcademicProfileSelection]>;
    const allowedStatuses = new Set([
      'COMPATIBLE',
      'COMPATIBLE_WITH_DIFFERENTIATION',
      'REQUIRES_PEDAGOGICAL_REVIEW',
      'INCOMPATIBLE',
    ]);
    let cases = 0;

    for (const [level, profile] of profiles) {
      for (const selectedSubjects of subjectCombinations()) {
        const result = classifyProfileSubjectCompatibility(level, profile, selectedSubjects);
        expect(allowedStatuses.has(result.status)).toBe(true);
        expect(result.messages.every((message) => !/MATHS_|EAF_|AUCUNE_NSI_PC/.test(message))).toBe(true);
        cases += 1;
      }
    }

    expect(cases).toBe(810);
  });
});
